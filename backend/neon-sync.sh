#!/bin/sh
# Pushes your current Prisma schema to Neon (PostgreSQL) without touching local SQLite setup.
# Usage: sh backend/neon-sync.sh

SCHEMA="./prisma/schema.prisma"
TEMP_SCHEMA="/tmp/schema_neon.prisma"
ENV_NEON=".env.neon"

# Check .env.neon exists
if [ ! -f "$ENV_NEON" ]; then
  echo "❌ Missing $ENV_NEON — create it with your Neon DATABASE_URL first."
  echo "   Example: DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
  exit 1
fi

# Load Neon DATABASE_URL
export $(grep -v '^#' $ENV_NEON | xargs)

echo "📋 Creating temp schema for Neon (original schema.prisma untouched)..."
sed 's/provider = "sqlite"/provider = "postgresql"/' $SCHEMA > $TEMP_SCHEMA

echo "📤 Pushing schema to Neon..."
npx prisma db push --schema=$TEMP_SCHEMA --skip-generate

EXIT_CODE=$?

rm -f $TEMP_SCHEMA

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Neon schema is up to date!"
else
  echo "❌ Push failed."
  exit 1
fi
