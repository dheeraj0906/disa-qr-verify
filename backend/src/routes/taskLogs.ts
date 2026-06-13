import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const taskLogSchema = z.object({
  checkpoint_id: z.string().uuid(),
  vehicle_id: z.string().uuid().nullable().optional(),
  scan_type: z.enum(['check-in', 'progress', 'completion']),
  lat: z.number().optional(),
  lng: z.number().optional(),
  before_photo_url: z.string().url().optional(),
  after_photo_url: z.string().url().optional(),
});

const verifySchema = z.object({
  action: z.enum(['approved', 'rejected']),
  remark: z.string().optional(),
});

// Submit a task log (field worker)
router.post('/', authenticate, requireRole('field_worker', 'super_admin'), validate(taskLogSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { checkpoint_id, vehicle_id, scan_type, lat, lng, before_photo_url, after_photo_url } = req.body;
      const workerId = req.user!.workerId;
      if (!workerId) { res.status(400).json({ error: 'No worker linked to this account' }); return; }

      const locExpr = lat != null
        ? `ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography`
        : 'NULL';

      // For check-in: set task_started_at; for completion: compute duration
      let taskStartedAt: string | null = null;
      let completionTime: string | null = null;

      if (scan_type === 'check-in') {
        taskStartedAt = new Date().toISOString();
      } else if (scan_type === 'completion') {
        // Find the most recent check-in for this worker/checkpoint stretch
        const prev = await pool.query(
          `SELECT tl.task_started_at
           FROM task_logs tl
           JOIN checkpoints c ON c.id = tl.checkpoint_id
           WHERE tl.worker_id=$1 AND tl.scan_type='check-in'
             AND c.stretch_id = (SELECT stretch_id FROM checkpoints WHERE id=$2)
           ORDER BY tl.scanned_at DESC LIMIT 1`,
          [workerId, checkpoint_id]
        );
        if (prev.rows[0]?.task_started_at) {
          taskStartedAt = prev.rows[0].task_started_at;
        }
      }

      const vStatus = scan_type === 'completion' ? 'pending' : 'n/a';

      const { rows } = await pool.query(
        `INSERT INTO task_logs
           (checkpoint_id, worker_id, vehicle_id, scan_type, location,
            before_photo_url, after_photo_url, task_started_at, task_completion_time, verification_status)
         VALUES
           ($1,$2,$3,$4,${locExpr},$5,$6,$7,
            CASE WHEN $7 IS NOT NULL THEN (now() - $7::timestamptz) ELSE NULL END,
            $8)
         RETURNING *`,
        [checkpoint_id, workerId, vehicle_id ?? null, scan_type,
         before_photo_url ?? null, after_photo_url ?? null, taskStartedAt, vStatus]
      );

      // Update stretch status on check-in / completion
      if (scan_type === 'check-in') {
        await pool.query(
          `UPDATE stretches SET status='in_progress'
           WHERE id=(SELECT stretch_id FROM checkpoints WHERE id=$1) AND status='not_started'`,
          [checkpoint_id]
        );
      } else if (scan_type === 'completion') {
        await pool.query(
          `UPDATE stretches SET status='completed'
           WHERE id=(SELECT stretch_id FROM checkpoints WHERE id=$1) AND status='in_progress'`,
          [checkpoint_id]
        );
      }

      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

// All logs (commissioner / super_admin)
router.get('/', authenticate, requireRole('commissioner', 'super_admin'),
  async (_req, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT tl.*, w.name AS worker_name, s.name AS stretch_name, c.type AS checkpoint_type
         FROM task_logs tl
         JOIN workers w ON w.id = tl.worker_id
         JOIN checkpoints c ON c.id = tl.checkpoint_id
         JOIN stretches s ON s.id = c.stretch_id
         ORDER BY tl.scanned_at DESC LIMIT 200`
      );
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// Pending verification queue
router.get('/pending', authenticate, requireRole('verifier', 'super_admin'),
  async (_req, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT tl.*, w.name AS worker_name, s.name AS stretch_name,
                c.type AS checkpoint_type, s.color_code,
                tl.task_completion_time::text AS duration
         FROM task_logs tl
         JOIN workers w ON w.id = tl.worker_id
         JOIN checkpoints c ON c.id = tl.checkpoint_id
         JOIN stretches s ON s.id = c.stretch_id
         WHERE tl.verification_status='pending'
         ORDER BY tl.scanned_at ASC`
      );
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// Own task history (field worker)
router.get('/my', authenticate, requireRole('field_worker', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workerId = req.user!.workerId;
      const { rows } = await pool.query(
        `SELECT tl.*, c.type AS checkpoint_type, s.name AS stretch_name
         FROM task_logs tl
         JOIN checkpoints c ON c.id = tl.checkpoint_id
         JOIN stretches s ON s.id = c.stretch_id
         WHERE tl.worker_id=$1
         ORDER BY tl.scanned_at DESC LIMIT 100`,
        [workerId]
      );
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// Verifier's own history (logs they have already actioned)
router.get('/verified', authenticate, requireRole('verifier', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { from, to } = req.query as { from?: string; to?: string };

      const params: unknown[] = [userId];
      let extra = '';
      if (from) { params.push(from); extra += ` AND tl.verified_at >= $${params.length}::date`; }
      if (to)   { params.push(to);   extra += ` AND tl.verified_at <  ($${params.length}::date + 1)`; }

      const { rows } = await pool.query(
        `SELECT tl.*, w.name AS worker_name, s.name AS stretch_name,
                c.type AS checkpoint_type, s.color_code,
                tl.task_completion_time::text AS duration,
                u.name AS verified_by_name
         FROM task_logs tl
         JOIN workers w     ON w.id = tl.worker_id
         JOIN checkpoints c ON c.id = tl.checkpoint_id
         JOIN stretches s   ON s.id = c.stretch_id
         JOIN users u       ON u.id = tl.verified_by
         WHERE tl.verified_by=$1
           AND tl.verification_status IN ('approved','rejected')
           ${extra}
         ORDER BY tl.verified_at DESC LIMIT 100`,
        params
      );
      res.json(rows);
    } catch (err) { next(err); }
  }
);

// Approve / Reject
router.post('/:id/verify', authenticate, requireRole('verifier', 'super_admin'), validate(verifySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { action, remark } = req.body as { action: 'approved' | 'rejected'; remark?: string };
      const userId = req.user!.userId;

      const { rows } = await pool.query(
        `UPDATE task_logs
         SET verification_status=$1, verified_by=$2, verified_at=now(), remark=$3
         WHERE id=$4 RETURNING *, (SELECT stretch_id FROM checkpoints WHERE id=checkpoint_id) AS stretch_id`,
        [action, userId, remark ?? null, id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }

      if (action === 'approved') {
        await pool.query(
          `UPDATE stretches SET status='verified' WHERE id=$1 AND status='completed'`,
          [rows[0].stretch_id]
        );
      } else {
        await pool.query(
          `UPDATE stretches SET status='in_progress' WHERE id=$1`,
          [rows[0].stretch_id]
        );
      }

      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

export default router;
