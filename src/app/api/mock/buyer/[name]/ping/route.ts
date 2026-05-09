// ============================================================
// MOCK BUYER PING ENDPOINT — solo per testing locale
// Disabilitato di default in prod: gate dietro LEADGEN_MOCK_BUYERS=true
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MOCKS_ENABLED = process.env.LEADGEN_MOCK_BUYERS === 'true';

type BidResult = { accepted: boolean; bid: number; reject_reason?: string };

// Logiche dedicate per i mock buyer più "tipici" del seed.
// I nuovi mock buyer (sunrun-style, quotewizard-auto, ecc.) cadono nel fallback per-vertical.
const MOCK_BIDS: Record<string, () => BidResult> = {
  smartasset: () => {
    if (Math.random() < 0.4) return { accepted: false, bid: 0, reject_reason: 'asset_threshold_not_met' };
    return { accepted: true, bid: 120 + Math.floor(Math.random() * 180) };
  },
  trustwill: () => {
    if (Math.random() < 0.1) return { accepted: false, bid: 0, reject_reason: 'duplicate_in_their_db' };
    return { accepted: true, bid: 30 + Math.floor(Math.random() * 30) };
  },
  aag: () => {
    if (Math.random() < 0.5) return { accepted: false, bid: 0, reject_reason: 'age_or_homeowner_check_failed' };
    return { accepted: true, bid: 80 + Math.floor(Math.random() * 70) };
  },
  'mutual-ltc': () => {
    if (Math.random() < 0.35) return { accepted: false, bid: 0, reject_reason: 'no_active_campaign_in_state' };
    return { accepted: true, bid: 60 + Math.floor(Math.random() * 60) };
  }
};

// Fallback per-vertical inferito dal nome del buyer.
function fallbackByName(name: string): BidResult {
  const n = name.toLowerCase();
  // Solar
  if (n.includes('sunrun') || n.includes('solar')) {
    if (Math.random() < 0.3) return { accepted: false, bid: 0, reject_reason: 'no_active_campaign_in_zip' };
    return { accepted: true, bid: 30 + Math.floor(Math.random() * 50) };
  }
  // Medicare
  if (n.includes('selectquote') || n.includes('healthmarkets') || n.includes('medicare')) {
    if (Math.random() < 0.25) return { accepted: false, bid: 0, reject_reason: 'age_or_state_filter' };
    return { accepted: true, bid: 18 + Math.floor(Math.random() * 30) };
  }
  // Auto insurance
  if (n.includes('quotewizard') || n.includes('zebra') || n.includes('auto')) {
    if (Math.random() < 0.2) return { accepted: false, bid: 0, reject_reason: 'state_not_active' };
    return { accepted: true, bid: 8 + Math.floor(Math.random() * 12) };
  }
  // Home services
  if (n.includes('homeadvisor') || n.includes('modernize') || n.includes('home')) {
    if (Math.random() < 0.2) return { accepted: false, bid: 0, reject_reason: 'no_pro_in_zip' };
    return { accepted: true, bid: 18 + Math.floor(Math.random() * 20) };
  }
  // Mass tort
  if (n.includes('verus') || n.includes('legal') || n.includes('intake')) {
    if (Math.random() < 0.4) return { accepted: false, bid: 0, reject_reason: 'criteria_not_met' };
    return { accepted: true, bid: 50 + Math.floor(Math.random() * 170) };
  }
  // Default generico
  if (Math.random() < 0.3) return { accepted: false, bid: 0, reject_reason: 'generic_filter_failed' };
  return { accepted: true, bid: 15 + Math.floor(Math.random() * 35) };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  if (!MOCKS_ENABLED) {
    return NextResponse.json({ error: 'mock_buyers_disabled' }, { status: 404 });
  }
  const { name } = await ctx.params;
  const _body = await req.json().catch(() => ({}));

  // Simula latency realistica (300-1500ms)
  await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 1200)));

  const handler = MOCK_BIDS[name.toLowerCase()];
  const result: BidResult = handler ? handler() : fallbackByName(name);
  return NextResponse.json({
    ...result,
    buyer_lead_id: result.accepted ? `${name.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 9999)}` : undefined
  });
}
