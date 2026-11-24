# University Student Management System (USMS)

A full-stack academic registry and campus ERP covering the complete student lifecycle: admissions & matriculation, curriculum prerequisites/corequisites/equivalencies, concurrency-safe registration & waitlist auto-promotion, weighted LMS-bridge gradebooks, academic advising & department chair appeals/overrides, campus rooms & conflict-checked final exams, faculty office hours, strictly anonymous course evaluations, tuition & merit-scholarship ledger ERP, executive analytics, TOTP 2FA, and bilingual **English (LTR) / Arabic (RTL)** support.

Built for **zero heavy installation** — runs out of the box with embedded **PostgreSQL 16 (PGlite WASM)** with no Docker, no local Postgres server daemon, and no native C++ build tools, while supporting external PostgreSQL in production via `DATABASE_URL`.

---

## Requirements

- **Node.js** `20.x` or newer (tested on Node `24.x`) and **npm** `10+`
- **Python 3** is **not** required to run the app (only `node` + `npm`)

---

## Quick Start (Run Locally in Under 2 Minutes)

```sh
# 1. Clone the repository and enter the project folder
git clone <your-repo-url>
cd <your-repo-name>

# 2. Install backend & frontend packages (pure JS/WASM only)
npm --prefix backend install --no-audit --no-fund
npm --prefix frontend install --no-audit --no-fund

# 3. (Optional) Create local environment config — works out of the box without editing
# PowerShell: Copy-Item .env.example .env
# bash/macOS: cp .env.example .env

# 4. Initialize the 36-table schema and load the compact demo dataset
npm run db:migrate
npm run db:seed

# 5. Start both API (http://localhost:4000) and UI (http://localhost:5173)
npm run dev
```

Once running, open:
- **Web App**: `http://localhost:5173`
- **Interactive API Docs (Swagger UI)**: `http://localhost:4000/api/docs`
- **Health Check**: `http://localhost:4000/api/v1/health`

> To wipe your local database and return cleanly to the initial demo state at any time, run:
> ```sh
> npm run db:reset
> ```

---

## Demo Accounts & Walkthrough

All demo accounts work immediately after `npm run db:seed` (and have 1-click fill buttons on the Sign In page):

| Role | Email | Password | What to Try |
| :--- | :--- | :--- | :--- |
| **Student** | `nadia.mansour@galala.edu.eg` | `Student123!` | Browse catalogue & prerequisites, join waitlists, atomic course swap, view weekly timetable, inspect weighted gradebook & announcements, book office hours, submit anonymous evaluations, view GPA/PDF transcript/degree planner, submit grade appeals or override petitions, view tuition ledger, toggle EN/عربي (RTL) & 2FA/Sessions. |
| **Instructor & Dept Chair** | `amina.darwish@galala.edu.eg` | `Instructor123!` | Inspect roster & export CSV, post single/atomic-bulk/I/P/NP grades, manage weighted gradebook & 1-click compute final grades, record attendance, broadcast announcements, view anonymous evaluations, track advisees & issue early alerts, manage office hours, approve/reject grade appeals & override petitions as CS Department Chair. |
| **Admin (Registrar & Bursar)** | `admin@galala.edu.eg` | `AdminPass123!` | Manage users, students, holds, courses & prerequisites, terms & conflict-checked offerings, campus rooms & final exam conflict scheduler, admissions & 1-click matriculation, transfer credits, graduation conferral, term tuition billing & 25% Dean's List waivers, financial holds, executive DFW/utilization analytics, immutable audit log, and CSV bulk student import. |

**Public Degree Verification (No Login Required):**  
On the Sign In screen, click **Verify Official Credential** and test verification code `GAL-2027-CS-2024003` (calls `GET /api/v1/verify/GAL-2027-CS-2024003`).

---

## Environment Configuration

Default local values work without a `.env` file, or copy `.env.example` to `.env`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `4000` | Express API port (`frontend/vite.config.js` proxies `/api` to `http://localhost:4000`) |
| `NODE_ENV` | `development` | Environment mode (`development`, `test`, `production`) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `JWT_SECRET` | dev fallback string | Sign access tokens — **must** be replaced with a random 32+ char secret in production |
| `PGLITE_DATA_DIR` | `../data/pgdata` | Local embedded PostgreSQL storage directory (ignored by Git) |
| `DATABASE_URL` | *(unset)* | Set to a PostgreSQL 16+ connection URI to use external Postgres instead of embedded PGlite |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS in production |

---

## Architecture & Tech Stack

- **Backend (`backend/`)**: Node.js + Express (`helmet`, `cors`, `express-rate-limit`, `cookie-parser`, Zod `.strict()` schemas, `bcryptjs`, JWT 15m access + `HttpOnly`/`SameSite=Strict` rotating refresh families, CSRF custom header guard, pure-Node RFC 6238 TOTP 2FA in `node:crypto`, pure-JS PDF 1.4 transcript writer, Swagger UI)
- **Database (`db/`)**: 36 normalized 3NF tables across migrations `001`–`009` (+ down scripts), transactional `enroll_student()` PL/pgSQL function, 8 reporting & analytics views, automated audit & notification triggers, gzip + SHA-256 backup/restore verifier
- **Frontend (`frontend/`)**: React 19 + Vite, semantic Swiss-Institutional CSS (`tokens.css`, `base.css`, `components.css`) with `light-dark()` theme switching, EN (LTR) / العربية (RTL) toggle, `@container` responsive tables, native `<dialog>` modals, and `popover` notifications
- **Tests**: Vitest + Supertest (7 backend suites: unit, DB rules, integration, authorization/BOLA, 20-request concurrency, Phase A–E modules) + Vitest & React Testing Library (frontend component & i18n tests)

---

## Useful Commands

```sh
npm run dev               # Start backend + frontend together
npm run dev:backend       # Start backend API only (port 4000)
npm run dev:frontend      # Start Vite frontend only (port 5173)
npm test                  # Run all backend + frontend Vitest suites
npm run lint:sql          # Check for unsafe SQL string interpolation
npm run build             # Build production frontend bundle (frontend/dist)
npm run db:migrate        # Apply pending SQL migrations (001-009)
npm run db:seed           # Load compact demo dataset (skips if already seeded)
npm run db:reset          # Wipe local DB, re-run migrations, and re-seed
npm run db:backup         # Create gzipped JSON + SHA-256 backup in backups/
npm run db:verify-backup  # Verify full 36-table backup & restore in throwaway in-memory Postgres
npm run db:explain        # Benchmark EXPLAIN (ANALYZE, BUFFERS) before/after index creation
npm run db:import-csv     # Bulk-import CSV students from db/seeds/legacy_students_sample.csv
```

---

## Project Layout

```text
├── backend/              # Express API, Zod validation, layered modules, Vitest suites
├── frontend/             # React 19 + Vite UI, i18n, CSS design tokens, UI tests
├── db/
│   ├── migrations/       # Forward (001-009) and down/ rollback PostgreSQL scripts
│   ├── scripts/          # Migrate, seed, reset, backup, restore verifier, EXPLAIN demo
│   └── seeds/            # Compact deterministic seed SQL + sample CSV
├── docs/                 # ER diagram, OpenAPI YAML, Postman collection, RLS SQL, architecture notes
├── scripts/              # Dev runner and SQL safety linter
├── .github/              # GitHub Actions CI & Dependabot config
├── .env.example          # Environment configuration template
└── package.json          # Workspace convenience scripts
```

---

## Documentation Deliverables

- [ER Diagram (36 Tables — PNG)](docs/er-diagram.png) · [SVG](docs/er-diagram.svg)
- [OpenAPI 3.0 Specification](docs/openapi.yaml)
- [Postman Collection](docs/postman_collection.json)
- [Production PostgreSQL RLS Policies](docs/rls-production.sql)
- [Design Decisions](docs/design-decisions.md)
- [Security Controls (OWASP Mapping)](docs/security.md)
- [Query Performance & EXPLAIN ANALYZE](docs/performance.md)
- [Operations, Backup & Deployment](docs/operations.md)
- [MySQL 8.0 Portability Reference](docs/mysql-port/courses.mysql.sql)
