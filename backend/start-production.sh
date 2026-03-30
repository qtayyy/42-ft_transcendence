#!/bin/sh
set -e

npx prisma generate
npx prisma db push
mkdir -p "${UPLOADS_DIR:-/data/uploads}"

exec npx fastify start -a 0.0.0.0 -p "${PORT:-3001}" -l info app.js
