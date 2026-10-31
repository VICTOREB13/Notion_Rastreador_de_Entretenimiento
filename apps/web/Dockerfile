# ==============================================================================
# Multi-stage Dockerfile for @repo/web (Next.js 16 Standalone Production Build)
# ==============================================================================

# Stage 1: Base image
FROM oven/bun:1.4-alpine AS base
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
COPY packages/database ./packages/database
COPY packages/server ./packages/server
COPY apps/web ./apps/web
RUN bun install
RUN cd packages/database && bunx prisma generate

# Stage 3: Build Next.js application in standalone mode
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY package.json bun.lock tsconfig.json ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN bun run web:build

# Stage 4: Production runner using Node 22 Alpine
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create public directory structure
RUN mkdir -p apps/web/public

COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
