import { pool } from '../src/utils/db';
import bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Stretches ──────────────────────────────────────────────────────────
    const stretchRows = await client.query(`
      INSERT INTO stretches (name, color_code, road_name, status)
      VALUES
        ('Stretch 1', 'green',  NULL, 'not_started'),
        ('Stretch 2', 'yellow', NULL, 'not_started'),
        ('Stretch 3', 'red',    NULL, 'not_started'),
        ('Stretch 4', 'orange', NULL, 'not_started')
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `);
    const stretches: { id: string; name: string }[] = stretchRows.rows;
    console.log('Seeded stretches:', stretches.map((s) => s.name));

    // ── Vehicles (placeholder + real) ──────────────────────────────────────
    if (stretches.length === 4) {
      const [s1, s2, s3, s4] = stretches;
      await client.query(`
        INSERT INTO vehicles (registration_number, driver_name, stretch_id)
        VALUES
          ('VEHICLE-A', 'Driver A', $1),
          ('VEHICLE-B', 'Driver B', $2),
          ('VEHICLE-C', 'Driver C', $3),
          ('VEHICLE-D', 'Driver D', $4),
          ('TS 24 BA 6647', 'Driver E', $1),
          ('TS 24 OJ 5578', 'Driver F', $2)
        ON CONFLICT (registration_number) DO NOTHING
      `, [s1.id, s2.id, s3.id, s4.id]);

      // Update road names for real vehicles on Stretch 1 & 2
      await client.query(`UPDATE stretches SET road_name = 'Jammi Banda Road' WHERE id = $1`, [s1.id]);
      await client.query(`UPDATE stretches SET road_name = 'ZP Center Road'   WHERE id = $2`, [s2.id]);
    }

    // ── Checkpoints (3 per stretch: start, mid, end) ────────────────────────
    const allStretches: { id: string }[] = (
      await client.query(`SELECT id FROM stretches ORDER BY created_at`)
    ).rows;

    for (const stretch of allStretches) {
      for (const type of ['start', 'mid', 'end'] as const) {
        const res = await client.query(`
          INSERT INTO checkpoints (stretch_id, type)
          VALUES ($1, $2)
          ON CONFLICT (stretch_id, type) DO NOTHING
          RETURNING id
        `, [stretch.id, type]);

        if (res.rows.length > 0) {
          const cpId = res.rows[0].id;
          const qrPayload = `/scan/checkpoint/${cpId}`;
          await client.query(
            `UPDATE checkpoints SET qr_code = $1 WHERE id = $2`,
            [qrPayload, cpId]
          );
        }
      }
    }
    console.log('Seeded checkpoints with QR codes');

    // ── Workers (one per stretch for demo) ─────────────────────────────────
    const workerStretches = allStretches.slice(0, 4);
    const workerIds: string[] = [];
    for (let i = 0; i < workerStretches.length; i++) {
      const res = await client.query(`
        INSERT INTO workers (name, phone, assigned_stretch_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [`Worker ${i + 1}`, `98${String(i).padStart(8, '0')}`, workerStretches[i].id]);

      if (res.rows.length > 0) {
        const wId = res.rows[0].id;
        workerIds.push(wId);
        await client.query(
          `UPDATE workers SET qr_badge_code = $1 WHERE id = $2`,
          [`/scan/worker/${wId}`, wId]
        );
      }
    }
    console.log('Seeded workers');

    // ── Default Users (one per role) ────────────────────────────────────────
    const hash = async (pw: string) => bcrypt.hash(pw, 10);
    const defaultUsers = [
      { name: 'Super Admin',    email: 'admin@disa.gov',        role: 'super_admin',  password: 'Admin@1234',    workerId: null },
      { name: 'Commissioner',   email: 'commissioner@disa.gov', role: 'commissioner', password: 'Comm@1234',     workerId: null },
      { name: 'Verifier One',   email: 'verifier@disa.gov',     role: 'verifier',     password: 'Verify@1234',   workerId: null },
      { name: 'Field Worker 1', email: 'worker1@disa.gov',      role: 'field_worker', password: 'Worker@1234',   workerId: workerIds[0] ?? null },
    ];

    for (const u of defaultUsers) {
      await client.query(`
        INSERT INTO users (name, email, password_hash, role, worker_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `, [u.name, u.email, await hash(u.password), u.role, u.workerId]);
    }
    console.log('Seeded default users');
    console.log('  admin@disa.gov       / Admin@1234');
    console.log('  commissioner@disa.gov / Comm@1234');
    console.log('  verifier@disa.gov    / Verify@1234');
    console.log('  worker1@disa.gov     / Worker@1234');

    await client.query('COMMIT');
    console.log('\nSeed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
