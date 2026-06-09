# ============================================================
# AI App Factory - Root Dockerfile
# Coolify base_directory=/ için web/ altındaki build'i çalıştırır
# ============================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile && pnpm store prune


# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
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

# Runtime tools (orchestrator.sh needs tzdata, bash, jq, curl; Coolify healthcheck needs wget)
# gosu: root → factory user geçişi için (claude --dangerously-skip-permissions)
RUN apk add --no-cache bash jq curl wget tzdata gosu

# Set timezone
ENV TZ=Europe/Istanbul
RUN cp /usr/share/zoneinfo/Europe/Istanbul /etc/localtime && echo "Europe/Istanbul" > /etc/timezone

# Install Claude CLI globally (pipeline execution)
RUN corepack enable && npm install -g @anthropic-ai/claude-code && npm cache clean --force


# Create non-root user (claude --dangerously-skip-permissions requires non-root)
RUN addgroup -g 1001 -S factory && adduser -u 1001 -S factory -G factory

# Create factory home and claude config directory
RUN mkdir -p /home/factory/.claude /home/factory/.config \
    && chown -R factory:factory /home/factory

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

# Entrypoint: Claude auth setup + app start
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set ownership for non-root user
RUN chown -R factory:factory /app /factory

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
