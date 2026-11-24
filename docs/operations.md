# Operations, Backup, Recovery & Deployment

## 1. Environment Variables

Copy `.env.example` to `.env` (never commit `.env`):

| Variable | Purpose | Default / Example |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `4000` |
| `NODE_ENV` | Runtime mode | `development` |
| `CORS_ORIGIN` | Allowed frontend origin(s) | `http://localhost:5173` |
| `JWT_SECRET` | HMAC secret for 15m access JWTs | `>= 16 chars` (use 32+ random bytes in prod) |
| `JWT_EXPIRES_IN` | Access token TTL | `15m` |
| `REFRESH_TOKEN_DAYS` | Refresh token cookie lifetime | `7` |
| `PGLITE_DATA_DIR` | Local embedded PostgreSQL directory | `../data/pgdata` |
| `DATABASE_URL` | Optional external PostgreSQL 16+ connection string | Unset locally (uses PGlite) |
| `COOKIE_SECURE` | Set `Secure` attribute on refresh cookie | `false` (HTTP localhost) / `true` (HTTPS prod) |

## 2. Backup & Verified Restore Procedure

### Local Zero-Heavy-Install Backup (`db/scripts/backup.js` & `verify_restore.js`)
- **What is backed up**: All 36 normalized tables (`BACKUP_TABLES` allowlist in [backup.js](../db/scripts/backup.js)) as gzip-compressed JSON (`backups/university_YYYY-MM-DD.json.gz`) paired with a `.sha256` integrity digest.
- **Retention**: Keeps the most recent 7 dumps automatically.
- **Verified restore test** (`npm run db:verify-backup`): Restores the latest dump into a **fresh throwaway in-memory PostgreSQL database** after running all migrations (`001`–`009`) from scratch, verifies SHA-256 checksum, and asserts exact row-count parity across all 36 tables.

Latest observed verification output:
- Command: `npm run db:verify-backup`
- Result: `PASSED in 6191ms`
- Artifact: `backups/university_2026-11-24.json.gz` (`5545 bytes`)
- Verified: All 36 tables matched expected source row counts identically (including `departments: 4, rooms: 5, users: 12, instructors: 3, students: 8, courses: 10, course_offerings: 10, enrollments: 18, assessments: 3, tuition_ledger: 4, audit_log: 38`).

### Production PostgreSQL Backup (`db/scripts/backup.sh` & `restore.sh`)
- Schedule `db/scripts/backup.sh` daily via cron (`pg_dump -Fc`) and store encrypted dumps in off-host object storage.
- For zero-data-loss production recovery (RPO near 0), enable **Point-In-Time Recovery (PITR)** with continuous PostgreSQL WAL archiving (`archive_mode = on`, `archive_command`, and periodic base backups via `pg_basebackup`).

## 3. Production Deployment (Without Docker)
1. Provision a managed PostgreSQL 16 database (e.g., Render, Railway, Neon, or Supabase) and set `DATABASE_URL`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `CORS_ORIGIN`, and a strong `JWT_SECRET`.
2. Run `npm run db:migrate` and optionally `npm run db:seed`.
3. Start the API (`npm --prefix backend start`) and verify `GET /api/v1/health`.
4. Build the static frontend (`npm run build` -> `frontend/dist/`) and serve from any static host or CDN proxying `/api` to the backend.
