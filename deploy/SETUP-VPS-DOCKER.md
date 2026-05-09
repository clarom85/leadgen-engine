# VPS Deploy via Docker — Leadgen Engine

Deploy come servizio Docker sulla stessa VPS di Astraze (`91.98.85.227`), connesso alla network `astro-funnel_default` per essere routato dal container `astro-funnel-nginx-1` esistente.

**Subdomain**: `leadgen.trackitwhen.com`
**Porta interna container**: `3010`
**Network**: `astro-funnel_default` (già esistente)

---

## Pre-requisiti già verificati

✅ DNS Cloudflare `leadgen.trackitwhen.com` → 91.98.85.227 (proxy off)
✅ VPS ha Docker, Docker Compose, certbot, nginx-in-container
✅ Network `astro-funnel_default` esiste
✅ Webroot certbot `/var/www/certbot-webroot/` configurato

---

## Step 1 — SSH e clone

```bash
ssh root@91.98.85.227
mkdir -p /opt/leadgen-engine
cd /opt
git clone https://github.com/clarom85/leadgen-engine.git
cd leadgen-engine
```

## Step 2 — Configura .env

```bash
cp .env.example .env
nano .env
```

Compila `DATABASE_URL` con stringa Neon.

## Step 3 — SSL certificate via certbot (BEFORE starting nginx config)

Importante: ottieni il cert PRIMA di abilitare la nginx config (altrimenti nginx fallisce all'avvio per cert mancante).

```bash
certbot certonly \
  --webroot -w /var/www/certbot-webroot \
  -d leadgen.trackitwhen.com \
  --email contact@vireonmedia.com \
  --agree-tos --non-interactive
```

Output atteso: `Successfully received certificate.`
Cert finisce in `/etc/letsencrypt/live/leadgen.trackitwhen.com/`

## Step 4 — Build + start container leadgen-engine

```bash
cd /opt/leadgen-engine
docker compose build
docker compose up -d
```

Verifica:
```bash
docker ps | grep leadgen-engine
docker logs leadgen-engine --tail 30
```

App in ascolto su `127.0.0.1:3010` e raggiungibile come `http://leadgen-engine:3010` dalla network condivisa.

## Step 5 — Apply schema DB e seed

Dal container:
```bash
docker exec -it leadgen-engine sh -c "cd /app && node -e \"require('./scripts/apply-schema.ts')\""
```

Oppure semplicer da host (richiede npm + tsx in locale, o:
```bash
docker exec -it leadgen-engine sh -c "cd /app && npx tsx scripts/apply-schema.ts && npx tsx scripts/seed.ts"
```

## Step 6 — Aggiungi nginx config al container astro-funnel-nginx-1

Il container nginx esistente monta config da volumi. Aggiungiamo il nostro:

```bash
# Symlink config dal repo a path stabile
cp /opt/leadgen-engine/deploy/nginx-leadgen-docker.conf /opt/leadgen-engine/nginx-leadgen.conf
```

Modifica `/root/astro-funnel/docker-compose.yml` per aggiungere il volume mount al servizio nginx:

```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf
    - /var/www/datingrewired-api/nginx-api.conf:/etc/nginx/conf.d/datingrewired-api.conf:ro
    - /var/www/datingrewired-reports:/var/www/datingrewired-reports:ro
    - /var/www/gentlemonths-reports:/var/www/gentlemonths-reports:ro
    - /var/www/gentlemonths/nginx.conf:/etc/nginx/conf.d/gentlemonths.conf:ro
    - /opt/leadgen-engine/nginx-leadgen.conf:/etc/nginx/conf.d/leadgen.conf:ro    # AGGIUNGI
    - /var/www/certbot-webroot:/var/www/certbot-webroot:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  depends_on:
    - app
  restart: unless-stopped
```

Riavvia SOLO nginx (non l'app Astraze):
```bash
cd /root/astro-funnel
docker compose up -d nginx
```

Downtime atteso: 5-10 secondi su astraze.com (nginx ricreato), zero impatto su Astraze app.

## Step 7 — Verifica

```bash
# Risoluzione DNS
dig leadgen.trackitwhen.com +short

# HTTPS health
curl -I https://leadgen.trackitwhen.com/

# API smoke test (vertical seed dovrebbe esistere)
curl -X POST https://leadgen.trackitwhen.com/api/leads/elder-wealth \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "first_name": "Test", "last_name": "User",
      "email": "test@example.com", "phone": "+15551234567",
      "zip": "90210", "state": "CA",
      "age_range": "60-69", "assets_range": "500k-1m",
      "planning_focus": "financial-advisor",
      "has_advisor": false, "homeowner": true
    },
    "consent_text": "test consent"
  }'
```

Atteso: `{"success":true,"lead_id":"...","status":"sold","total_revenue":...}`

## Update procedure (deploy futuri)

```bash
ssh root@91.98.85.227
cd /opt/leadgen-engine
git fetch origin && git reset --hard origin/main
docker compose build --no-cache
docker compose up -d
```

## Rollback rapido (se qualcosa rompe Astraze)

Se il riavvio nginx-1 fa esplodere astraze.com:
```bash
cd /root/astro-funnel
# Rimuovi temporaneamente il volume mount leadgen.conf dal docker-compose.yml
docker compose up -d nginx
# Astraze torna online entro 10 sec
```

## Troubleshooting

| Problema | Diagnosi | Fix |
|---|---|---|
| `502 Bad Gateway` su HTTPS | Container leadgen-engine down | `docker logs leadgen-engine`, riavvia con `docker compose up -d` |
| `nginx: configuration test failed` quando recreate nginx | Cert mancante o syntax error | torna a config senza leadgen, ottieni cert, retry |
| `connection refused` da nginx → leadgen | Container non sulla network condivisa | verifica `docker network inspect astro-funnel_default` |
| DB errors all'avvio | DATABASE_URL sbagliato | `docker exec leadgen-engine cat /app/.env` |
