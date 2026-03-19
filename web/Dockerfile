# ============================================================
# AI App Factory - Multi-stage Dockerfile
# Build context: proje kökü (docker-compose.yaml'da context: .)
# ============================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .

# Build-time env vars (non-secret defaults)
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Runtime tools (orchestrator.sh needs bash, jq, curl)
RUN apk add --no-cache bash jq curl git

# Install Claude CLI globally (pipeline execution)
RUN corepack enable && corepack prepare pnpm@latest --activate && npm install -g @anthropic-ai/claude-code

# Copy standalone output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Default prompt dosyaları — ilk deploy'da volume boşsa bunlar kopyalanır
COPY prompts/ /app/default-prompts/

# Pipeline execution dosyaları — orchestrator ve bağımlılıkları
COPY orchestrator.sh /app/default-orchestrator.sh
COPY validate-run.sh /app/default-validate-run.sh
COPY CLAUDE.md /app/default-CLAUDE.md
COPY learnings.json /app/default-learnings.json
RUN chmod +x /app/default-orchestrator.sh /app/default-validate-run.sh

# Entrypoint script — volume'a default dosyaları kopyalar, settings.json oluşturur
COPY web/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Factory data directories
# /factory       → project root (volume mounted at runtime)
# /factory/runs  → persisted via Coolify volume (survives redeploy)
RUN mkdir -p /factory/runs /factory/prompts /factory/logs

# Mark /factory/runs as a volume so Docker knows it is persistent data
VOLUME ["/factory/runs"]

EXPOSE 3000

# No Docker-level HEALTHCHECK — Traefik blocks traffic to "unhealthy" containers.
# Coolify polls the container status separately via sentinel.
HEALTHCHECK NONE

# Entrypoint: default prompts kopyala (boşsa) → sonra node server başlat
ENTRYPOINT ["/app/entrypoint.sh"]
