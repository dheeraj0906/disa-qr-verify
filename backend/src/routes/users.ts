import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { pool } from '../utils/db';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['super_admin','commissioner','verifier','field_worker']),
  zone: z.string().optional(),
  worker_id: z.string().uuid().nullable().optional(),
});

router.get('/', authenticate, requireRole('super_admin'),
  async (_req, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, email, role, zone, worker_id, created_at FROM users ORDER BY created_at`
      );
      res.json(rows);
    } catch (err) { next(err); }
  }
);

router.post('/', authenticate, requireRole('super_admin'), validate(userSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, role, zone, worker_id } = req.body;
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, zone, worker_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, name, email, role, zone, worker_id, created_at`,
        [name, email, hash, role, zone ?? null, worker_id ?? null]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.put('/:id', authenticate, requireRole('super_admin'), validate(userSchema.partial()),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, email, password, role, zone, worker_id } = req.body;
      const hash = password ? await bcrypt.hash(password, 10) : undefined;
      const { rows } = await pool.query(
        `UPDATE users SET
           name=COALESCE($1,name),
           email=COALESCE($2,email),
           password_hash=COALESCE($3,password_hash),
           role=COALESCE($4,role),
           zone=COALESCE($5,zone),
           worker_id=COALESCE($6,worker_id)
         WHERE id=$7
         RETURNING id, name, email, role, zone, worker_id`,
        [name, email, hash, role, zone, worker_id, id]
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      res.json(rows[0]);
    } catch (err) { next(err); }
  }
);

router.delete('/:id', authenticate, requireRole('super_admin'),
  async (req, res: Response, next: NextFunction) => {
    try {
      await pool.query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
      res.status(204).end();
    } catch (err) { next(err); }
  }
);

export default router;
