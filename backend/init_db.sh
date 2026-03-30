#!/bin/sh
set -e

# Keep the generated client and database schema in sync on every boot.
npx prisma generate
npx prisma db push
mkdir -p "${UPLOADS_DIR:-/app/uploads}"

# Seed/migration bootstrapping can be added back here if the project later
# moves from db push to an explicit Prisma migration workflow.
exec npm run dev
