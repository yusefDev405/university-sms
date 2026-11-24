import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as db from '../src/config/db.js';
import { signAccessToken } from '../src/utils/tokens.js';
import { setupTestEnv, teardownTestEnv } from './setup.js';

let app;

beforeAll(async () => {
  app = await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

describe('Concurrency: 20 parallel enrollment requests for a 5-seat offering', () => {
  it('enrolls exactly 5 students and waitlists the remaining 15 with zero overbooking', async () => {
    const dept = await db.query("SELECT id FROM departments WHERE code = 'CS'");
    const term = await db.query("SELECT id FROM terms WHERE name = 'Spring 2027'");
    const instr = await db.query('SELECT id FROM instructors LIMIT 1');

    const courseRes = await db.query(
      `INSERT INTO courses (code, title, credits, department_id)
       VALUES ('CS499', 'Concurrency Lab', 3, $1) RETURNING id`,
      [dept.rows[0].id]
    );
    const offeringRes = await db.query(
      `INSERT INTO course_offerings (course_id, term_id, instructor_id, section, capacity, room)
       VALUES ($1, $2, $3, '01', 5, 'Lab Z-100') RETURNING id`,
      [courseRes.rows[0].id, term.rows[0].id, instr.rows[0].id]
    );
    const offeringId = offeringRes.rows[0].id;

    // Create 20 test students in memory
    const pwHash = await bcrypt.hash('Student123!', 4);
    const tokens = [];
    for (let i = 1; i <= 20; i++) {
      const uRes = await db.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'student') RETURNING id`,
        [`conc${i}@galala.edu.eg`, pwHash]
      );
      const userId = uRes.rows[0].id;
      await db.query(
        `INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id)
         VALUES ($1, $2, $3, 'Tester', '2005-01-01', $4)`,
        [userId, `CONC${String(i).padStart(3, '0')}`, `Student${i}`, dept.rows[0].id]
      );
      tokens.push(signAccessToken({ userId, role: 'student' }));
    }

    // Fire all 20 enrollment HTTP requests concurrently
    const responses = await Promise.all(
      tokens.map((token) =>
        request(app)
          .post('/api/v1/enrollments')
          .set('Authorization', `Bearer ${token}`)
          .send({ offeringId })
      )
    );

    const statuses = responses.map((r) => {
      expect(r.status).toBe(201);
      return r.body.data.status;
    });

    const enrolledCount = statuses.filter((s) => s === 'enrolled').length;
    const waitlistedCount = statuses.filter((s) => s === 'waitlisted').length;

    expect(enrolledCount).toBe(5);
    expect(waitlistedCount).toBe(15);

    const dbCounts = await db.query(
      `SELECT
         count(*) FILTER (WHERE status = 'enrolled')::INT AS enrolled,
         count(*) FILTER (WHERE status = 'waitlisted')::INT AS waitlisted
       FROM enrollments WHERE offering_id = $1`,
      [offeringId]
    );
    expect(dbCounts.rows[0]).toEqual({ enrolled: 5, waitlisted: 15 });
  });
});
