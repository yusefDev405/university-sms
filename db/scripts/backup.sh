#!/usr/bin/env bash
# Production PostgreSQL backup script (compressed custom-format dump)
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-usms_app}"
DB_NAME="${DB_NAME:-university_sms}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_LAST="${KEEP_LAST:-7}"

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/university_$(date +%F).dump"

pg_dump -Fc -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$OUT_FILE"
echo "Backup created: $OUT_FILE"

# Keep only the most recent N dumps
ls -1t "$BACKUP_DIR"/university_*.dump 2>/dev/null | tail -n +"$((KEEP_LAST + 1))" | xargs -r rm -f
