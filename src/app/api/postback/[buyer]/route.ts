// ============================================================
// POST /api/postback/:buyer
// Riceve postback dai buyer (sale confirmed, fraud, ecc.)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ buyer: string }> }) {
  const { buyer: buyerSlug } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Risolvi buyer (per nome o ID)
  const buyer = await queryOne<{ id: string }>(
    `SELECT id FROM buyers WHERE LOWER(name) = LOWER($1) OR id::text = $1 LIMIT 1`,
    [buyerSlug]
  );
  if (!buyer) return NextResponse.json({ error: 'buyer_not_found' }, { status: 404 });

  // Estrai event + lead reference
  const event = (body.event as string) ?? 'sold';
  const buyerLeadId = (body.buyer_lead_id as string) ?? (body.lead_id as string) ?? null;
  const sourceLeadId = (body.source_lead_id as string) ?? null;
  const payoutActual = body.payout !== undefined ? Number(body.payout) : null;

  // Trova post relativo
  const post = await queryOne<{ id: string; lead_id: string; payout: string }>(
    `SELECT id, lead_id, payout FROM posts
     WHERE buyer_id = $1 AND (buyer_lead_id = $2 OR lead_id::text = $3)
     ORDER BY sent_at DESC LIMIT 1`,
    [buyer.id, buyerLeadId, sourceLeadId]
  );

  // Persist postback (anche se post non trovato, manteniamo audit)
  await query(
    `INSERT INTO postbacks (post_id, buyer_id, buyer_lead_id, event, payout_actual, source_ip, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [post?.id ?? null, buyer.id, buyerLeadId, event, payoutActual, ip, JSON.stringify(body)]
  );

  // Aggiorna stato post
  if (post) {
    if (event === 'sold' || event === 'confirmed') {
      await query(`UPDATE posts SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`, [post.id]);
    } else if (event === 'rejected' || event === 'fraud' || event === 'duplicate') {
      await query(`UPDATE posts SET status = $1 WHERE id = $2`, [event === 'rejected' ? 'rejected_postback' : event, post.id]);
      // Se rifiutato, sottrai payout dal lead total_revenue
      const currentPayout = parseFloat(post.payout);
      if (currentPayout > 0) {
        await query(
          `UPDATE leads SET total_revenue = GREATEST(0, total_revenue - $1) WHERE id = $2`,
          [currentPayout, post.lead_id]
        );
      }
    }
  }

  return NextResponse.json({ received: true, post_found: !!post });
}
