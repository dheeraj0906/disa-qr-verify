import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const vehicleSchema = z.object({
  registration_number: z.string().min(1),
  driver_name: z.string().optional(),
  stretch_id: z.string().uuid().nullable().optional(),
});

router.get('/', authenticate, async (_req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.*, s.name AS stretch_name
       FROM vehicles v
       LEFT JOIN stretches s ON s.id = v.stretch_id
       ORDER BY v.created_at`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('super_admin'), validate(vehicleSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { registration_number, driver_name, stretch_id } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO vehicles (registration_number, driver_name, stretch_id)
         VALUES ($1,$2,$3) RETURNING *`,
        [registration_number, driver_name ?? null, stretch_id ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.put('/:id', authenticate, requireRole('super_admin'), validate(vehicleSchema.partial()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { registration_number, driver_name, stretch_id } = req.body;
      const { rows } = await pool.query(
        `UPDATE vehicles SET registration_number=$1, driver_name=$2, stretch_id=$3
         WHERE id=$4 RETURNING *`,
        [registration_number, driver_name, stretch_id, id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      await pool.query(`DELETE FROM vehicles WHERE id=$1`, [req.params.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

export default router;
