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
  const sql = neon(process.env.DATABASE_URL);

  // Per il seed (più semplice, no $$ blocks) split su ; in fine riga
  const statements = sqlText
    .split(/;\s*$/m)
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => s.length > 0);

  console.log(`🌱 Seeding ${statements.length} rows...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!;
    try {
      await (sql as unknown as { query: (s: string) => Promise<unknown> }).query(stmt);
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
      console.log(`  ✓ [${i + 1}/${statements.length}] ${preview}...`);
    } catch (err) {
      console.error(`  ✗ [${i + 1}/${statements.length}] FAILED:`, (err as Error).message);
      process.exit(1);
    }
  }

  // Print summary
  const verticals = (await (sql as unknown as { query: (s: string) => Promise<{ count: string }[]> }).query(
    'SELECT COUNT(*)::text as count FROM verticals'
  ))[0];
  const buyers = (await (sql as unknown as { query: (s: string) => Promise<{ count: string }[]> }).query(
    'SELECT COUNT(*)::text as count FROM buyers'
  ))[0];

  console.log(`\n✅ Seed complete`);
  console.log(`   Verticals in DB: ${verticals?.count ?? '?'}`);
  console.log(`   Buyers in DB: ${buyers?.count ?? '?'}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
