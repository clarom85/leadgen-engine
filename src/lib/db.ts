// ============================================================
// Neon serverless Postgres client
// Pattern matchato con il content network esistente
// ============================================================

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure.');
}

export const sql = neon(process.env.DATABASE_URL);

// Helper tipizzato per query con parametri
// Uso: const rows = await query<Buyer>('SELECT * FROM buyers WHERE id = $1', [id]);
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  // neon() returns a tagged template function but supports query() too
  // For variadic params we use the .query() form
  const result = await (sql as unknown as {
    query: (text: string, params?: unknown[]) => Promise<T[]>;
  }).query(text, params ?? []);
  return result;
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
