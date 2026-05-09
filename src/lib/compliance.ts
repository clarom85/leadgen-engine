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
 * Genera testo TCPA finale — sostituisce placeholder con buyer specifici se serve
 * Per One-to-One Consent (FCC Jan 2025): NON includere buyer multipli nello stesso consenso.
 * Idealmente, ogni buyer ha il suo consenso esplicito.
 */
export function renderTcpaText(template: string, _buyerNames?: string[]): string {
  return template;
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
