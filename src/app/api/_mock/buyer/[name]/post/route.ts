// ============================================================
// MOCK BUYER POST ENDPOINT — solo per testing locale
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  // Simula latency
  await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 600)));

  // Simula 95% success rate sui post
  if (Math.random() < 0.05) {
    return NextResponse.json({ success: false, error: 'post_validation_failed' }, { status: 400 });
  }

  const buyerLeadId = `${name.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  return NextResponse.json({
    success: true,
    buyer_lead_id: buyerLeadId,
    received_data: Object.keys(body).length
  });
}
