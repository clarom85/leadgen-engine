// ============================================================
// POST /api/leads/:vertical
// Entry point: riceve form submission, triggers ping-tree
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { processLead } from '@/lib/ping-engine';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ vertical: string }> }) {
  const start = Date.now();
  const { vertical } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null;
  const userAgent = req.headers.get('user-agent') ?? null;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Audit raw request
  await query(
    `INSERT INTO api_audit (endpoint, method, ip_address, user_agent, body, created_at)
     VALUES ($1, 'POST', $2, $3, $4, NOW())`,
    [`/api/leads/${vertical}`, ip, userAgent, JSON.stringify(body)]
  ).catch((e) => console.error('audit failed:', e));

  // Estrai i campi attesi (consent_text + dati lead)
  const consentText = (body.consent_text as string) ?? '';
  const leadData = (body.data as Record<string, unknown>) ?? body; // accetta sia { data: {...} } sia flat

  if (!consentText) {
    return NextResponse.json({ error: 'consent_text_required' }, { status: 400 });
  }

  try {
    const result = await processLead({
      vertical_id: vertical,
      data: leadData,
      consent_text: consentText,
      trustedform_cert_url: body.trustedform_cert_url as string | undefined,
      jornaya_lead_id: body.jornaya_lead_id as string | undefined,
      ip_address: ip ?? undefined,
      user_agent: userAgent ?? undefined,
      source: body.source as string | undefined,
      utm_source: body.utm_source as string | undefined,
      utm_medium: body.utm_medium as string | undefined,
      utm_campaign: body.utm_campaign as string | undefined
    });

    const duration = Date.now() - start;
    return NextResponse.json(
      {
        success: result.status === 'sold' || result.status === 'duplicate',
        lead_id: result.lead_id,
        status: result.status,
        total_revenue: result.total_revenue,
        winners_count: result.winners.length,
        duration_ms: duration
      },
      { status: 200 }
    );
  } catch (err) {
    const message = (err as Error).message;
    console.error('processLead error:', message);
    const status = message.startsWith('vertical_not_found') ? 404 : message.startsWith('validation_failed') ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
