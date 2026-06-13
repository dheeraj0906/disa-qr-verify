import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { pool } from '../utils/db';
import { signToken } from '../utils/jwt';
import { validate } from '../middleware/validate';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const result = await pool.query(
      `SELECT id, name, email, password_hash, role, zone, worker_id FROM users WHERE email = $1`,
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = signToken({
      userId: user.id,
      role: user.role,
      zone: user.zone,
      workerId: user.worker_id,
    });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, zone: user.zone },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
