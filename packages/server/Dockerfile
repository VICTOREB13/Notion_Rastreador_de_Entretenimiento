# ==============================================================================
# Multi-stage Dockerfile for @repo/server (Hono RPC Daemon API & Sync Workers)
# Base: oven/bun:1.4-alpine
# ==============================================================================

FROM oven/bun:1.4-alpine AS base

# Install OpenSSL & SQLite libraries for Prisma native query engine on Alpine Linux
RUN apk add --no-cache openssl sqlite-libs

WORKDIR /app

# Copy root workspace manifest and TypeScript configs
COPY package.json bun.lock tsconfig.json ./
COPY packages/database ./packages/database
COPY packages/server ./packages/server

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

# Run migrations automatically to initialize or update SQLite schema on startup, then launch server
CMD ["sh", "-c", "cd /app/packages/database && bunx prisma migrate deploy && cd /app && bun run packages/server/src/index.ts"]
