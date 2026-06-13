import { Router, Response, NextFunction } from 'express';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { isLate } from '../utils/formatIST';

const router = Router();

// Resolve checkpoint context from QR scan
router.post('/checkpoint/:id', authenticate, requireRole('field_worker', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT c.id, c.type, c.stretch_id, s.name AS stretch_name, s.color_code, s.status AS stretch_status
         FROM checkpoints c
         JOIN stretches s ON s.id = c.stretch_id
         WHERE c.id=$1`,
        [id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Checkpoint not found' }); return; }
      res.json({ checkpoint: rows[0], workerId: req.user!.workerId });
    } catch (err) { next(err); }
  }
);

// Resolve vehicle context from QR scan
router.post('/vehicle/:id', authenticate, requireRole('field_worker', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT v.id, v.registration_number, v.driver_name, v.stretch_id, s.name AS stretch_name
         FROM vehicles v
         LEFT JOIN stretches s ON s.id = v.stretch_id
         WHERE v.id=$1`,
        [id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Vehicle not found' }); return; }
      res.json({ vehicle: rows[0], workerId: req.user!.workerId });
    } catch (err) { next(err); }
  }
);

// Worker badge scan → attendance check-in
router.post('/worker/:id', authenticate, requireRole('field_worker', 'super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body as { lat?: number; lng?: number };

      const workerResult = await pool.query(
        `SELECT id, name, assigned_stretch_id FROM workers WHERE id=$1`, [id]
      );
      if (!workerResult.rows[0]) { res.status(404).json({ error: 'Worker not found' }); return; }

      const today = new Date().toISOString().slice(0, 10);
      const threshold = process.env.LATE_THRESHOLD_IST || '07:00';
      const checkIn = new Date();
      const late = isLate(checkIn, threshold);

      const locExpr = lat != null
        ? `ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography`
        : 'NULL';

      const { rows } = await pool.query(
        `INSERT INTO attendance (worker_id, date, check_in_time, location, is_late)
         VALUES ($1, $2, $3, ${locExpr}, $4)
         ON CONFLICT (worker_id, date) DO UPDATE
           SET check_in_time = EXCLUDED.check_in_time,
               is_late = EXCLUDED.is_late
         RETURNING *`,
        [id, today, checkIn, late]
      );

      res.json({ attendance: rows[0], worker: workerResult.rows[0], isLate: late });
    } catch (err) { next(err); }
  }
);

export default router;
