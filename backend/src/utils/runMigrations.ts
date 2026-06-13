import fs from 'fs';
import path from 'path';
import { pool } from './db';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Running ${files.length} migration(s)...`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  → ${file}`);
    await pool.query(sql);
  }

  console.log('Migrations complete.');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
