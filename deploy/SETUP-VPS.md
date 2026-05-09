# VPS Deploy — Leadgen Engine

Deploy guidato sulla VPS `91.98.85.227` (la stessa di Astraze) con PM2 + nginx + Cloudflare DNS + Let's Encrypt SSL.

**Subdomain**: `leadgen.trackitwhen.com`
**Porta interna**: `3010`

⚠️ Astraze gira in Docker sulla stessa VPS — verifica prima che la porta 3010 sia libera con: `netstat -tlnp | grep 3010`

---

## Prerequisiti

- Repo GitHub creato e codice pushato (es. `clarom85/leadgen-engine`)
- Cloudflare token nel tuo `.env` esistente (`CLOUDFLARE_API_TOKEN`)
- VPS con accesso SSH root: `ssh root@91.98.85.227`
- Neon DATABASE_URL pronto (creato in console.neon.tech, project `leadgen-engine`)

---

## Step 1 — Cloudflare DNS

Su [Cloudflare dashboard](https://dash.cloudflare.com/), zona `trackitwhen.com`:
- Aggiungi record **A**:
  - Name: `leadgen`
  - IPv4: `91.98.85.227`
  - Proxy status: **DNS only** (grigio, non arancione) — il proxy CF rompe SSL su Let's Encrypt nella prima emissione. Riattiva proxy dopo che cert è ok.
  - TTL: Auto

Verifica: `dig leadgen.trackitwhen.com +short` → deve restituire `91.98.85.227`.

---

## Step 2 — SSH sulla VPS

```bash
ssh root@91.98.85.227
```

---

## Step 3 — Clone repo e install deps

```bash
cd /opt
git clone https://github.com/clarom85/leadgen-engine.git
cd leadgen-engine
npm install --production=false
```

Se Node è < 20 sulla VPS:
```bash
# Verifica
node --version

# Se < 20, aggiorna via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

---

## Step 4 — Configura .env

```bash
cp .env.example .env
nano .env
```

Compila almeno:
```
DATABASE_URL=postgresql://...      # da Neon
NODE_ENV=production
PING_TIMEOUT_MS=2500
```

---

## Step 5 — Applica schema DB e seed

```bash
npm run db:apply
npm run db:seed
```

Output atteso: `✅ Schema applied successfully` + `✅ Seed complete`.

---

## Step 6 — Build Next.js per production

```bash
npm run build
```

---

## Step 7 — PM2 process

```bash
# Avvia il process
pm2 start deploy/ecosystem.config.js

# Verifica gira
pm2 status
pm2 logs leadgen-engine --lines 30

# Persisti tra reboot
pm2 save
```

---

## Step 8 — Nginx config

```bash
# Copia config
cp deploy/nginx-leadgen.conf /etc/nginx/sites-available/leadgen-engine

# Abilita (link)
ln -s /etc/nginx/sites-available/leadgen-engine /etc/nginx/sites-enabled/

# Test config
nginx -t

# Reload (NON restart — non interrompi gli altri siti)
systemctl reload nginx
```

---

## Step 9 — SSL Let's Encrypt

```bash
# Se certbot non installato:
apt install -y certbot python3-certbot-nginx

# Emetti cert
certbot --nginx -d leadgen.trackitwhen.com --non-interactive --agree-tos --email contact@vireonmedia.com
```

Certbot iniettera automaticamente le linee `ssl_certificate` nel config nginx.

---

## Step 10 — Verifica

```bash
# DNS resolution
dig leadgen.trackitwhen.com +short

# HTTP → HTTPS redirect
curl -I http://leadgen.trackitwhen.com/

# HTTPS health
curl https://leadgen.trackitwhen.com/

# API smoke test
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

Atteso: `{"success":true,"lead_id":"...","status":"sold","total_revenue":...}`.

---

## Step 11 — Cloudflare proxy ON (opzionale)

Una volta che SSL è verde sul subdomain (`https://leadgen.trackitwhen.com` = ok):
- Torna su Cloudflare DNS
- Cambia il record `leadgen` a **Proxied** (arancione)
- Beneficio: DDoS protection + cache + analytics CF

---

## Update procedure (deploy futuri)

```bash
ssh root@91.98.85.227
cd /opt/leadgen-engine
git fetch origin && git rebase origin/main
npm install
npm run build
pm2 reload leadgen-engine
```

---

## Troubleshooting

| Problema | Diagnosi | Fix |
|---|---|---|
| `502 Bad Gateway` | PM2 non gira | `pm2 logs leadgen-engine` e `pm2 restart leadgen-engine` |
| `connection refused` da nginx | Porta 3010 non in ascolto | `netstat -tlnp \| grep 3010` |
| DB error all'avvio | DATABASE_URL sbagliato | `cat .env`, retry `npm run db:apply` |
| SSL cert fail | DNS non propagato | aspetta 5 min, retry certbot |
| Pings timeout | Mock buyer endpoint sotto stesso process | OK in test, rimuovi mock in produzione reale |

---

## Cleanup (se serve rimuovere)

```bash
pm2 delete leadgen-engine
pm2 save
rm /etc/nginx/sites-enabled/leadgen-engine
systemctl reload nginx
# Cert rimane su /etc/letsencrypt/live/ — non è urgente cancellarlo
```
