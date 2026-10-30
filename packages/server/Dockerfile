# ==============================================================================
# Multi-stage Dockerfile for @repo/server (Hono RPC Daemon API & Sync Workers)
# Base: oven/bun:1.4-alpine
# ==============================================================================

FROM oven/bun:1.4-alpine AS base

# Install OpenSSL, SQLite libraries, and curl for Prisma native query engine and healthchecks
RUN apk add --no-cache openssl sqlite-libs curl

WORKDIR /app

# Copy root workspace manifest and TypeScript configs
COPY package.json bun.lock tsconfig.json ./
COPY packages/database ./packages/database
COPY packages/server ./packages/server

# Copy and configure entrypoint script with LF normalization for Alpine Linux
COPY packages/server/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Install monorepo dependencies and generate Prisma Client for Alpine musl
RUN bun install
RUN cd packages/database && bunx prisma generate

# Create persistent data directory for SQLite database with WAL mode
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/entertainment.db"
ENV PORT=3001
ENV HOST="0.0.0.0"

VOLUME ["/app/data"]
EXPOSE 3001

# Entrypoint initializes SQLite schema safely via db:push and hands over to Bun runtime
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["bun", "run", "packages/server/src/index.ts"]
