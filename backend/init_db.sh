#!/bin/sh
# Keep the generated client and mounted SQLite schema in sync on every boot.
# This is especially important for additive dev-schema changes on existing DBs.
npx prisma generate
npx prisma db push

# Seed/migration bootstrapping can be added back here if the project later
# moves from db push to an explicit Prisma migration workflow.

npm run dev
