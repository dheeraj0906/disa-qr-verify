import { Router, Response, NextFunction } from 'express';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/live', authenticate, requireRole('commissioner', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { date } = req.query as { date?: string };
      const target = date || new Date().toISOString().slice(0, 10);
      const zone = req.user!.zone;

      // Stretches with last known vehicle location
      const stretchQuery = zone
        ? `SELECT s.id, s.name, s.color_code, s.road_name, s.status,
                  ST_AsGeoJSON(s.start_point) AS start_point,
                  ST_AsGeoJSON(s.end_point) AS end_point,
                  (SELECT ST_AsGeoJSON(tl.location)
                   FROM task_logs tl JOIN checkpoints c ON c.id=tl.checkpoint_id
                   WHERE c.stretch_id=s.id ORDER BY tl.scanned_at DESC LIMIT 1) AS last_vehicle_location
           FROM stretches s
           WHERE s.road_name=$1 OR s.name ILIKE $1
           ORDER BY s.created_at`
        : `SELECT s.id, s.name, s.color_code, s.road_name, s.status,
                  ST_AsGeoJSON(s.start_point) AS start_point,
                  ST_AsGeoJSON(s.end_point) AS end_point,
                  (SELECT ST_AsGeoJSON(tl.location)
                   FROM task_logs tl JOIN checkpoints c ON c.id=tl.checkpoint_id
                   WHERE c.stretch_id=s.id ORDER BY tl.scanned_at DESC LIMIT 1) AS last_vehicle_location
           FROM stretches s
           ORDER BY s.created_at`;

      const stretches = (await pool.query(stretchQuery, zone ? [zone] : [])).rows;

      // Attendance summary for today
      const attendance = (await pool.query(
        `SELECT COUNT(a.id) AS present,
                (SELECT COUNT(*) FROM workers WHERE status='active') AS total
         FROM attendance a WHERE a.date=$1`,
        [target]
      )).rows[0];

      // Verification summary for today
      const verification = (await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE verification_status='pending')  AS pending,
           COUNT(*) FILTER (WHERE verification_status='approved') AS approved,
           COUNT(*) FILTER (WHERE verification_status='rejected') AS rejected
         FROM task_logs
         WHERE DATE(scanned_at)=$1`,
        [target]
      )).rows[0];

      // Recent feed (20 items)
      const feed = (await pool.query(
        `SELECT tl.id, tl.scan_type, tl.scanned_at, tl.before_photo_url, tl.after_photo_url,
                tl.verification_status,
                w.name AS worker_name, s.name AS stretch_name, c.type AS checkpoint_type
         FROM task_logs tl
         JOIN workers w ON w.id=tl.worker_id
         JOIN checkpoints c ON c.id=tl.checkpoint_id
         JOIN stretches s ON s.id=c.stretch_id
         ORDER BY tl.scanned_at DESC LIMIT 20`
      )).rows;

      res.json({
        municipality: process.env.MUNICIPALITY_NAME || 'Khammam',
        date: target,
        stretches,
        attendance,
        verification,
        feed,
      });
    } catch (err) { next(err); }
  }
);

export default router;
