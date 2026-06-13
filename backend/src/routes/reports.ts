import { Router, Response, NextFunction } from 'express';
import { Parser } from 'json2csv';
import { pool } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

function sendCSV(res: Response, filename: string, rows: object[]) {
  if (rows.length === 0) { res.json([]); return; }
  const parser = new Parser({ fields: Object.keys(rows[0]) });
  const csv = parser.parse(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/task-logs', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const { rows } = await pool.query(
        `SELECT tl.id, tl.scan_type, tl.scanned_at, tl.verification_status,
                tl.before_photo_url, tl.after_photo_url,
                tl.task_completion_time::text AS duration,
                tl.remark, tl.verified_at,
                w.name AS worker_name, s.name AS stretch_name, c.type AS checkpoint_type
         FROM task_logs tl
         JOIN workers w ON w.id=tl.worker_id
         JOIN checkpoints c ON c.id=tl.checkpoint_id
         JOIN stretches s ON s.id=c.stretch_id
         WHERE ($1::date IS NULL OR DATE(tl.scanned_at) >= $1)
           AND ($2::date IS NULL OR DATE(tl.scanned_at) <= $2)
         ORDER BY tl.scanned_at DESC`,
        [from ?? null, to ?? null]
      );
      sendCSV(res, 'task-logs.csv', rows);
    } catch (err) { next(err); }
  }
);

router.get('/attendance', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const { rows } = await pool.query(
        `SELECT a.date, a.check_in_time, a.is_late,
                w.name AS worker_name, s.name AS stretch_name
         FROM attendance a
         JOIN workers w ON w.id=a.worker_id
         LEFT JOIN stretches s ON s.id=w.assigned_stretch_id
         WHERE ($1::date IS NULL OR a.date >= $1)
           AND ($2::date IS NULL OR a.date <= $2)
         ORDER BY a.date DESC, a.check_in_time`,
        [from ?? null, to ?? null]
      );
      sendCSV(res, 'attendance.csv', rows);
    } catch (err) { next(err); }
  }
);

router.get('/verifications', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const { rows } = await pool.query(
        `SELECT tl.id, tl.verification_status, tl.verified_at, tl.remark,
                u.name AS verified_by, w.name AS worker_name, s.name AS stretch_name
         FROM task_logs tl
         LEFT JOIN users u ON u.id=tl.verified_by
         JOIN workers w ON w.id=tl.worker_id
         JOIN checkpoints c ON c.id=tl.checkpoint_id
         JOIN stretches s ON s.id=c.stretch_id
         WHERE tl.verification_status IN ('approved','rejected')
           AND ($1::date IS NULL OR DATE(tl.verified_at) >= $1)
           AND ($2::date IS NULL OR DATE(tl.verified_at) <= $2)
         ORDER BY tl.verified_at DESC`,
        [from ?? null, to ?? null]
      );
      sendCSV(res, 'verifications.csv', rows);
    } catch (err) { next(err); }
  }
);

export default router;
