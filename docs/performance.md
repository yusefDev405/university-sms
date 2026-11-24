# Query Performance & Indexing (`EXPLAIN ANALYZE`)

To keep local disk usage minimal, the benchmark script (`db/scripts/explain_demo.js`) boots a **throwaway in-memory PostgreSQL 16 instance** (`@electric-sql/pglite`), generates 3,000 students and 12,000 non-conflicting enrollment rows using `generate_series`, and executes `EXPLAIN (ANALYZE, BUFFERS)` **before** and **after** applying `db/migrations/005_indexes.sql` and `VACUUM ANALYZE`.

## Target Query (Student Completed Transcript Lookup)

```sql
SELECT e.id, c.code, c.title, t.name AS term_name, e.grade_letter, e.grade_points
FROM enrollments e
JOIN course_offerings o ON o.id = e.offering_id
JOIN courses c ON c.id = o.course_id
JOIN terms t ON t.id = o.term_id
WHERE e.student_id = 42 AND e.status = 'completed';
```

## Before Indexing (`005_indexes.sql` not yet applied)

Without `idx_enrollments_student_status`, PostgreSQL can only use the `(student_id, offering_id)` unique index and must fetch heap rows to filter `status = 'completed'`:

```text
Nested Loop  (cost=18.59..23.67 rows=3 width=37) (actual time=1.176..1.788 rows=4 loops=1)
  Buffers: shared hit=27
  ->  Nested Loop  (cost=18.46..23.06 rows=3 width=38) (actual time=1.158..1.738 rows=4 loops=1)
        Buffers: shared hit=19
        ->  Hash Join  (cost=18.32..22.36 rows=3 width=34) (actual time=1.043..1.571 rows=4 loops=1)
              Hash Cond: (o.id = e.offering_id)
              Buffers: shared hit=11
              ->  Seq Scan on course_offerings o  (cost=0.00..3.60 rows=160 width=24) (actual time=0.104..1.061 rows=160 loops=1)
                    Buffers: shared hit=2
              ->  Hash  (cost=18.29..18.29 rows=3 width=26) (actual time=0.211..0.218 rows=4 loops=1)
                    ->  Bitmap Heap Scan on enrollments e  (cost=4.32..18.29 rows=3 width=26) (actual time=0.135..0.164 rows=4 loops=1)
                          Recheck Cond: (student_id = 42)
                          Filter: (status = 'completed'::text)
                          Heap Blocks: exact=4
                          Buffers: shared hit=9
                          ->  Bitmap Index Scan on enrollments_student_id_offering_id_key  (cost=0.00..4.32 rows=4 width=0) (actual time=0.107..0.109 rows=4 loops=1)
                                Index Cond: (student_id = 42)
Planning Time: 3.416 ms
Execution Time: 2.151 ms
```

## After Indexing (`idx_enrollments_student_status` + `VACUUM ANALYZE`)

```sql
CREATE INDEX idx_enrollments_student_status ON enrollments (student_id, status);
VACUUM ANALYZE;
```

```text
Nested Loop  (cost=15.31..20.39 rows=3 width=37) (actual time=0.481..1.321 rows=4 loops=1)
  Buffers: shared hit=22 read=2
  ->  Nested Loop  (cost=15.18..19.78 rows=3 width=38) (actual time=0.459..1.069 rows=4 loops=1)
        Buffers: shared hit=14 read=2
        ->  Hash Join  (cost=15.04..19.07 rows=3 width=34) (actual time=0.432..0.983 rows=4 loops=1)
              Hash Cond: (o.id = e.offering_id)
              Buffers: shared hit=6 read=2
              ->  Seq Scan on course_offerings o  (cost=0.00..3.60 rows=160 width=24) (actual time=0.024..0.336 rows=160 loops=1)
                    Buffers: shared hit=2
              ->  Hash  (cost=15.00..15.00 rows=3 width=26) (actual time=0.233..0.240 rows=4 loops=1)
                    ->  Bitmap Heap Scan on enrollments e  (cost=4.32..15.00 rows=3 width=26) (actual time=0.139..0.204 rows=4 loops=1)
                          Recheck Cond: ((student_id = 42) AND (status = 'completed'::text))
                          Heap Blocks: exact=4
                          ->  Bitmap Index Scan on idx_enrollments_student_status  (cost=0.00..4.32 rows=3 width=0) (actual time=0.113..0.114 rows=4 loops=1)
                                Index Cond: ((student_id = 42) AND (status = 'completed'::text))
Planning Time: 3.145 ms
Execution Time: 1.554 ms
```

## Index Inventory & Trade-Offs

| Index | Purpose | Write / Selectivity Trade-Off |
| :--- | :--- | :--- |
| `idx_enrollments_student_status (student_id, status)` | Transcript & active student schedule lookups | High selectivity on `student_id`; minimal write overhead since enrollments change infrequently. |
| `idx_enrollments_offering_enrolled (offering_id) WHERE status = 'enrolled'` | Partial index for seat counts & instructor rosters | Excludes dropped/completed historical rows, keeping the B-tree small and faster to update. |
| `idx_course_offerings_term_course (term_id, course_id)` | Term-scoped course browsing | Covers term filter + course joins. |
| `idx_users_email_lower (lower(email))` | Case-insensitive login lookup & uniqueness | Avoids sequential scans on `lower(email)`. |
