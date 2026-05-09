// ============================================================
// MOCK BUYER PING ENDPOINT — solo per testing locale
// In produzione: questi sarebbero endpoint reali esterni
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Simula bid randomizzato per ogni buyer mock con logica diversa
const MOCK_BIDS: Record<string, () => { accepted: boolean; bid: number; reject_reason?: string }> = {
  smartasset: () => {
    // Alta soglia: accetta solo 60% dei lead, paga $120-300
    if (Math.random() < 0.4) return { accepted: false, bid: 0, reject_reason: 'asset_threshold_not_met' };
    return { accepted: true, bid: 120 + Math.floor(Math.random() * 180) };
  },
  trustwill: () => {
    // Quasi tutti accettati, payout fisso $30-60
    if (Math.random() < 0.1) return { accepted: false, bid: 0, reject_reason: 'duplicate_in_their_db' };
    return { accepted: true, bid: 30 + Math.floor(Math.random() * 30) };
  },
  aag: () => {
    // 50% rifiutati (criteri stretti age 62+), payout $80-150
    if (Math.random() < 0.5) return { accepted: false, bid: 0, reject_reason: 'age_or_homeowner_check_failed' };
    return { accepted: true, bid: 80 + Math.floor(Math.random() * 70) };
  },
  'mutual-ltc': () => {
    if (Math.random() < 0.35) return { accepted: false, bid: 0, reject_reason: 'no_active_campaign_in_state' };
    return { accepted: true, bid: 60 + Math.floor(Math.random() * 60) };
  }
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const _body = await req.json().catch(() => ({}));

  // Simula latency realistica (300-1500ms)
  await new Promise((r) => setTimeout(r, 300 + Math.floor(Math.random() * 1200)));

  const handler = MOCK_BIDS[name.toLowerCase()];
  if (!handler) {
    return NextResponse.json({ accepted: false, bid: 0, reject_reason: 'unknown_buyer' }, { status: 404 });
  }

  const result = handler();
  return NextResponse.json({
    ...result,
    buyer_lead_id: result.accepted ? `${name.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 9999)}` : undefined
  });
}
