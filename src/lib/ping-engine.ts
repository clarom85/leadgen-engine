// ============================================================
// PING-TREE ENGINE — core orchestration
// Vertical-agnostic: opera su config in DB
// ============================================================

import { query, queryOne } from './db';
import { validateLeadData, normalizeLeadData } from './validators';
import { checkDuplicate, checkIpVelocity, isValidTrustedFormCert } from './compliance';
import type {
  Vertical,
  Buyer,
  BuyerFilters,
  LeadInput,
  PingResponse,
  AuctionResult,
  ProcessLeadResult
} from './types';

const DEFAULT_TIMEOUT_MS = parseInt(process.env.PING_TIMEOUT_MS ?? '2500', 10);

// ============================================================
// 1. ELIGIBILITY — filtra buyer compatibili PRIMA di pingare
// ============================================================
export function isBuyerEligible(leadData: Record<string, unknown>, filters: BuyerFilters): boolean {
  for (const [key, rule] of Object.entries(filters)) {
    // Range minimo (suffisso _min)
    if (key.endsWith('_min')) {
      const baseKey = key.slice(0, -4);
      const leadVal = Number(leadData[baseKey]);
      if (Number.isNaN(leadVal) || leadVal < Number(rule)) return false;
      continue;
    }
    // Range massimo (suffisso _max)
    if (key.endsWith('_max')) {
      const baseKey = key.slice(0, -4);
      const leadVal = Number(leadData[baseKey]);
      if (Number.isNaN(leadVal) || leadVal > Number(rule)) return false;
      continue;
    }
    // Lista di valori ammessi
    if (Array.isArray(rule)) {
      const leadVal = leadData[key];
      // Normalizza per confronto: stringa o boolean entrambi via String()
      const leadStr = leadVal === undefined || leadVal === null ? '' : String(leadVal);
      const ruleStrs = rule.map((r) => String(r));
      if (!ruleStrs.includes(leadStr)) return false;
      continue;
    }
    // Valore singolo (boolean / string / number) — match esatto
    if (leadData[key] !== rule) {
      // Tolleranza per boolean stringificati
      if (
        typeof rule === 'boolean' &&
        typeof leadData[key] === 'string' &&
        (leadData[key] as string).toLowerCase() === String(rule)
      ) {
        continue;
      }
      return false;
    }
  }
  return true;
}

// ============================================================
// 2. AUTH HEADERS — costruisci headers in base a auth_type
// ============================================================
function buildAuthHeaders(buyer: Buyer): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cfg = buyer.auth_config ?? {};

  switch (buyer.auth_type) {
    case 'bearer':
      if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`;
      break;
    case 'basic':
      if (cfg.username && cfg.password) {
        const encoded = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      break;
    case 'apikey':
      if (cfg.key) {
        const headerName = cfg.header ?? 'X-API-Key';
        headers[headerName] = cfg.key;
      }
      break;
    case 'hmac':
      // Implementazione HMAC dipende dal buyer specifico (caso per caso)
      break;
    case 'none':
    default:
      break;
  }
  return headers;
}

// ============================================================
// 3. FIELD MAPPING — traduzione nostri campi → loro nomenclatura
// ============================================================
function mapFields(
  leadData: Record<string, unknown>,
  mapping: Record<string, string>,
  includePII = true
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [ourField, theirField] of Object.entries(mapping)) {
    const value = leadData[ourField];
    if (value === undefined) continue;
    // PII fields skipped per ping (se includePII=false)
    if (!includePII && (ourField === 'phone' || ourField === 'email' || ourField === 'first_name' || ourField === 'last_name')) {
      continue;
    }
    out[theirField] = value;
  }
  return out;
}

// ============================================================
// 4. SINGLE PING with timeout
// ============================================================
async function pingBuyer(buyer: Buyer, leadData: Record<string, unknown>): Promise<{ response: PingResponse; duration_ms: number; raw_request: unknown; raw_response: unknown; status: number | null }> {
  const start = Date.now();
  const payload = mapFields(leadData, buyer.field_mapping, /*includePII=*/false);
  const headers = buildAuthHeaders(buyer);
  const timeoutMs = buyer.ping_timeout_ms ?? DEFAULT_TIMEOUT_MS;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(buyer.ping_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const duration = Date.now() - start;

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }

    if (!res.ok) {
      return {
        response: { accepted: false, bid: 0, reject_reason: `http_${res.status}` },
        duration_ms: duration,
        raw_request: payload,
        raw_response: body,
        status: res.status
      };
    }

    const b = body as { accepted?: boolean; bid?: number | string; reject_reason?: string; buyer_lead_id?: string };
    const bidNum = typeof b.bid === 'string' ? parseFloat(b.bid) : b.bid ?? 0;
    const cappedBid = buyer.max_bid !== null ? Math.min(bidNum, buyer.max_bid) : bidNum;

    return {
      response: {
        accepted: b.accepted === true && cappedBid > 0,
        bid: cappedBid,
        reject_reason: b.reject_reason,
        buyer_lead_id: b.buyer_lead_id
      },
      duration_ms: duration,
      raw_request: payload,
      raw_response: body,
      status: res.status
    };
  } catch (err) {
    clearTimeout(timer);
    const duration = Date.now() - start;
    const reason = (err as Error).name === 'AbortError' ? 'timeout' : `network_error_${(err as Error).message}`;
    return {
      response: { accepted: false, bid: 0, reject_reason: reason },
      duration_ms: duration,
      raw_request: payload,
      raw_response: null,
      status: null
    };
  }
}

// ============================================================
// 5. POST FULL LEAD to winner
// ============================================================
async function postLead(buyer: Buyer, leadData: Record<string, unknown>, bid: number, leadId: string, trustedformCert: string | null) {
  const payload = mapFields(leadData, buyer.field_mapping, /*includePII=*/true);
  if (trustedformCert) (payload as Record<string, unknown>).trustedform_cert = trustedformCert;
  (payload as Record<string, unknown>).source_lead_id = leadId;
  const headers = buildAuthHeaders(buyer);

  try {
    const res = await fetch(buyer.post_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    return {
      success: res.ok,
      payout: res.ok ? bid : 0,
      status: res.status,
      raw_request: payload,
      raw_response: body,
      buyer_lead_id: (body as { buyer_lead_id?: string })?.buyer_lead_id ?? null
    };
  } catch (err) {
    return {
      success: false,
      payout: 0,
      status: 0,
      raw_request: payload,
      raw_response: { error: (err as Error).message },
      buyer_lead_id: null
    };
  }
}

// ============================================================
// 6. TOP-LEVEL: processLead
// ============================================================
export async function processLead(input: LeadInput): Promise<ProcessLeadResult> {
  // 1) Load vertical config
  const vertical = await queryOne<Vertical>('SELECT * FROM verticals WHERE id = $1 AND active = true', [input.vertical_id]);
  if (!vertical) throw new Error(`vertical_not_found_or_inactive: ${input.vertical_id}`);

  // 2) Normalize + validate
  const data = normalizeLeadData(input.data);
  const validation = validateLeadData(data, vertical.schema);
  if (!validation.valid) throw new Error(`validation_failed: ${validation.errors.join('; ')}`);

  // 3) Compliance pre-checks
  const dupe = await checkDuplicate(data.email as string, data.phone as string, input.vertical_id);
  if (dupe.duplicate) {
    return {
      lead_id: dupe.existing_lead_id ?? '',
      status: 'duplicate',
      total_revenue: 0,
      winners: [],
      rejected_by: [],
      duplicate: true
    };
  }

  const ipCheck = await checkIpVelocity(input.ip_address);
  if (ipCheck.suspicious) {
    // Log e blocca (in produzione: review umana)
    throw new Error(`ip_velocity_suspicious: ${ipCheck.count} submissions in 24h`);
  }

  // 4) TrustedForm validation (warn, not block — produzione: blocca se mancante)
  if (input.trustedform_cert_url && !isValidTrustedFormCert(input.trustedform_cert_url)) {
    console.warn(`Invalid TrustedForm cert format: ${input.trustedform_cert_url}`);
  }

  // 5) Persist lead
  const leadRow = await queryOne<{ id: string }>(
    `INSERT INTO leads (
      vertical_id, status, email, phone, first_name, last_name, zip, state,
      raw_data, consent_text, trustedform_cert_url, jornaya_lead_id,
      ip_address, user_agent, source, utm_source, utm_medium, utm_campaign
    ) VALUES ($1, 'pinging', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id`,
    [
      input.vertical_id,
      data.email ?? null,
      data.phone ?? null,
      data.first_name ?? null,
      data.last_name ?? null,
      data.zip ?? null,
      data.state ?? null,
      JSON.stringify(data),
      input.consent_text,
      input.trustedform_cert_url ?? null,
      input.jornaya_lead_id ?? null,
      input.ip_address ?? null,
      input.user_agent ?? null,
      input.source ?? null,
      input.utm_source ?? null,
      input.utm_medium ?? null,
      input.utm_campaign ?? null
    ]
  );
  if (!leadRow) throw new Error('failed_to_insert_lead');
  const leadId = leadRow.id;

  // 6) Carica buyer attivi nel vertical
  const allBuyers = await query<Buyer>(
    `SELECT * FROM buyers WHERE active = true AND $1 = ANY(active_in_verticals)`,
    [input.vertical_id]
  );

  // 7) Filtra eligible
  const eligible = allBuyers.filter((b) => isBuyerEligible(data, b.filters));

  if (eligible.length === 0) {
    await query(`UPDATE leads SET status = 'no_eligible_buyers' WHERE id = $1`, [leadId]);
    return {
      lead_id: leadId,
      status: 'no_eligible_buyers',
      total_revenue: 0,
      winners: [],
      rejected_by: [],
      no_eligible_buyers: true
    };
  }

  // 8) Parallel ping
  const pingResults = await Promise.all(
    eligible.map(async (buyer): Promise<AuctionResult & { meta: Awaited<ReturnType<typeof pingBuyer>> }> => {
      const meta = await pingBuyer(buyer, data);
      return { buyer, response: meta.response, duration_ms: meta.duration_ms, meta };
    })
  );

  // 9) Persist pings (audit trail)
  for (const r of pingResults) {
    await query(
      `INSERT INTO pings (lead_id, buyer_id, vertical_id, response_at, response_status, accepted, bid, reject_reason, raw_request, raw_response, duration_ms)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10)`,
      [
        leadId,
        r.buyer.id,
        input.vertical_id,
        r.meta.status,
        r.response.accepted,
        r.response.bid,
        r.response.reject_reason ?? null,
        JSON.stringify(r.meta.raw_request),
        JSON.stringify(r.meta.raw_response),
        r.duration_ms
      ]
    );
  }

  // 10) Resolve auction: prendi accepted ordinati per bid desc
  const accepted = pingResults
    .filter((r) => r.response.accepted)
    .sort((a, b) => b.response.bid - a.response.bid);

  const rejected = pingResults
    .filter((r) => !r.response.accepted)
    .map((r) => ({ buyer_name: r.buyer.name, reason: r.response.reject_reason ?? 'unknown' }));

  if (accepted.length === 0) {
    await query(`UPDATE leads SET status = 'rejected_all' WHERE id = $1`, [leadId]);
    return {
      lead_id: leadId,
      status: 'rejected_all',
      total_revenue: 0,
      winners: [],
      rejected_by: rejected
    };
  }

  // 11) Determina winners: se top è exclusive, solo lui; altrimenti tutti i non-exclusive accepted
  const top = accepted[0]!;
  let winners: typeof accepted;
  if (top.buyer.exclusive) {
    winners = [top];
  } else {
    winners = accepted.filter((a) => !a.buyer.exclusive);
  }

  // 12) Post a tutti i winners
  const postResults = await Promise.all(
    winners.map(async (w) => {
      const post = await postLead(w.buyer, data, w.response.bid, leadId, input.trustedform_cert_url ?? null);
      // Persist post
      await query(
        `INSERT INTO posts (lead_id, buyer_id, payout, status, buyer_lead_id, raw_request, raw_response)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          leadId,
          w.buyer.id,
          post.success ? w.response.bid : 0,
          post.success ? 'pending' : 'rejected_postback',
          post.buyer_lead_id,
          JSON.stringify(post.raw_request),
          JSON.stringify(post.raw_response)
        ]
      );
      return { buyer_name: w.buyer.name, payout: post.success ? w.response.bid : 0, success: post.success };
    })
  );

  const totalRevenue = postResults.reduce((sum, p) => sum + p.payout, 0);

  // 13) Aggiorna lead final state
  await query(`UPDATE leads SET status = 'sold', total_revenue = $1 WHERE id = $2`, [totalRevenue, leadId]);

  return {
    lead_id: leadId,
    status: 'sold',
    total_revenue: totalRevenue,
    winners: postResults,
    rejected_by: rejected
  };
}
