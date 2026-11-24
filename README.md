# University Student Management System (USMS)

Production-style academic registry covering course catalogue browsing, transactional course registration & waitlist management, instructor grading, credit-weighted GPA & transcripts, and registrar administration.

Designed for **zero heavy installation** (no Docker, no local PostgreSQL server installer, no native C++ build tools) and **tiny local disk footprint** (< 2 MB database storage).

## Tech Stack
- **Backend**: Node.js, Express, Zod, `bcryptjs`, `jsonwebtoken`, `helmet`, `express-rate-limit`, Swagger UI (`/api/docs`)
- **Database**: PostgreSQL 16 via embedded `@electric-sql/pglite` (default local mode) or external `pg` (`DATABASE_URL` in production), raw parameterized SQL, PL/pgSQL stored function (`enroll_student` with capacity, prerequisites, time-clash, and probation credit-limit enforcement), triggers (`audit_row`, `promote_waitlist_on_drop`), views (`v_student_transcript`, `v_student_gpa`, `v_offering_availability`, `v_instructor_roster`, `v_attendance_summary`)
- **Features**: Course registration & waitlist auto-promotion, attendance register & student percentages, single & atomic bulk grading with distribution chart & CSV export, downloadable official `.pdf` transcripts, account lockout & password rotation, admin CRUD/prerequisites/audit trail/reports, and CLI + API bulk CSV student import
- **Frontend**: React 19 + Vite, semantic HTML, handcrafted responsive CSS with light/dark mode (`light-dark()`), `@container` responsive tables, native `<dialog>` modals, and `popover="manual"` notifications
- **Testing**: Vitest + Supertest (unit, DB rules, API integration, BOLA/RBAC authorization, and 20-request concurrency test)

## Out of Scope (Intentional)
- Tuition/fee payments
- Automated institution-wide timetable generation
- Real-time chat
- Native mobile applications

## Quick Start (Zero Docker, Zero Heavy Setup)

From `university-sms/`:

```sh
# 1. Install dependencies (lightweight JS/WASM packages only)
npm --prefix backend install --no-audit --no-fund
npm --prefix frontend install --no-audit --no-fund

# 2. Initialize schema & compact seed dataset
npm run db:migrate
npm run db:seed

# 3. Start backend (http://localhost:4000) & frontend (http://localhost:5173)
npm run dev
```

Swagger API documentation is served live at `http://localhost:4000/api/docs`.

## Demo Logins

| Role | Email | Password |
| :--- | :--- | :--- |
| **Student** | `nadia.mansour@galala.edu.eg` | `Student123!` |
| **Instructor** | `amina.darwish@galala.edu.eg` | `Instructor123!` |
| **Admin** | `admin@galala.edu.eg` | `AdminPass123!` |

## Useful Commands

```sh
npm test              # Run all 5 backend test suites (unit, DB rules, API, authz, concurrency)
npm run build         # Production frontend build
npm run lint:sql      # Verify no raw string/template SQL interpolation
npm run db:verify-backup  # Create compressed backup + verify restore row counts in throwaway DB
npm run db:explain    # Run in-memory EXPLAIN (ANALYZE, BUFFERS) before/after index benchmark
npm run db:import-csv # CLI legacy CSV migration (writes bad rows to .errors.csv)
npm run db:reset      # Reset local DB and re-seed compact dataset
```

## Documentation Deliverables
- [ER Diagram](docs/er-diagram.png) ([SVG](docs/er-diagram.svg))
- [OpenAPI Specification](docs/openapi.yaml)
- [Postman Collection](docs/postman_collection.json)
- [Design Decisions](docs/design-decisions.md)
- [Security Controls](docs/security.md)
- [Query Performance & EXPLAIN ANALYZE](docs/performance.md)
- [Operations, Backup & Deployment](docs/operations.md)
- [MySQL 8.0 Portability Reference](docs/mysql-port/courses.mysql.sql)
