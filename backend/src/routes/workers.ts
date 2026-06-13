import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const workerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  assigned_stretch_id: z.string().uuid().nullable().optional(),
  role: z.enum(['super_admin','commissioner','verifier','field_worker']).optional(),
  status: z.enum(['active','inactive']).optional(),
});

router.get('/', authenticate, async (_req, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, s.name AS stretch_name
       FROM workers w
       LEFT JOIN stretches s ON s.id = w.assigned_stretch_id
       ORDER BY w.created_at`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requireRole('super_admin'), validate(workerSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, phone, assigned_stretch_id, role, status } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO workers (name, phone, assigned_stretch_id, role, status)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, phone ?? null, assigned_stretch_id ?? null, role ?? 'field_worker', status ?? 'active']
      );
      const worker = rows[0];
      const badge = `/scan/worker/${worker.id}`;
      await pool.query(`UPDATE workers SET qr_badge_code=$1 WHERE id=$2`, [badge, worker.id]);
      worker.qr_badge_code = badge;
      res.status(201).json(worker);
    } catch (err) { next(err); }
  }
);

router.get('/:id/qr', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(`SELECT qr_badge_code FROM workers WHERE id=$1`, [req.params.id]);
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      const png = await QRCode.toBuffer(rows[0].qr_badge_code, { type: 'png', width: 300 });
      res.setHeader('Content-Type', 'image/png');
      res.send(png);
    } catch (err) { next(err); }
  }
);

router.put('/:id', authenticate, requireRole('super_admin'), validate(workerSchema.partial()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, phone, assigned_stretch_id, role, status } = req.body;
      const { rows } = await pool.query(
        `UPDATE workers SET name=$1, phone=$2, assigned_stretch_id=$3, role=$4, status=$5
         WHERE id=$6 RETURNING *`,
        [name, phone, assigned_stretch_id, role, status, id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      await pool.query(`DELETE FROM workers WHERE id=$1`, [req.params.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

export default router;
