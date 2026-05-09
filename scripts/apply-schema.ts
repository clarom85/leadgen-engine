// ============================================================
// Applica db/schema.sql al DB Neon
// Usage: npm run db:apply
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

  const sqlText = readFileSync(resolve(process.cwd(), 'db/schema.sql'), 'utf8');
  const sql = neon(process.env.DATABASE_URL);

  // Split su statement-terminator preservando dollar-quoted blocks ($$...$$)
  const statements = splitSqlStatements(sqlText);
  console.log(`📦 Applying ${statements.length} statements to DB...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]!.trim();
    if (!stmt) continue;
    try {
      await (sql as unknown as { query: (s: string) => Promise<unknown> }).query(stmt);
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
      console.log(`  ✓ [${i + 1}/${statements.length}] ${preview}...`);
    } catch (err) {
      console.error(`  ✗ [${i + 1}/${statements.length}] FAILED:`, (err as Error).message);
      console.error(`     Statement: ${stmt.slice(0, 200)}`);
      process.exit(1);
    }
  }

  console.log('✅ Schema applied successfully');
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let i = 0;

  while (i < sql.length) {
    // Skip line comments
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    // Detect $$ dollar quotes
    if (sql[i] === '$' && sql[i + 1] === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i += 2;
      continue;
    }
    // Statement terminator
    if (sql[i] === ';' && !inDollarQuote) {
      if (current.trim()) statements.push(current);
      current = '';
      i++;
      continue;
    }
    current += sql[i];
    i++;
  }
  if (current.trim()) statements.push(current);
  return statements;
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
