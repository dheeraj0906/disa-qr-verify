import { Router, Response, NextFunction } from 'express';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, requireRole('commissioner', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { date } = req.query as { date?: string };
      const target = date || new Date().toISOString().slice(0, 10);
      const { rows } = await pool.query(
        `SELECT a.*, w.name AS worker_name, s.name AS stretch_name, s.id AS stretch_id
         FROM attendance a
         JOIN workers w ON w.id = a.worker_id
         LEFT JOIN stretches s ON s.id = w.assigned_stretch_id
         WHERE a.date=$1
         ORDER BY a.check_in_time`,
        [target]
      );

      // Summary by stretch
      const summary = await pool.query(
        `SELECT w.assigned_stretch_id AS stretch_id, s.name AS stretch_name,
                COUNT(a.id) AS present,
                (SELECT COUNT(*) FROM workers w2 WHERE w2.assigned_stretch_id = w.assigned_stretch_id AND w2.status='active') AS total
         FROM workers w
         LEFT JOIN attendance a ON a.worker_id = w.id AND a.date=$1
         LEFT JOIN stretches s ON s.id = w.assigned_stretch_id
         WHERE w.status='active'
         GROUP BY w.assigned_stretch_id, s.name`,
        [target]
      );

      res.json({ date: target, records: rows, summary: summary.rows });
    } catch (err) { next(err); }
  }
);

router.get('/my', authenticate, requireRole('field_worker', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const workerId = req.user!.workerId;
      const { rows } = await pool.query(
        `SELECT * FROM attendance WHERE worker_id=$1 ORDER BY date DESC LIMIT 30`,
        [workerId]
      );
      res.json(rows);
    } catch (err) { next(err); }
  }
);

export default router;
