# Database Migrations

Forward-only numbered SQL migrations live in `db/migrations/` and are tracked in the `schema_migrations` table by `db/scripts/migrate.js`.

| Order | Forward file | Down file | Purpose |
| :--- | :--- | :--- | :--- |
| 001 | `001_schema.sql` | `down/001_schema.down.sql` | 12 normalized 3NF tables, identity PKs, natural key constraints, CHECK rules |
| 002 | `002_views.sql` | `down/002_views.down.sql` | `v_student_transcript`, `v_student_gpa`, `v_offering_availability`, `v_instructor_roster` |
| 003 | `003_functions.sql` | `down/003_functions.down.sql` | `enroll_student(p_student_id, p_offering_id)` PL/pgSQL transaction-safe function |
| 004 | `004_triggers.sql` | `down/004_triggers.down.sql` | `audit_row()` audit trigger + `promote_waitlist_on_drop()` trigger |
| 005 | `005_indexes.sql` | `down/005_indexes.down.sql` | Composite, partial, and lookup indexes |
| 006 | `006_attendance_and_rules.sql` | `down/006_attendance_and_rules.down.sql` | Attendance tables & view, login lockout columns, course audit trigger, term credit-hour cap in `enroll_student()` |
