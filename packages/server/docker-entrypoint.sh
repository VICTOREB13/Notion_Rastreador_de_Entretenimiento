#!/bin/sh
set -e

# ==============================================================================
# Entrypoint for notion-entertainment-daemon-api container
# ==============================================================================

# 1. Ensure SQLite data directory exists and has permissive write permissions
mkdir -p /app/data
chmod 777 /app/data 2>/dev/null || true
chmod 666 /app/data/* 2>/dev/null || true

# If custom DATABASE_URL specifies a different directory, ensure it exists as well
if [ -n "$DATABASE_URL" ]; then
  DB_RAW=$(echo "$DATABASE_URL" | sed -e 's/^file://' -e 's/?.*$//')
  DB_DIR=$(dirname "$DB_RAW")
  if [ -n "$DB_DIR" ] && [ "$DB_DIR" != "." ]; then
    mkdir -p "$DB_DIR"
    chmod 777 "$DB_DIR" 2>/dev/null || true
  fi
fi

# 2. Sync database schema idempotently without Prisma migration history locks (P3005 immune)
# Falls back to --accept-data-loss to guarantee non-interactive boot on schema adjustments
echo "[entrypoint] Synchronizing SQLite database schema with prisma db push..."
bun run db:push --skip-generate || bun run db:push --skip-generate --accept-data-loss

# 3. Hand over process control to CMD, ensuring proper UNIX signal propagation (SIGTERM/SIGINT)
echo "[entrypoint] Starting Daemon API service: $@"
exec "$@"
