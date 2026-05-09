# ============================================================
# Multi-stage Dockerfile per leadgen-engine (Next.js 15)
# ============================================================

# ---- Stage 1: deps ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- Stage 2: builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# Build args per env client (NEXT_PUBLIC_*). Sono inline al build time da Next.js.
ARG NEXT_PUBLIC_TRUSTEDFORM_ENABLED=""
ARG NEXT_PUBLIC_JORNAYA_ACCOUNT_ID=""
ARG NEXT_PUBLIC_LEADGEN_DEBUG=""
ENV NEXT_PUBLIC_TRUSTEDFORM_ENABLED=$NEXT_PUBLIC_TRUSTEDFORM_ENABLED
ENV NEXT_PUBLIC_JORNAYA_ACCOUNT_ID=$NEXT_PUBLIC_JORNAYA_ACCOUNT_ID
ENV NEXT_PUBLIC_LEADGEN_DEBUG=$NEXT_PUBLIC_LEADGEN_DEBUG
# Skip schema apply at build time (DB potrebbe non essere raggiungibile in build phase)
RUN npm run build

# ---- Stage 3: runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3010
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3010", "-H", "0.0.0.0"]
