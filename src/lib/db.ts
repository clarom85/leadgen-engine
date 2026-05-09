// ============================================================
// Neon serverless Postgres client (lazy init)
// DATABASE_URL viene letto al primo uso, non all'import.
// Necessario per next build (no DATABASE_URL al build time).
// ============================================================

import { neon } from '@neondatabase/serverless';

type SqlClient = ReturnType<typeof neon>;
let _client: SqlClient | null = null;

function getClient(): SqlClient {
  if (_client) return _client;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure.');
  }
  _client = neon(process.env.DATABASE_URL, { fullResults: false });
  return _client;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const fn = getClient() as unknown as ((s: string, p?: unknown[]) => Promise<T[]>) & {
    query?: (s: string, p?: unknown[]) => Promise<T[]>;
  };
  if (typeof fn.query === 'function') return await fn.query(text, params ?? []);
  return await fn(text, params ?? []);
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Backward-compat: alcune importazioni potrebbero usare `sql`
export const sql = new Proxy({} as SqlClient, {
  get(_t, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  }
});
