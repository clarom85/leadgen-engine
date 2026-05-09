-- ============================================================
-- Leadgen Engine — Multi-vertical Ping-Tree Schema
-- Postgres 14+ (testato su Neon serverless)
-- ============================================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- VERTICALS — config table (1 riga per vertical attivo)
-- ============================================================
CREATE TABLE IF NOT EXISTS verticals (
  id              TEXT PRIMARY KEY,                 -- 'elder-wealth', 'solar', 'medicare-advantage'
  name            TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  schema          JSONB NOT NULL,                   -- JSON Schema-style validation rules
  tcpa_template   TEXT NOT NULL,                    -- testo TCPA standard per il vertical
  funnel_config   JSONB,                            -- step config UI multi-step
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BUYERS — i compratori (SmartAsset, Trust & Will, ecc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS buyers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT NOT NULL UNIQUE,
  active                BOOLEAN NOT NULL DEFAULT true,
  active_in_verticals   TEXT[] NOT NULL,            -- ['elder-wealth'] o ['solar', 'home-improvement']
  ping_url              TEXT NOT NULL,
  post_url              TEXT NOT NULL,
  auth_type             TEXT NOT NULL,              -- 'bearer' | 'basic' | 'apikey' | 'hmac' | 'none'
  auth_config           JSONB,                      -- credenziali (encrypted at app layer if production)
  field_mapping         JSONB NOT NULL,             -- nostri campi → loro campi
  filters               JSONB NOT NULL DEFAULT '{}',-- filtri eligibility (es. {state: ['CA','NY'], age_min: 50})
  exclusive             BOOLEAN NOT NULL DEFAULT false,  -- se true, vince solo lui (no shared)
  max_bid               NUMERIC(10,2),              -- safety cap su bid accettato
  ping_timeout_ms       INTEGER NOT NULL DEFAULT 2500,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyers_active ON buyers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_buyers_verticals ON buyers USING GIN (active_in_verticals);

-- Display name pubblico (One-to-One Consent FCC) — aggiunto post-MVP, idempotente.
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ============================================================
-- LEADS — ogni submission del funnel
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vertical_id           TEXT NOT NULL REFERENCES verticals(id),
  status                TEXT NOT NULL DEFAULT 'new',-- 'new'|'pinging'|'sold'|'no_eligible_buyers'|'rejected_all'|'duplicate'
  email                 TEXT,
  phone                 TEXT,
  first_name            TEXT,
  last_name             TEXT,
  zip                   TEXT,
  state                 TEXT,
  raw_data              JSONB NOT NULL,             -- tutti i campi originali del quiz
  consent_text          TEXT NOT NULL,              -- TCPA disclosure text mostrato
  trustedform_cert_url  TEXT,
  jornaya_lead_id       TEXT,
  ip_address            INET,
  user_agent            TEXT,
  source                TEXT,                       -- 'organic' | 'paid_meta' | 'paid_native' | ecc.
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  total_revenue         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_vertical_created ON leads(vertical_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
-- Per dupe-check veloce su email+phone negli ultimi N giorni
CREATE INDEX IF NOT EXISTS idx_leads_dedup ON leads(email, phone, created_at);

-- ============================================================
-- PINGS — log di ogni ping inviato (audit + analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS pings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES buyers(id),
  vertical_id       TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_at       TIMESTAMPTZ,
  response_status   INTEGER,                        -- HTTP status code
  accepted          BOOLEAN NOT NULL DEFAULT false,
  bid               NUMERIC(10,2) NOT NULL DEFAULT 0,
  reject_reason     TEXT,
  raw_request       JSONB,
  raw_response      JSONB,
  duration_ms       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pings_lead ON pings(lead_id);
CREATE INDEX IF NOT EXISTS idx_pings_buyer_sent ON pings(buyer_id, sent_at DESC);

-- ============================================================
-- POSTS — vendita effettiva conclusa al/ai winner
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id           UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES buyers(id),
  ping_id           UUID REFERENCES pings(id),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payout            NUMERIC(10,2) NOT NULL,         -- prezzo bid accettato
  status            TEXT NOT NULL DEFAULT 'pending',-- 'pending'|'confirmed'|'rejected_postback'|'fraud'|'duplicate'
  buyer_lead_id     TEXT,                           -- ID assegnato dal buyer (per riconciliare postback)
  raw_request       JSONB,
  raw_response      JSONB,
  confirmed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_lead ON posts(lead_id);
CREATE INDEX IF NOT EXISTS idx_posts_buyer ON posts(buyer_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- ============================================================
-- POSTBACKS — eventi inviati dai buyer (sale confirmed, rejection, ecc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS postbacks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id         UUID REFERENCES posts(id) ON DELETE SET NULL,
  buyer_id        UUID REFERENCES buyers(id),
  buyer_lead_id   TEXT,                             -- per matching
  event           TEXT NOT NULL,                    -- 'sold'|'rejected'|'duplicate'|'fraud'|'callback_completed'
  payout_actual   NUMERIC(10,2),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_ip       INET,
  raw             JSONB
);

CREATE INDEX IF NOT EXISTS idx_postbacks_post ON postbacks(post_id);
CREATE INDEX IF NOT EXISTS idx_postbacks_buyer_lead ON postbacks(buyer_id, buyer_lead_id);

-- ============================================================
-- AUDIT — log raw di richieste /api per dispute resolution
-- ============================================================
CREATE TABLE IF NOT EXISTS api_audit (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  headers         JSONB,
  body            JSONB,
  response_status INTEGER,
  response_body   JSONB,
  lead_id         UUID,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_lead ON api_audit(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON api_audit(created_at DESC);

-- ============================================================
-- TRIGGER updated_at automatico
-- ============================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verticals_updated_at ON verticals;
CREATE TRIGGER verticals_updated_at BEFORE UPDATE ON verticals
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS buyers_updated_at ON buyers;
CREATE TRIGGER buyers_updated_at BEFORE UPDATE ON buyers
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
