import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as db from '../src/config/db.js';
import { setupTestEnv, teardownTestEnv } from './setup.js';

let app;

beforeAll(async () => {
  app = await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

async function getToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.accessToken;
}

describe('Authorization: RBAC & BOLA ownership checks', () => {
  it('blocks unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('prevents a student from reading another student record or admin routes', async () => {
    const nadiaToken = await getToken('nadia.mansour@galala.edu.eg', 'Student123!');

    const otherStudent = await request(app)
      .get('/api/v1/students/2')
      .set('Authorization', `Bearer ${nadiaToken}`);
    expect(otherStudent.status).toBe(403);

    const auditAttempt = await request(app)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${nadiaToken}`);
    expect(auditAttempt.status).toBe(403);

    const createCourse = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${nadiaToken}`)
      .send({ code: 'HACK101', title: 'Nope', credits: 3, departmentId: 1 });
    expect(createCourse.status).toBe(403);
  });

  it('prevents a student from dropping another student enrollment (BOLA)', async () => {
    const nadiaToken = await getToken('nadia.mansour@galala.edu.eg', 'Student123!');
    const omarEnrollment = await db.query(
      `SELECT e.id FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE s.student_number = '2024002' AND e.status = 'enrolled' LIMIT 1`
    );

    const dropOther = await request(app)
      .delete(`/api/v1/enrollments/${omarEnrollment.rows[0].id}`)
      .set('Authorization', `Bearer ${nadiaToken}`);
    expect(dropOther.status).toBe(403);
  });

  it('prevents an instructor from reading or grading another instructor offering (BOLA)', async () => {
    // Prof. Amina Darwish does NOT teach MATH201 (taught by Dr. Hisham Lotfy)
    const aminaToken = await getToken('amina.darwish@galala.edu.eg', 'Instructor123!');

    const math201Off = await db.query(
      `SELECT o.id FROM course_offerings o
       JOIN courses c ON c.id = o.course_id
       WHERE c.code = 'MATH201' LIMIT 1`
    );
    const offId = math201Off.rows[0].id;

    const foreignRoster = await request(app)
      .get(`/api/v1/offerings/${offId}/roster`)
      .set('Authorization', `Bearer ${aminaToken}`);
    expect(foreignRoster.status).toBe(403);

    const hishamEnrollment = await db.query(
      `SELECT id FROM enrollments WHERE offering_id = $1 AND status = 'enrolled' LIMIT 1`,
      [offId]
    );

    const foreignGrade = await request(app)
      .put(`/api/v1/enrollments/${hishamEnrollment.rows[0].id}/grade`)
      .set('Authorization', `Bearer ${aminaToken}`)
      .send({ gradeLetter: 'A' });
    expect(foreignGrade.status).toBe(403);

    // Instructor also cannot inspect a student who is NOT in their rosters
    const ziad = await db.query("SELECT id FROM students WHERE student_number = '2024008'");
    const foreignStudent = await request(app)
      .get(`/api/v1/students/${ziad.rows[0].id}`)
      .set('Authorization', `Bearer ${aminaToken}`);
    expect(foreignStudent.status).toBe(403);

    const foreignAttendance = await request(app)
      .get(`/api/v1/offerings/${offId}/attendance`)
      .set('Authorization', `Bearer ${aminaToken}`);
    expect(foreignAttendance.status).toBe(403);
  });

  it('rejects refresh requests missing the custom CSRF header', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REQUIRED');
  });
});
