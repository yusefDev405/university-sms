# University Student Management System (USMS)

Enterprise-grade academic & campus registry covering the full student lifecycle: admissions & matriculation, curriculum prerequisites/corequisites/equivalencies, transactional registration & waitlist promotion, weighted LMS-bridge gradebook, faculty advising & department chair appeals/overrides, campus facilities & conflict-checked final exams, office hours, strictly anonymous course evaluations, tuition & scholarship ledger ERP, executive analytics, TOTP 2FA, and bilingual **English (LTR) / Arabic (RTL)** support.

Designed for **zero heavy installation** (no Docker, no local PostgreSQL server installer, no native C++ build tools) and **tiny local disk footprint** (< 3 MB database storage).

## Tech Stack
- **Backend**: Node.js, Express, Zod, `bcryptjs`, `jsonwebtoken`, `helmet`, `express-rate-limit`, pure Node `node:crypto` RFC 6238 TOTP 2FA, pure-JS PDF 1.4 transcript generator, Swagger UI (`/api/docs`)
- **Database**: PostgreSQL 16 via embedded `@electric-sql/pglite` (default local mode) or external `pg` (`DATABASE_URL` + `docs/rls-production.sql` RLS policies), 36 normalized 3NF tables across migrations `001`–`009`, PL/pgSQL `enroll_student()` (capacity, holds, prerequisites, corequisites, equivalencies, transfer credits, override petitions, time clashes, probation credit caps), 8 views (including `v_course_dfw_rates`, `v_offering_utilization`, `v_instructor_workload`), and audit/notification triggers
- **Frontend**: React 19 + Vite, semantic HTML, handcrafted responsive Swiss-Institutional CSS with light/dark mode (`light-dark()`), **English (LTR) / العربية (RTL)** toggle, `@container` responsive tables, native `<dialog>` modals, and `popover` notifications
- **Testing**: Vitest + Supertest (backend unit, DB rules, API integration, BOLA/RBAC authorization, concurrency, and Phase A–E feature suites) + Vitest & React Testing Library (frontend component, state, and i18n tests)

## Quick Start (Zero Docker, Zero Heavy Setup)

From `university-sms/`:

```sh
# 1. Install dependencies (lightweight JS/WASM packages only)
npm --prefix backend install --no-audit --no-fund
npm --prefix frontend install --no-audit --no-fund

# 2. Initialize schema (36 tables) & compact seed dataset
npm run db:migrate
npm run db:seed

# 3. Start backend (http://localhost:4000) & frontend (http://localhost:5173)
npm run dev
```

Swagger API documentation is served live at `http://localhost:4000/api/docs`.
Public official credential verification works directly on the Sign In page (try code `GAL-2027-CS-2024003`).

## Demo Logins

| Role | Email | Password |
| :--- | :--- | :--- |
| **Student** | `nadia.mansour@galala.edu.eg` | `Student123!` |
| **Instructor & Dept Chair** | `amina.darwish@galala.edu.eg` | `Instructor123!` |
| **Admin (Registrar & Bursar)** | `admin@galala.edu.eg` | `AdminPass123!` |

## Useful Commands

```sh
npm test                  # Run backend + frontend Vitest suites
npm run build             # Production frontend Vite bundle
npm run lint:sql          # Verify zero unsafe SQL interpolation
npm run db:verify-backup  # Create compressed backup + verify 36-table restore in fresh DB
npm run db:explain        # Run in-memory EXPLAIN (ANALYZE, BUFFERS) benchmark
npm run db:import-csv     # CLI legacy CSV migration (writes bad rows to .errors.csv)
npm run db:reset          # Reset local DB and re-seed compact dataset
```

## Documentation Deliverables
- [ER Diagram (36 Tables)](docs/er-diagram.png) ([SVG](docs/er-diagram.svg))
- [OpenAPI Specification](docs/openapi.yaml)
- [Postman Collection](docs/postman_collection.json)
- [Production PostgreSQL RLS Policies](docs/rls-production.sql)
- [Design Decisions](docs/design-decisions.md)
- [Security Controls](docs/security.md)
- [Query Performance & EXPLAIN ANALYZE](docs/performance.md)
- [Operations, Backup & Deployment](docs/operations.md)
- [MySQL 8.0 Portability Reference](docs/mysql-port/courses.mysql.sql)
