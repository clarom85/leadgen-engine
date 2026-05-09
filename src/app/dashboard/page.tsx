// ============================================================
// Mini dashboard — vista lead recenti + analytics base
// ============================================================

import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface LeadRow {
  id: string;
  vertical_id: string;
  status: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  total_revenue: string;
  created_at: Date;
}

interface BuyerStat {
  buyer_name: string;
  pings: string;
  accepted: string;
  total_payout: string;
}

export default async function Dashboard() {
  let recentLeads: LeadRow[] = [];
  let buyerStats: BuyerStat[] = [];
  let totalRevenue = 0;
  let dbError: string | null = null;

  try {
    recentLeads = await query<LeadRow>(`
      SELECT id, vertical_id, status, email, phone, state, total_revenue, created_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 50
    `);

    buyerStats = await query<BuyerStat>(`
      SELECT
        b.name as buyer_name,
        COUNT(p.id)::text as pings,
        COUNT(p.id) FILTER (WHERE p.accepted = true)::text as accepted,
        COALESCE(SUM(po.payout), 0)::text as total_payout
      FROM buyers b
      LEFT JOIN pings p ON p.buyer_id = b.id
      LEFT JOIN posts po ON po.buyer_id = b.id AND po.status IN ('pending','confirmed')
      GROUP BY b.id, b.name
      ORDER BY total_payout DESC
    `);

    const totalRow = await query<{ total: string }>(`SELECT COALESCE(SUM(total_revenue), 0)::text as total FROM leads`);
    totalRevenue = parseFloat(totalRow[0]?.total ?? '0');
  } catch (err) {
    dbError = (err as Error).message;
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-bold mb-8">Leadgen Engine — Dashboard</h1>

      {dbError && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded mb-6">
          <strong>DB error:</strong> {dbError}
          <div className="text-sm mt-2">Did you run <code>npm run db:apply</code> and <code>npm run db:seed</code>?</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Total revenue" value={`$${totalRevenue.toFixed(2)}`} />
        <Stat label="Leads" value={recentLeads.length.toString()} />
        <Stat label="Active buyers" value={buyerStats.length.toString()} />
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Buyer performance</h2>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-3">Buyer</th>
                <th className="text-right p-3">Pings</th>
                <th className="text-right p-3">Accepted</th>
                <th className="text-right p-3">Accept rate</th>
                <th className="text-right p-3">Total payout</th>
              </tr>
            </thead>
            <tbody>
              {buyerStats.map((b) => {
                const pings = parseInt(b.pings, 10);
                const accepted = parseInt(b.accepted, 10);
                const rate = pings > 0 ? ((accepted / pings) * 100).toFixed(0) : '—';
                return (
                  <tr key={b.buyer_name} className="border-t">
                    <td className="p-3 font-medium">{b.buyer_name}</td>
                    <td className="p-3 text-right">{pings}</td>
                    <td className="p-3 text-right">{accepted}</td>
                    <td className="p-3 text-right">{rate}%</td>
                    <td className="p-3 text-right font-mono">${parseFloat(b.total_payout).toFixed(2)}</td>
                  </tr>
                );
              })}
              {buyerStats.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No buyers configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Recent leads</h2>
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Vertical</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">State</th>
                <th className="text-left p-3">Email</th>
                <th className="text-right p-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 text-slate-500 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="p-3">{l.vertical_id}</td>
                  <td className="p-3">
                    <span className={statusClass(l.status)}>{l.status}</span>
                  </td>
                  <td className="p-3">{l.state ?? '—'}</td>
                  <td className="p-3 font-mono text-xs">{l.email ?? '—'}</td>
                  <td className="p-3 text-right font-mono">${parseFloat(l.total_revenue).toFixed(2)}</td>
                </tr>
              ))}
              {recentLeads.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No leads yet — submit one via the funnel</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function statusClass(status: string): string {
  const base = 'px-2 py-0.5 rounded text-xs font-medium';
  if (status === 'sold') return `${base} bg-green-100 text-green-800`;
  if (status === 'rejected_all' || status === 'no_eligible_buyers') return `${base} bg-red-100 text-red-800`;
  if (status === 'duplicate') return `${base} bg-yellow-100 text-yellow-800`;
  return `${base} bg-slate-100 text-slate-700`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
