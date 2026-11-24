# Architecture & Design Decisions

## 1. Why PostgreSQL & Raw Parameterized SQL (No ORM)
- The core domain rules (seat-capacity race prevention, prerequisite graphs, schedule overlap detection, credit-weighted GPA views, window-ranked department standings, and row-level audit triggers) belong close to the data.
- Writing SQL explicitly in `.sql` migration files and repository modules keeps query plans transparent, enables `EXPLAIN (ANALYZE, BUFFERS)` tuning, and avoids ORM abstraction leakage.
- **Zero-Heavy-Install Local Engine (`@electric-sql/pglite` + `pg`)**: Locally, `backend/src/config/db.js` runs real PostgreSQL 16 via `@electric-sql/pglite` (WASM) so developers and reviewers need no Docker, no system PostgreSQL daemon, and no heavyweight disk footprint. Setting `DATABASE_URL` seamlessly switches the exact same SQL layer to a standard `pg.Pool` connection against external PostgreSQL 16+.

## 2. Normalized 3NF Schema Choices
- **Courses vs. Offerings**: `courses` holds timeless catalogue metadata (`CS201`, credits, prerequisites). `course_offerings` represents a specific section taught in one `term` by one `instructor` in a `room` with a `capacity`.
- **Users vs. Role Profiles**: Authentication credentials (`email`, `password_hash`, `role`, `is_active`) live in `users`, while domain attributes live in `students` and `instructors` via 1:1 `UNIQUE` foreign keys.
- **Surrogate & Natural Keys**: Every primary entity uses `BIGINT GENERATED ALWAYS AS IDENTITY` for compact foreign-key joins, while natural identifiers (`student_number`, `courses.code`, `departments.code`, `lower(users.email)`) are enforced with `UNIQUE` constraints/indexes.
- **Soft Deactivation & Auditability**: `users.is_active`, `students.status`, and `enrollments.status = 'dropped'` preserve historical transcripts and foreign-key integrity (`ON DELETE RESTRICT`). Every `enrollments` and `terms` mutation fires `audit_row()` (`db/migrations/004_triggers.sql`) reading transaction-local `app.user_id`.
- **UTC Timestamps**: All time instants use `TIMESTAMPTZ` stored in UTC.

## 3. Transactional Concurrency & Stored Function
- `enroll_student(p_student_id, p_offering_id)` acquires `SELECT ... FROM course_offerings WHERE id = $1 FOR UPDATE`, ensuring two concurrent requests for the final seat serialize on the offering row lock rather than overselling capacity.
- Dropping an enrolled student (`UPDATE enrollments SET status = 'dropped'`) fires `promote_waitlist_on_drop()`, promoting the earliest conflict-free waitlisted student in the same transaction.

## 4. Deliberate Scope Boundaries
Out of scope by design: tuition/fee payment gateways, automated university-wide timetable generation, real-time chat, and native mobile apps.
