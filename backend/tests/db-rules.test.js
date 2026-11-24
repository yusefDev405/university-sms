import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as db from '../src/config/db.js';
import { setupTestEnv, teardownTestEnv } from './setup.js';

beforeAll(async () => {
  await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('Database rules: enroll_student(), triggers, and views', () => {
  it('rejects enrollment when registration window is closed', async () => {
    const studentRes = await db.query("SELECT id FROM students WHERE student_number = '2024001'");
    const closedOff = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN terms t ON t.id = o.term_id
       WHERE t.name = 'Fall 2026' LIMIT 1`
    );
    await expect(
      db.query('SELECT enroll_student($1, $2)', [studentRes.rows[0].id, closedOff.rows[0].id])
    ).rejects.toThrow(/Registration is closed/);
  });

  it('rejects enrollment when prerequisites are not completed with passing grade', async () => {
    // Student 2024005 (Mariam) only completed ENG102, not CS101/CS201 -> cannot enroll in CS301
    const studentRes = await db.query("SELECT id FROM students WHERE student_number = '2024005'");
    const cs301Off = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN courses c ON c.id = o.course_id
       JOIN terms t ON t.id = o.term_id
       WHERE c.code = 'CS301' AND t.name = 'Spring 2027'`
    );
    await expect(
      db.query('SELECT enroll_student($1, $2)', [studentRes.rows[0].id, cs301Off.rows[0].id])
    ).rejects.toThrow(/Prerequisites not met/);
  });

  it('rejects enrollment when meeting times overlap in the same term', async () => {
    // Nadia (2024001) is enrolled in CS201 (Mon/Wed 10:00-11:30). MATH210 overlaps (Mon/Wed 10:30-12:00)
    const studentRes = await db.query("SELECT id FROM students WHERE student_number = '2024001'");
    const math210Off = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN courses c ON c.id = o.course_id
       JOIN terms t ON t.id = o.term_id
       WHERE c.code = 'MATH210' AND t.name = 'Spring 2027'`
    );
    await expect(
      db.query('SELECT enroll_student($1, $2)', [studentRes.rows[0].id, math210Off.rows[0].id])
    ).rejects.toThrow(/Schedule conflict/);
  });

  it('places student on waitlist when offering is at capacity and auto-promotes on drop', async () => {
    // CS202 Spring 2027 has capacity=2 and already has 2 enrolled (2024002 and 2024003)
    const nadia = await db.query("SELECT id, user_id FROM students WHERE student_number = '2024001'");
    const omar = await db.query("SELECT id FROM students WHERE student_number = '2024002'");
    const cs202Off = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN courses c ON c.id = o.course_id
       JOIN terms t ON t.id = o.term_id
       WHERE c.code = 'CS202' AND t.name = 'Spring 2027'`
    );
    const offId = cs202Off.rows[0].id;

    const res = await db.withTransaction(
      (tx) => tx.query('SELECT enroll_student($1, $2) AS status', [nadia.rows[0].id, offId]),
      { actorUserId: nadia.rows[0].user_id }
    );
    expect(res.rows[0].status).toBe('waitlisted');

    // Verify duplicate enrollment raises 23505
    await expect(
      db.query('SELECT enroll_student($1, $2)', [nadia.rows[0].id, offId])
    ).rejects.toMatchObject({ code: '23505' });

    // Omar drops CS202 -> trigger auto-promotes Nadia from waitlisted to enrolled
    await db.withTransaction(
      (tx) =>
        tx.query(
          "UPDATE enrollments SET status = 'dropped' WHERE student_id = $1 AND offering_id = $2",
          [omar.rows[0].id, offId]
        ),
      { actorUserId: nadia.rows[0].user_id }
    );

    const nadiaAfter = await db.query(
      'SELECT status FROM enrollments WHERE student_id = $1 AND offering_id = $2',
      [nadia.rows[0].id, offId]
    );
    expect(nadiaAfter.rows[0].status).toBe('enrolled');

    // Audit trigger recorded actor_user_id and JSONB snapshots
    const auditRes = await db.query(
      "SELECT actor_user_id, action, entity, new_data FROM audit_log WHERE entity = 'enrollments' ORDER BY id DESC LIMIT 1"
    );
    expect(Number(auditRes.rows[0].actor_user_id)).toBe(Number(nadia.rows[0].user_id));
    expect(auditRes.rows[0].new_data.status).toBe('enrolled');
  });

  it('enforces 12-credit Academic Probation cap inside enroll_student()', async () => {
    // Student 2024006 (Karim) has F (0.00 GPA -> Academic Probation, max 12 credits) and 3 credits in BUS105
    const karim = await db.query("SELECT id FROM students WHERE student_number = '2024006'");
    const dept = await db.query("SELECT id FROM departments WHERE code = 'CS'");
    const term = await db.query("SELECT id FROM terms WHERE name = 'Spring 2027'");
    const instr = await db.query('SELECT id FROM instructors LIMIT 1');

    // Create two 5-credit courses and add them (3 + 5 = 8 <= 12 OK, then +5 = 13 > 12 BLOCKED)
    const c1 = await db.query(
      "INSERT INTO courses (code, title, credits, department_id) VALUES ('CAP501', 'Heavy Lab I', 5, $1) RETURNING id",
      [dept.rows[0].id]
    );
    const o1 = await db.query(
      "INSERT INTO course_offerings (course_id, term_id, instructor_id, section, capacity, room) VALUES ($1, $2, $3, '01', 10, 'R1') RETURNING id",
      [c1.rows[0].id, term.rows[0].id, instr.rows[0].id]
    );
    const c2 = await db.query(
      "INSERT INTO courses (code, title, credits, department_id) VALUES ('CAP502', 'Heavy Lab II', 5, $1) RETURNING id",
      [dept.rows[0].id]
    );
    const o2 = await db.query(
      "INSERT INTO course_offerings (course_id, term_id, instructor_id, section, capacity, room) VALUES ($1, $2, $3, '01', 10, 'R2') RETURNING id",
      [c2.rows[0].id, term.rows[0].id, instr.rows[0].id]
    );

    const first = await db.query('SELECT enroll_student($1, $2) AS status', [karim.rows[0].id, o1.rows[0].id]);
    expect(first.rows[0].status).toBe('enrolled');

    await expect(
      db.query('SELECT enroll_student($1, $2)', [karim.rows[0].id, o2.rows[0].id])
    ).rejects.toThrow(/Credit limit exceeded \(max 12 credits\)/);
  });

  it('replaces repeated course grades with the highest grade in v_student_gpa', async () => {
    // Student 2024006 (Karim) failed CS101 (0.00, 3cr) in Fall 2026 -> GPA 0.00.
    // Retaking CS101 in Spring 2027 and earning A (4.00) replaces the F in GPA!
    const karim = await db.query("SELECT id FROM students WHERE student_number = '2024006'");
    const cs101Spring = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN courses c ON c.id = o.course_id
       JOIN terms t ON t.id = o.term_id
       WHERE c.code = 'CS101' AND t.name = 'Spring 2027'`
    );
    await db.query(
      `INSERT INTO enrollments (student_id, offering_id, status, grade_points, grade_letter)
       VALUES ($1, $2, 'completed', 4.00, 'A')`,
      [karim.rows[0].id, cs101Spring.rows[0].id]
    );

    const gpaRes = await db.query('SELECT gpa, credits_earned FROM v_student_gpa WHERE student_id = $1', [
      karim.rows[0].id
    ]);
    expect(Number(gpaRes.rows[0].gpa)).toBe(4.0);
    expect(gpaRes.rows[0].credits_earned).toBe(3);
  });

  it('blocks enrollment when an active academic_hold exists until resolved', async () => {
    const salma = await db.query("SELECT id FROM students WHERE student_number = '2024003'");
    const math201 = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN courses c ON c.id = o.course_id
       JOIN terms t ON t.id = o.term_id
       WHERE c.code = 'MATH201' AND t.name = 'Spring 2027'`
    );
    const hold = await db.query(
      "INSERT INTO academic_holds (student_id, reason) VALUES ($1, 'Advising hold') RETURNING id",
      [salma.rows[0].id]
    );
    await expect(
      db.query('SELECT enroll_student($1, $2)', [salma.rows[0].id, math201.rows[0].id])
    ).rejects.toThrow(/Registration hold active/);

    await db.query('UPDATE academic_holds SET resolved_at = now() WHERE id = $1', [hold.rows[0].id]);
    const ok = await db.query('SELECT enroll_student($1, $2) AS status', [salma.rows[0].id, math201.rows[0].id]);
    expect(ok.rows[0].status).toBe('enrolled');
  });
});
