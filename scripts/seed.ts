// ============================================================
// Applica db/seed.sql al DB Neon (vertical + buyer mock)
// Usage: npm run db:seed
// ============================================================

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
  }

  const sqlText = readFileSync(resolve(process.cwd(), 'db/seed.sql'), 'utf8');
  const sql = neon(process.env.DATABASE_URL, { fullResults: false });

  const exec = async <T = unknown>(stmt: string): Promise<T> => {
    const fn = sql as unknown as ((s: string, params?: unknown[]) => Promise<T>) & {
      query?: (s: string, params?: unknown[]) => Promise<T>;
    };
    if (typeof fn.query === 'function') return await fn.query(stmt, []);
    return await fn(stmt, []);
  };

  // Per il seed (più semplice, no $$ blocks) split su ; in fine riga
  const statements = sqlText
    .split(/;\s*$/m)
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  console.log(`🌱 Seeding ${statements.length} rows...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!;
    try {
      await exec(stmt);
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
      console.log(`  ✓ [${i + 1}/${statements.length}] ${preview}...`);
    } catch (err) {
      console.error(`  ✗ [${i + 1}/${statements.length}] FAILED:`, (err as Error).message);
      process.exit(1);
    }
  }

  // Print summary
  const verticals = await exec<{ count: string }[]>('SELECT COUNT(*)::text as count FROM verticals');
  const buyers = await exec<{ count: string }[]>('SELECT COUNT(*)::text as count FROM buyers');

  console.log(`\n✅ Seed complete`);
  console.log(`   Verticals in DB: ${verticals[0]?.count ?? '?'}`);
  console.log(`   Buyers in DB: ${buyers[0]?.count ?? '?'}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
