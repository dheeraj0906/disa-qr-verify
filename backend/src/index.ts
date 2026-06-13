import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import stretchesRouter from './routes/stretches';
import vehiclesRouter from './routes/vehicles';
import checkpointsRouter from './routes/checkpoints';
import workersRouter from './routes/workers';
import usersRouter from './routes/users';
import qrRouter from './routes/qr';
import scanRouter from './routes/scan';
import taskLogsRouter from './routes/taskLogs';
import attendanceRouter from './routes/attendance';
import dashboardRouter from './routes/dashboard';
import reportsRouter from './routes/reports';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    /\.netlify\.app$/,
  ],
  credentials: true,
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Global rate limit ────────────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// ── Scan-specific tight rate limit ───────────────────────────────────────────
app.use('/api/scan', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Scan rate limit exceeded.' },
}));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter);
app.use('/api/stretches',   stretchesRouter);
app.use('/api/vehicles',    vehiclesRouter);
app.use('/api/checkpoints', checkpointsRouter);
app.use('/api/workers',     workersRouter);
app.use('/api/users',       usersRouter);
app.use('/api/qr',          qrRouter);
app.use('/api/scan',        scanRouter);
app.use('/api/task-logs',   taskLogsRouter);
app.use('/api/attendance',  attendanceRouter);
app.use('/api/dashboard',   dashboardRouter);
app.use('/api/reports',     reportsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`DISA QR Verify API running on port ${PORT}`);
});

export default app;
