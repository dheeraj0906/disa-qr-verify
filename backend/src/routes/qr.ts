import { Router, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { pool } from '../utils/db';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Bulk-generate all missing QR codes (checkpoints + workers)
router.post('/bulk-generate', authenticate, requireRole('super_admin'),
  async (_req, res: Response, next: NextFunction) => {
    try {
      // Checkpoints without QR
      const cps = await pool.query(`SELECT id FROM checkpoints WHERE qr_code IS NULL`);
      for (const cp of cps.rows) {
        const code = `/scan/checkpoint/${cp.id}`;
        await pool.query(`UPDATE checkpoints SET qr_code=$1 WHERE id=$2`, [code, cp.id]);
      }
      // Workers without badge code
      const ws = await pool.query(`SELECT id FROM workers WHERE qr_badge_code IS NULL`);
      for (const w of ws.rows) {
        const code = `/scan/worker/${w.id}`;
        await pool.query(`UPDATE workers SET qr_badge_code=$1 WHERE id=$2`, [code, w.id]);
      }
      res.json({ checkpoints: cps.rows.length, workers: ws.rows.length, message: 'QR codes generated' });
    } catch (err) { next(err); }
  }
);

// PDF sheet of all QR codes
router.get('/pdf', authenticate, requireRole('super_admin'),
  async (_req, res: Response, next: NextFunction) => {
    try {
      const checkpoints = (await pool.query(
        `SELECT c.id, c.qr_code, c.type, s.name AS stretch_name
         FROM checkpoints c
         JOIN stretches s ON s.id = c.stretch_id
         ORDER BY s.created_at, c.type`
      )).rows;

      const workers = (await pool.query(
        `SELECT id, name, qr_badge_code FROM workers WHERE qr_badge_code IS NOT NULL ORDER BY created_at`
      )).rows;

      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="disa-qr-sheet.pdf"');
      doc.pipe(res);

      doc.fontSize(18).text('DISA QR Verify — QR Code Sheet', { align: 'center' });
      doc.moveDown();

      let x = 40;
      let y = doc.y;
      const cellW = 240;
      const cellH = 200;
      let col = 0;

      async function addItem(label: string, qrPayload: string) {
        const png = await QRCode.toBuffer(qrPayload, { type: 'png', width: 160 });
        if (y + cellH > doc.page.height - 60) {
          doc.addPage();
          x = 40; y = 60; col = 0;
        }
        doc.image(png, x + 40, y + 10, { width: 150 });
        doc.fontSize(9).text(label, x, y + 170, { width: cellW, align: 'center' });
        col++;
        if (col === 2) { col = 0; x = 40; y += cellH + 10; }
        else { x += cellW + 20; }
      }

      for (const cp of checkpoints) {
        if (!cp.qr_code) continue;
        await addItem(`${cp.stretch_name} — ${cp.type.toUpperCase()} Checkpoint`, cp.qr_code);
      }

      for (const w of workers) {
        await addItem(`Worker: ${w.name}`, w.qr_badge_code);
      }

      doc.end();
    } catch (err) { next(err); }
  }
);

export default router;
