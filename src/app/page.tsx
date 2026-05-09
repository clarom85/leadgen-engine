import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold mb-2">Leadgen Engine</h1>
      <p className="text-slate-600 mb-8">Multi-vertical ping-tree platform — local dev environment.</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Funnel disponibili</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/funnels/elder-wealth" className="text-brand-600 hover:underline">
              → Elder Wealth Protection (vertical 1)
            </Link>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">API endpoints</h2>
        <ul className="space-y-1 font-mono text-sm">
          <li><code>POST /api/leads/[vertical]</code> — submit lead, trigger ping-tree</li>
          <li><code>POST /api/postback/[buyer]</code> — receive buyer postback</li>
          <li><code>POST /api/_mock/buyer/[name]/ping</code> — mock buyer (testing only)</li>
          <li><code>POST /api/_mock/buyer/[name]/post</code> — mock buyer (testing only)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Setup status</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Copy <code>.env.example</code> to <code>.env</code> and set <code>DATABASE_URL</code></li>
          <li>Run <code>npm run db:apply</code> to create schema</li>
          <li>Run <code>npm run db:seed</code> to seed elder-wealth + 4 mock buyers</li>
          <li>Submit a test lead via the funnel above</li>
        </ol>
      </section>
    </main>
  );
}
