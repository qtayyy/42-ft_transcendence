#!/bin/sh
# Change to 'npx prisma migrate deploy' and remove npm run seed later
if [ ! -f ../data/dev.db ]; then
  echo "Database not found. Running migrations and seeding..."
  npx prisma migrate dev --name init
  npm run seed
else
  echo "Database already exists. Skipping migrations and seeding."
fi

npm run dev
