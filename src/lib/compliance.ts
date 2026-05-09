// ============================================================
// Compliance helpers — TCPA cert, dupe-check, fraud signals
// ============================================================

import { queryOne } from './db';

/**
 * Verifica se un lead è un duplicato negli ultimi N giorni
 * Match su email OR phone (uno dei due basta).
 */
export async function checkDuplicate(
  email: string | null | undefined,
  phone: string | null | undefined,
  verticalId: string,
  windowDays = 30
): Promise<{ duplicate: boolean; existing_lead_id?: string }> {
  if (!email && !phone) return { duplicate: false };

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (email) {
    conditions.push(`email = $${paramIdx++}`);
    params.push(email);
  }
  if (phone) {
    conditions.push(`phone = $${paramIdx++}`);
    params.push(phone);
  }

  params.push(verticalId);
  const verticalParam = paramIdx++;

  params.push(windowDays);
  const daysParam = paramIdx++;

  const queryText = `
    SELECT id FROM leads
    WHERE (${conditions.join(' OR ')})
      AND vertical_id = $${verticalParam}
      AND created_at > NOW() - ($${daysParam} || ' days')::interval
      AND status NOT IN ('rejected_all', 'no_eligible_buyers')
    LIMIT 1
  `;

  const existing = await queryOne<{ id: string }>(queryText, params);
  return existing ? { duplicate: true, existing_lead_id: existing.id } : { duplicate: false };
}

/**
 * Verifica TrustedForm cert URL (formato base — produzione richiede claim API)
 * In produzione: chiamare ActiveProspect API per verificare validità del cert
 * https://activeprospect.com/products/trustedform/
 */
export function isValidTrustedFormCert(url: string | null | undefined): boolean {
  if (!url) return false;
  // TrustedForm certs hanno formato: https://cert.trustedform.com/<hash>
  return /^https:\/\/cert\.trustedform\.com\/[a-f0-9]{40,}$/i.test(url);
}

/**
 * Genera testo TCPA finale — sostituisce {{buyers}} con lista buyer specifici.
 * Per One-to-One Consent (FCC Jan 2025): è raccomandato menzionare buyer per nome
 * piuttosto che riferirsi a "marketing partners" generici.
 *
 * Use:
 *   const text = renderTcpaText(vertical.tcpa_template, ['SmartAsset', 'Trust & Will']);
 *   // Sostituisce qualsiasi occorrenza di "{{buyers}}" o "marketing partners"
 *
 * Se buyerNames è vuoto/undefined, ritorna il template invariato.
 */
export function renderTcpaText(template: string, buyerNames?: string[]): string {
  if (!buyerNames || buyerNames.length === 0) return template;
  const list = formatBuyerList(buyerNames);
  return template.replace(/\{\{buyers\}\}/g, list);
}

function formatBuyerList(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Claim TrustedForm cert post-submission (server-side).
 * Best practice: chiamare entro 72h dalla cattura per ottenere copia retainer.
 *
 * No-op se TRUSTEDFORM_API_KEY non è settato. Errori vengono loggati ma NON
 * bloccano il flow (il lead è già stato registrato).
 */
export async function claimTrustedFormCert(
  certUrl: string,
  reference?: { lead_id?: string; vertical?: string }
): Promise<{ claimed: boolean; reason?: string }> {
  const apiKey = process.env.TRUSTEDFORM_API_KEY;
  if (!apiKey) return { claimed: false, reason: 'no_api_key' };
  if (!isValidTrustedFormCert(certUrl)) return { claimed: false, reason: 'invalid_cert_format' };

  // ActiveProspect uses HTTP basic auth: any-username:api-key
  const auth = Buffer.from(`API:${apiKey}`).toString('base64');

  try {
    const res = await fetch(certUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        reference: reference?.lead_id ?? '',
        vendor: reference?.vertical ?? 'leadgen-engine'
      }).toString()
    });
    if (!res.ok) {
      console.warn(`TrustedForm claim failed: HTTP ${res.status} for ${certUrl}`);
      return { claimed: false, reason: `http_${res.status}` };
    }
    return { claimed: true };
  } catch (err) {
    console.warn(`TrustedForm claim error: ${(err as Error).message}`);
    return { claimed: false, reason: 'network_error' };
  }
}

/**
 * Basic fraud signal — IP velocity (numero submission da stesso IP ultime 24h)
 */
export async function checkIpVelocity(
  ipAddress: string | null | undefined,
  thresholdPerDay = 10
): Promise<{ suspicious: boolean; count: number }> {
  if (!ipAddress) return { suspicious: false, count: 0 };
  const row = await queryOne<{ cnt: string }>(
    `SELECT COUNT(*)::text as cnt FROM leads WHERE ip_address = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [ipAddress]
  );
  const count = parseInt(row?.cnt ?? '0', 10);
  return { suspicious: count > thresholdPerDay, count };
}
