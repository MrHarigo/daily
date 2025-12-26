import { Pool, PoolClient, neonConfig } from '@neondatabase/serverless';
import { config } from 'dotenv';
import WebSocket from 'ws';

// Load environment variables before creating the pool
// This ensures DATABASE_URL is available when running standalone scripts with tsx
config({ path: '.env.local' });

// Configure WebSocket for Node.js environments (CI/CD, scripts)
// Browser environments use native WebSocket
if (typeof global !== 'undefined' && typeof window === 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
  const result = await pool.query(text, params);
  return (result.rows[0] as T) || null;
}

/**
 * Execute a function within a database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 *
 * @param callback Function that receives a client and performs queries
 * @returns The result returned by the callback
 * @throws Re-throws any error after rolling back the transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
