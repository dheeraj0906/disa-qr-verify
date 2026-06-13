import { pool } from '../src/utils/db';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Stretches (name is effectively unique for seed purposes) ───────────
    await client.query(`
      INSERT INTO stretches (name, color_code, road_name, status)
      VALUES
        ('Stretch 1', 'green',  'Jammi Banda Road', 'not_started'),
        ('Stretch 2', 'yellow', 'ZP Center Road',   'not_started'),
        ('Stretch 3', 'red',    NULL,                'not_started'),
        ('Stretch 4', 'orange', NULL,                'not_started')
      ON CONFLICT DO NOTHING
    `);

    // Always fetch current IDs (handles both fresh run and re-run)
    const { rows: stretches } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM stretches WHERE name = ANY($1) ORDER BY name`,
      [['Stretch 1', 'Stretch 2', 'Stretch 3', 'Stretch 4']]
    );

    const byName = Object.fromEntries(stretches.map((s) => [s.name, s.id]));
    console.log('Stretches:', stretches.map((s) => `${s.name} → ${s.id}`));

    if (stretches.length < 4) {
      throw new Error(`Expected 4 stretches but found ${stretches.length}. Check for name conflicts.`);
    }

    const [sid1, sid2, sid3, sid4] = [
      byName['Stretch 1'],
      byName['Stretch 2'],
      byName['Stretch 3'],
      byName['Stretch 4'],
    ];

    // ── Vehicles (1 per stretch, UNIQUE stretch_id enforced) ───────────────
    await client.query(`
      INSERT INTO vehicles (registration_number, driver_name, stretch_id)
      VALUES
        ('TS 24 BA 6647', 'Driver E', $1::uuid),
        ('TS 24 OJ 5578', 'Driver F', $2::uuid),
        ('VEHICLE-C',     'Driver C', $3::uuid),
        ('VEHICLE-D',     'Driver D', $4::uuid)
      ON CONFLICT (registration_number) DO NOTHING
    `, [sid1, sid2, sid3, sid4]);
    console.log('Vehicles seeded');

    // ── Checkpoints (3 per stretch: start, mid, end) ────────────────────────
    for (const stretchId of [sid1, sid2, sid3, sid4]) {
      for (const type of ['start', 'mid', 'end'] as const) {
        const res = await client.query<{ id: string }>(
          `INSERT INTO checkpoints (stretch_id, type)
           VALUES ($1::uuid, $2)
           ON CONFLICT (stretch_id, type) DO NOTHING
           RETURNING id`,
          [stretchId, type]
        );

        if (res.rows.length > 0) {
          const cpId = res.rows[0].id;
          await client.query(
            `UPDATE checkpoints SET qr_code = $1 WHERE id = $2::uuid`,
            [`/scan/checkpoint/${cpId}`, cpId]
          );
        }
      }
    }
    console.log('Checkpoints seeded with QR codes');

    // ── Workers (one per stretch for demo) ─────────────────────────────────
    const stretchIds = [sid1, sid2, sid3, sid4];
    const workerIds: string[] = [];

    for (let i = 0; i < stretchIds.length; i++) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO workers (name, phone, assigned_stretch_id, role, status)
         VALUES ($1, $2, $3::uuid, 'field_worker', 'active')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [`Worker ${i + 1}`, `980000000${i}`, stretchIds[i]]
      );

      if (res.rows.length > 0) {
        const wId = res.rows[0].id;
        workerIds.push(wId);
        await client.query(
          `UPDATE workers SET qr_badge_code = $1 WHERE id = $2::uuid`,
          [`/scan/worker/${wId}`, wId]
        );
      }
    }

    // Fetch worker IDs (in case some already existed from prior partial run)
    const { rows: existingWorkers } = await client.query<{ id: string }>(
      `SELECT id FROM workers WHERE assigned_stretch_id = ANY($1::uuid[]) ORDER BY created_at LIMIT 4`,
      [[sid1, sid2, sid3, sid4]]
    );
    const allWorkerIds = workerIds.length > 0 ? workerIds : existingWorkers.map((w) => w.id);
    console.log(`Workers seeded: ${allWorkerIds.length}`);

    // ── Default Users (one per role) ────────────────────────────────────────
    const hashPw = (pw: string) => bcrypt.hash(pw, 10);

    const defaultUsers = [
      { name: 'Super Admin',    email: 'admin@disa.gov',        role: 'super_admin',  pw: 'Admin@1234',   workerId: null },
      { name: 'Commissioner',   email: 'commissioner@disa.gov', role: 'commissioner', pw: 'Comm@1234',    workerId: null },
      { name: 'Verifier One',   email: 'verifier@disa.gov',     role: 'verifier',     pw: 'Verify@1234',  workerId: null },
      { name: 'Field Worker 1', email: 'worker1@disa.gov',      role: 'field_worker', pw: 'Worker@1234',  workerId: allWorkerIds[0] ?? null },
    ];

    for (const u of defaultUsers) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, worker_id)
         VALUES ($1, $2, $3, $4, $5::uuid)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, await hashPw(u.pw), u.role, u.workerId]
      );
    }

    await client.query('COMMIT');

    console.log('\n✓ Seed complete!\n');
    console.log('Default credentials:');
    console.log('  admin@disa.gov        / Admin@1234   (super_admin)');
    console.log('  commissioner@disa.gov / Comm@1234    (commissioner)');
    console.log('  verifier@disa.gov     / Verify@1234  (verifier)');
    console.log('  worker1@disa.gov      / Worker@1234  (field_worker)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
