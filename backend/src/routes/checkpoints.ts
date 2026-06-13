import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const checkpointSchema = z.object({
  stretch_id: z.string().uuid(),
  type: z.enum(['start', 'mid', 'end']),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

router.get('/', authenticate, async (_req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, s.name AS stretch_name,
              ST_AsGeoJSON(c.location) AS location_geojson
       FROM checkpoints c
       JOIN stretches s ON s.id = c.stretch_id
       ORDER BY s.created_at, c.type`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('super_admin'), validate(checkpointSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { stretch_id, type, lat, lng } = req.body;
      const locExpr = lat != null
        ? `ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography`
        : 'NULL';
      const { rows } = await pool.query(
        `INSERT INTO checkpoints (stretch_id, type, location)
         VALUES ($1,$2,${locExpr}) RETURNING *`,
        [stretch_id, type]
      );
      const cp = rows[0];
      const qrPayload = `/scan/checkpoint/${cp.id}`;
      await pool.query(`UPDATE checkpoints SET qr_code=$1 WHERE id=$2`, [qrPayload, cp.id]);
      cp.qr_code = qrPayload;
      res.status(201).json(cp);
    } catch (err) { next(err); }
  }
);

router.get('/:id/qr', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(`SELECT qr_code FROM checkpoints WHERE id=$1`, [req.params.id]);
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      const png = await QRCode.toBuffer(rows[0].qr_code, { type: 'png', width: 300 });
      res.setHeader('Content-Type', 'image/png');
      res.send(png);
    } catch (err) { next(err); }
  }
);

router.put('/:id', authenticate, requireRole('super_admin'), validate(checkpointSchema.partial()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { stretch_id, type } = req.body;
      const { rows } = await pool.query(
        `UPDATE checkpoints SET stretch_id=$1, type=$2 WHERE id=$3 RETURNING *`,
        [stretch_id, type, id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      await pool.query(`DELETE FROM checkpoints WHERE id=$1`, [req.params.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

export default router;
