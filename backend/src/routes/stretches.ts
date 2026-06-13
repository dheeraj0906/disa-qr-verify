import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const stretchSchema = z.object({
  name: z.string().min(1),
  color_code: z.string().min(1),
  road_name: z.string().optional(),
  start_lat: z.number().optional(),
  start_lng: z.number().optional(),
  end_lat: z.number().optional(),
  end_lng: z.number().optional(),
});

router.get('/', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, color_code, road_name, status,
              ST_AsGeoJSON(start_point) AS start_point,
              ST_AsGeoJSON(end_point)   AS end_point,
              created_at
       FROM stretches ORDER BY created_at`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('super_admin'), validate(stretchSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, color_code, road_name, start_lat, start_lng, end_lat, end_lng } = req.body;
      const startPt = start_lat != null ? `ST_SetSRID(ST_MakePoint(${start_lng},${start_lat}),4326)` : 'NULL';
      const endPt   = end_lat   != null ? `ST_SetSRID(ST_MakePoint(${end_lng},${end_lat}),4326)` : 'NULL';
      const { rows } = await pool.query(
        `INSERT INTO stretches (name, color_code, road_name, start_point, end_point)
         VALUES ($1,$2,$3,${startPt}::geography,${endPt}::geography)
         RETURNING *`,
        [name, color_code, road_name ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.put('/:id', authenticate, requireRole('super_admin'), validate(stretchSchema.partial()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, color_code, road_name, start_lat, start_lng, end_lat, end_lng } = req.body;
      const startExpr = (start_lat != null && start_lng != null)
        ? `ST_SetSRID(ST_MakePoint(${Number(start_lng)},${Number(start_lat)}),4326)::geography`
        : 'start_point';
      const endExpr = (end_lat != null && end_lng != null)
        ? `ST_SetSRID(ST_MakePoint(${Number(end_lng)},${Number(end_lat)}),4326)::geography`
        : 'end_point';
      const { rows } = await pool.query(
        `UPDATE stretches
         SET name=$1, color_code=$2, road_name=$3,
             start_point=${startExpr}, end_point=${endExpr}
         WHERE id=$4
         RETURNING id, name, color_code, road_name, status,
                   ST_AsGeoJSON(start_point) AS start_point,
                   ST_AsGeoJSON(end_point)   AS end_point,
                   created_at`,
        [name, color_code, road_name ?? null, id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id', authenticate, requireRole('super_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await pool.query(`DELETE FROM stretches WHERE id=$1`, [req.params.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

export default router;
