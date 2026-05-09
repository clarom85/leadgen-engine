#!/usr/bin/env bash
# ============================================================
# Deploy automatico leadgen-engine su VPS 178.104.17.161
# Uso: bash deploy/deploy-vps.sh
# ============================================================

set -euo pipefail

# Config
APP_DIR="/opt/leadgen-engine"
APP_PORT="3010"
APP_NAME="leadgen-engine"
SUBDOMAIN="leadgen.vireonmedia.com"
SSL_EMAIL="contact@vireonmedia.com"
NGINX_CONF="/etc/nginx/sites-available/leadgen-engine"

log() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()  { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
warn(){ printf "  \033[1;33m!\033[0m %s\n" "$*"; }
err() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; exit 1; }

# ------------------------------------------------------------
# 1. Pre-check
# ------------------------------------------------------------
log "Pre-check ambiente"
[[ "$(id -u)" == "0" ]] || err "Devi essere root"
command -v node >/dev/null   || err "Node non installato. Installa Node 20+ via nvm."
command -v pm2 >/dev/null    || err "PM2 non installato. npm i -g pm2"
command -v nginx >/dev/null  || err "nginx non installato"
command -v certbot >/dev/null || warn "certbot non installato — SSL andrà fatto a mano"
ok "Tools presenti"

# ------------------------------------------------------------
# 2. Clone o pull repo
# ------------------------------------------------------------
log "Codice sorgente"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git fetch origin && git rebase origin/main
  ok "Repo aggiornato"
else
  read -rp "URL git repo (es: https://github.com/clarom85/leadgen-engine.git): " REPO_URL
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  ok "Repo clonato in $APP_DIR"
fi

# ------------------------------------------------------------
# 3. .env
# ------------------------------------------------------------
log "Configurazione .env"
if [[ ! -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  warn ".env creato da template. APRILO E COMPILA DATABASE_URL prima di proseguire."
  warn "Eseguilo: nano $APP_DIR/.env"
  read -rp "Premi ENTER quando hai compilato .env... "
fi
grep -q "DATABASE_URL=postgresql" "$APP_DIR/.env" || err "DATABASE_URL non configurato in .env"
ok ".env presente"

# ------------------------------------------------------------
# 4. Install deps
# ------------------------------------------------------------
log "npm install"
cd "$APP_DIR"
npm install --production=false
ok "Dipendenze installate"

# ------------------------------------------------------------
# 5. Schema DB
# ------------------------------------------------------------
log "Apply schema + seed DB"
npm run db:apply
npm run db:seed
ok "DB pronto"

# ------------------------------------------------------------
# 6. Build Next.js
# ------------------------------------------------------------
log "Build production"
npm run build
ok "Build completata"

# ------------------------------------------------------------
# 7. PM2
# ------------------------------------------------------------
log "PM2 process"
mkdir -p /var/log/pm2
if pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
  pm2 reload "$APP_NAME"
  ok "Process reloaded"
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.js"
  pm2 save
  ok "Process avviato"
fi
sleep 2
pm2 list | grep "$APP_NAME" || err "PM2 non lo vede"

# ------------------------------------------------------------
# 8. Nginx
# ------------------------------------------------------------
log "Nginx config"
if [[ ! -L "/etc/nginx/sites-enabled/leadgen-engine" ]]; then
  cp "$APP_DIR/deploy/nginx-leadgen.conf" "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/leadgen-engine
  nginx -t || err "Nginx config invalido"
  systemctl reload nginx
  ok "Nginx configurato e reloaded"
else
  ok "Nginx già configurato"
fi

# ------------------------------------------------------------
# 9. SSL (Let's Encrypt) — solo se certbot disponibile
# ------------------------------------------------------------
if command -v certbot >/dev/null; then
  log "SSL Let's Encrypt"
  if [[ ! -d "/etc/letsencrypt/live/$SUBDOMAIN" ]]; then
    certbot --nginx -d "$SUBDOMAIN" --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
    ok "Cert emesso"
  else
    ok "Cert già esistente"
  fi
fi

# ------------------------------------------------------------
# 10. Smoke test
# ------------------------------------------------------------
log "Smoke test"
sleep 2
HEALTH=$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:$APP_PORT" 2>/dev/null || echo "FAIL")
if [[ "$HEALTH" == "200" ]] || [[ "$HEALTH" == "307" ]] || [[ "$HEALTH" == "308" ]]; then
  ok "App risponde su :$APP_PORT (HTTP $HEALTH)"
else
  err "App non risponde su :$APP_PORT — pm2 logs $APP_NAME"
fi

if curl -fsSk "https://$SUBDOMAIN/" -o /dev/null 2>&1; then
  ok "HTTPS pubblico ok: https://$SUBDOMAIN"
else
  warn "HTTPS non risponde — verifica DNS Cloudflare e cert SSL"
fi

# ------------------------------------------------------------
log "DEPLOY COMPLETATO"
echo ""
echo "  Funnel:    https://$SUBDOMAIN/funnels/elder-wealth"
echo "  Dashboard: https://$SUBDOMAIN/dashboard"
echo "  API:       https://$SUBDOMAIN/api/leads/elder-wealth"
echo ""
echo "  PM2 logs:  pm2 logs $APP_NAME"
echo "  Riavvio:   pm2 reload $APP_NAME"
