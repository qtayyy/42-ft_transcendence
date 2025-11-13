#!/bin/sh
# Database backup script
# Usage: ./scripts/backup-db.sh

BACKUP_DIR="../data/backups"
DB_PATH="../data/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dev.db.backup.$TIMESTAMP"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "❌ Database not found at $DB_PATH"
  exit 1
fi

echo "📦 Creating backup..."
cp "$DB_PATH" "$BACKUP_FILE"

# Keep only last 10 backups
ls -t "$BACKUP_DIR"/dev.db.backup.* 2>/dev/null | tail -n +11 | xargs -r rm

echo "✅ Backup created: $BACKUP_FILE"
echo "📋 Available backups:"
ls -lh "$BACKUP_DIR"/dev.db.backup.* 2>/dev/null | tail -5

