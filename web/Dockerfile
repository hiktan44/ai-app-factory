# ============================================================
# AI App Factory - Multi-stage Dockerfile
# ============================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

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
RUN apk add --no-cache bash jq curl

# Install Claude CLI globally (pipeline execution)
RUN corepack enable && npm install -g @anthropic-ai/claude-code

# Copy standalone output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Factory data directories
# /factory       → project root (volume mounted at runtime)
# /factory/runs  → persisted via Coolify volume (survives redeploy)
RUN mkdir -p /factory/runs /factory/prompts /factory/logs

# Mark /factory/runs as a volume so Docker knows it is persistent data
VOLUME ["/factory/runs"]

EXPOSE 3000

# Health check for Coolify / Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
