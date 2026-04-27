# ============================================================
# AI App Factory - Root Dockerfile
# Coolify base_directory=/ için web/ altındaki build'i çalıştırır
# ============================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV NEXT_PRIVATE_LOCAL_IP="0.0.0.0"
RUN pnpm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime tools (orchestrator.sh needs bash, jq, curl; Coolify healthcheck needs wget)
RUN apk add --no-cache bash jq curl wget

# Install Claude CLI globally (pipeline execution)
RUN corepack enable && npm install -g @anthropic-ai/claude-code

# Create non-root user (claude --dangerously-skip-permissions requires non-root)
RUN addgroup -g 1001 -S factory && adduser -u 1001 -S factory -G factory

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy factory pipeline files (orchestrator, prompts, learnings)
COPY orchestrator.sh /factory/orchestrator.sh
COPY prompts/ /factory/prompts/
COPY learnings.json /factory/learnings.json
RUN chmod +x /factory/orchestrator.sh

# Factory runs directory (persistent volume mount point)
RUN mkdir -p /factory/runs

# Set ownership for non-root user
RUN chown -R factory:factory /app /factory

USER factory

EXPOSE 3000

CMD ["node", "server.js"]
