// Quick utility — updates mock buyer URLs in DB to use container port
// Use only after seed (which has ON CONFLICT that doesn't refresh URLs)

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL, { fullResults: false });
  const exec = async <T = unknown>(s: string, p: unknown[] = []): Promise<T> => {
    const fn = sql as unknown as ((s: string, p?: unknown[]) => Promise<T>) & {
      query?: (s: string, p?: unknown[]) => Promise<T>;
    };
    if (typeof fn.query === 'function') return await fn.query(s, p);
    return await fn(s, p);
  };

  await exec(
    `UPDATE buyers SET
       ping_url = REPLACE(ping_url, 'localhost:3000', '127.0.0.1:3010'),
       post_url = REPLACE(post_url, 'localhost:3000', '127.0.0.1:3010')
     WHERE ping_url LIKE '%localhost:3000%' OR post_url LIKE '%localhost:3000%'`
  );

  const rows = await exec<Array<{ name: string; ping_url: string; post_url: string }>>(
    'SELECT name, ping_url, post_url FROM buyers ORDER BY name'
  );
  console.log('Buyers in DB:');
  for (const r of rows) {
    console.log(`  ${r.name}`);
    console.log(`    ping: ${r.ping_url}`);
    console.log(`    post: ${r.post_url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
