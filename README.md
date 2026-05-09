# Leadgen Engine — Multi-vertical Ping-Tree

Engine generico ping-tree riusabile per multipli vertical lead-gen. Alternativa self-built a Boberdoo / LeadProsper.

## Architettura

```
CORE ENGINE (vertical-agnostic):
  - Lead ingestion API           → POST /api/leads/:vertical
  - Schema validation (Zod)
  - Filter/qualifier engine
  - Parallel ping dispatcher
  - Auction resolver
  - Post dispatcher to winners
  - Postback handler             → POST /api/postback/:buyer
  - Audit log + TCPA vault

VERTICAL CONFIG (data, in DB):
  - Verticals     (schema + TCPA template)
  - Buyers        (filters + field mapping + endpoints)
  - Compliance    (state-specific overrides)
```

## Vertical attualmente configurati

- `elder-wealth` — Senior Wealth Protection (estate, advisor matching, LTC, reverse mortgage)

Altri vertical da abilitare aggiungendo righe in `verticals` + `buyers` (no codice).

## Quick start

```bash
# 1. Install deps
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL with your Neon connection string

# 3. Apply schema to DB
npm run db:apply

# 4. Seed initial vertical + buyer config
npm run db:seed

# 5. Start dev server
npm run dev
```

Server gira su http://localhost:3000.

## Endpoint principali

- `POST /api/leads/:vertical` — submit lead, triggers ping-tree
- `POST /api/postback/:buyer` — riceve postback dai buyer
- `GET /funnels/elder-wealth` — funnel UI di test (vertical 1)

## Struttura repo

```
db/
  schema.sql            — DDL completo
  seed.sql              — vertical + buyer seed
src/
  lib/
    db.ts               — Neon client
    types.ts            — shared TypeScript types
    validators.ts       — Zod schemas + JSON Schema runtime check
    ping-engine.ts      — core orchestration
    compliance.ts       — TCPA helpers
  app/
    api/leads/[vertical]/route.ts  — entry point
    api/postback/[buyer]/route.ts  — postback receiver
    funnels/elder-wealth/page.tsx  — test funnel UI
  components/
    QuizForm.tsx        — multi-step quiz UI
scripts/
  apply-schema.ts       — applies schema.sql to Neon
  seed.ts               — applies seed.sql
```

## Roadmap

- [x] Fase 1: Engine vertical-1 hardcoded (elder-wealth)
- [ ] Fase 2: Refactor multi-tenant (verticals come config)
- [ ] Fase 3: Aggiunta vertical solar, medicare, insurance
- [ ] Fase 4: White-label / SaaS optionality

## Note compliance

⚠️ TCPA exposure è reale. PRIMA di andare live in produzione:
- TrustedForm o Jornaya cert su OGNI lead
- Polizza E&O in vigore
- Privacy/Terms reviewed da avvocato TCPA-specialista
- One-to-One Consent (FCC Jan 2025) — un consenso per buyer, non lista generica
