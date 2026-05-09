// ============================================================
// Data-driven funnel — legge funnel_config dal DB per ogni vertical
// Server Component: fetch + 404 handling + pass config al client
// ============================================================

import { notFound } from 'next/navigation';
import { query, queryOne } from '@/lib/db';
import { renderTcpaText } from '@/lib/compliance';
import FunnelClient from './FunnelClient';
import type { FunnelConfig } from './types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VerticalRow = {
  id: string;
  name: string;
  active: boolean;
  tcpa_template: string;
  funnel_config: FunnelConfig | null;
};

export async function generateMetadata({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;
  const v = await queryOne<VerticalRow>(
    `SELECT id, name FROM verticals WHERE id = $1 AND active = true`,
    [vertical]
  );
  if (!v) return { title: 'Not found' };
  return { title: `${v.name} — Get matched today` };
}

export default async function VerticalFunnelPage({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical } = await params;

  const v = await queryOne<VerticalRow>(
    `SELECT id, name, active, tcpa_template, funnel_config
       FROM verticals
      WHERE id = $1 AND active = true`,
    [vertical]
  );

  if (!v || !v.funnel_config) notFound();

  // Carica i buyer attivi su questo vertical per il One-to-One Consent.
  // Il consent text mostrato all'utente conterrà la lista dei buyer
  // a cui il lead potrebbe essere venduto.
  const activeBuyers = await query<{ display_name: string | null; name: string }>(
    `SELECT name, display_name
       FROM buyers
      WHERE active = true
        AND $1 = ANY(active_in_verticals)
      ORDER BY display_name NULLS LAST, name`,
    [v.id]
  );
  const buyerNames = activeBuyers
    .map((b) => b.display_name?.trim() || b.name)
    .filter(Boolean);

  const tcpaText = renderTcpaText(v.tcpa_template, buyerNames);

  return (
    <FunnelClient
      verticalId={v.id}
      verticalName={v.name}
      tcpaText={tcpaText}
      config={v.funnel_config}
    />
  );
}
