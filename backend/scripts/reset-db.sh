#!/bin/sh
# Safe database reset script with backup functionality
# Usage: ./scripts/reset-db.sh [--no-backup]

BACKUP_DIR="../data/backups"
DB_PATH="../data/dev.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dev.db.backup.$TIMESTAMP"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ -f "$DB_PATH" ]; then
  # Check if --no-backup flag is set
  if [ "$1" != "--no-backup" ]; then
    echo "📦 Creating backup of existing database..."
    cp "$DB_PATH" "$BACKUP_FILE"
    echo "✅ Backup created: $BACKUP_FILE"
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/dev.db.backup.* 2>/dev/null | tail -n +6 | xargs -r rm
    echo "🧹 Cleaned old backups (keeping last 5)"
  else
    echo "⚠️  Skipping backup (--no-backup flag set)"
  fi
  
  echo "🗑️  Removing existing database..."
  rm "$DB_PATH"
else
  echo "ℹ️  No existing database found, skipping backup"
fi

echo "🔄 Running Prisma migrations..."
npx prisma migrate dev --name reset_$TIMESTAMP

echo "🌱 Seeding database..."
npm run seed

echo "✅ Database reset complete!"
if [ "$1" != "--no-backup" ] && [ -f "$BACKUP_FILE" ]; then
  echo "💾 Backup available at: $BACKUP_FILE"
fi

