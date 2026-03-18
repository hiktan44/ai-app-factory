# ============================================================
# AI App Factory - Root Dockerfile
# Coolify base_directory=/ için web/ altındaki build'i çalıştırır
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
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Runtime tools (orchestrator.sh needs bash, jq, curl; Coolify healthcheck needs wget)
RUN apk add --no-cache bash jq curl wget

# Install Claude CLI globally (pipeline execution)
RUN corepack enable && npm install -g @anthropic-ai/claude-code

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Factory data volume mount point
RUN mkdir -p /factory

EXPOSE 3000

CMD ["node", "server.js"]
