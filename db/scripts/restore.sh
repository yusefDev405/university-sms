#!/usr/bin/env bash
# Production PostgreSQL restore script + verification
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-dump>"
  exit 1
fi

DUMP_FILE="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-usms_app}"
RESTORE_DB="${RESTORE_DB:-university_restore}"

dropdb -h "$DB_HOST" -U "$DB_USER" --if-exists "$RESTORE_DB"
createdb -h "$DB_HOST" -U "$DB_USER" "$RESTORE_DB"
pg_restore -h "$DB_HOST" -U "$DB_USER" -d "$RESTORE_DB" --no-owner "$DUMP_FILE"

psql -h "$DB_HOST" -U "$DB_USER" -d "$RESTORE_DB" -c "
  SELECT 'students' AS table_name, count(*) FROM students
  UNION ALL SELECT 'courses', count(*) FROM courses
  UNION ALL SELECT 'enrollments', count(*) FROM enrollments;
"
