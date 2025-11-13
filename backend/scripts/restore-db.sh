#!/bin/sh
# Database restore script
# Usage: ./scripts/restore-db.sh [backup-file]

BACKUP_DIR="../data/backups"
DB_PATH="../data/dev.db"

if [ -z "$1" ]; then
  echo "📋 Available backups:"
  ls -lt "$BACKUP_DIR"/dev.db.backup.* 2>/dev/null | head -10
  echo ""
  echo "Usage: ./scripts/restore-db.sh <backup-file>"
  echo "Example: ./scripts/restore-db.sh dev.db.backup.20240101_120000"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  This will overwrite your current database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 1
fi

echo "📦 Restoring database from backup..."
cp "$BACKUP_FILE" "$DB_PATH"

echo "✅ Database restored from: $BACKUP_FILE"
echo "🔄 Regenerating Prisma client..."
npx prisma generate

