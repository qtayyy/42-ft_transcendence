#!/bin/sh
set -eu

SCHEMA_FILE="/app/prisma/schema.prisma"

# Docker Compose pins the backend to a SQLite database file under /data.
# Keep the same default here so local container boots stay aligned even if
# env loading changes or a stale shell injects a different DATABASE_URL.
: "${DATABASE_URL:=file:/data/dev.db}"
export DATABASE_URL

if ! grep -Eq 'provider[[:space:]]*=[[:space:]]*"sqlite"' "$SCHEMA_FILE"; then
  echo "Error: Prisma schema is not configured for sqlite." >&2
  echo "Rebuild the backend image with the current repo state before retrying." >&2
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    ;;
  *)
    echo "Error: DATABASE_URL must use sqlite (file:...), got '$DATABASE_URL'." >&2
    exit 1
    ;;
esac

# Keep the generated client and mounted SQLite schema in sync on every boot.
# This is especially important for additive dev-schema changes on existing DBs.
npx prisma generate
npx prisma db push

# Seed/migration bootstrapping can be added back here if the project later
# moves from db push to an explicit Prisma migration workflow.

npm run dev
