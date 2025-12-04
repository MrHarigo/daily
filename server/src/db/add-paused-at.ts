import 'dotenv/config';
import { pool } from './index.js';

async function migrate() {
  console.log('Adding paused_at column...');
  await pool.query('ALTER TABLE habits ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ');
  console.log('✅ Added paused_at column');
  await pool.end();
}

migrate();

