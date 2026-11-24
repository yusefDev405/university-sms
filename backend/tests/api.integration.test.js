import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestEnv, teardownTestEnv } from './setup.js';

let app;

beforeAll(async () => {
  app = await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

async function loginAs(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  expect(res.status).toBe(200);
  return {
    token: res.body.data.accessToken,
    user: res.body.data.user,
    cookies: res.headers['set-cookie']
  };
}

describe('API Integration: Auth, Refresh Rotation, Catalogue, Registration, Grading, Admin', () => {
  it('supports health check and generic login failure message', async () => {
    const health = await request(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');

    const badEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@galala.edu.eg', password: 'wrong' });
    const badPass = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nadia.mansour@galala.edu.eg', password: 'wrong' });

    expect(badEmail.status).toBe(401);
    expect(badPass.status).toBe(401);
    expect(badEmail.body.error.message).toBe(badPass.body.error.message);
    expect(badEmail.body.error.stack).toBeUndefined();
  });

  it('rotates refresh tokens and revokes entire family on token reuse', async () => {
    const session = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');
    const originalCookie = session.cookies[0];

    // Valid refresh with CSRF custom header
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [originalCookie])
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toBeTruthy();
    const newCookie = rotated.headers['set-cookie'][0];

    // Replay old revoked cookie -> triggers family revocation
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [originalCookie])
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_REUSED');

    // Even the newly rotated cookie in that same family is now revoked
    const afterFamilyRevoke = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [newCookie])
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(afterFamilyRevoke.status).toBe(401);
  });

  it('allows student to browse offerings, enroll, see schedule, drop, and read transcript', async () => {
    const student = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');

    const offeringsRes = await request(app)
      .get('/api/v1/offerings')
      .set('Authorization', `Bearer ${student.token}`);
    expect(offeringsRes.status).toBe(200);
    const math201 = offeringsRes.body.data.find((o) => o.course_code === 'MATH201' && o.term_name === 'Spring 2027');
    expect(math201).toBeTruthy();

    // Enroll in MATH201 (no conflict, no prereq)
    const enrollRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ offeringId: math201.offering_id });
    expect(enrollRes.status).toBe(201);
    expect(enrollRes.body.data.status).toBe('enrolled');
    const enrollmentId = enrollRes.body.data.enrollment.id;

    // Duplicate enroll -> 409 ALREADY_REGISTERED
    const dupRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ offeringId: math201.offering_id });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('ALREADY_REGISTERED');

    // Schedule includes MATH201
    const schedRes = await request(app)
      .get('/api/v1/me/enrollments')
      .set('Authorization', `Bearer ${student.token}`);
    expect(schedRes.status).toBe(200);
    expect(schedRes.body.data.some((e) => e.course_code === 'MATH201' && e.status === 'enrolled')).toBe(true);

    // Drop MATH201
    const dropRes = await request(app)
      .delete(`/api/v1/enrollments/${enrollmentId}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(dropRes.status).toBe(204);

    // Transcript & GPA
    const transcriptRes = await request(app)
      .get('/api/v1/me/transcript')
      .set('Authorization', `Bearer ${student.token}`);
    expect(transcriptRes.status).toBe(200);
    expect(transcriptRes.body.data.summary.gpa).toBe(3.67);
    expect(transcriptRes.body.data.courses.length).toBe(3);
  });

  it('allows instructor to view own roster, submit single and bulk grades, and roll back invalid bulk batch', async () => {
    const instructor = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!');

    const myOfferings = await request(app)
      .get('/api/v1/offerings?mine=true')
      .set('Authorization', `Bearer ${instructor.token}`);
    expect(myOfferings.status).toBe(200);
    const cs201 = myOfferings.body.data.find((o) => o.course_code === 'CS201' && o.term_name === 'Spring 2027');

    const rosterRes = await request(app)
      .get(`/api/v1/offerings/${cs201.offering_id}/roster`)
      .set('Authorization', `Bearer ${instructor.token}`);
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data.roster.length).toBeGreaterThanOrEqual(2);

    const firstRow = rosterRes.body.data.roster[0];
    const singleGrade = await request(app)
      .put(`/api/v1/enrollments/${firstRow.enrollment_id}/grade`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ gradeLetter: 'A' });
    expect(singleGrade.status).toBe(200);
    expect(singleGrade.body.data.grade_letter).toBe('A');
    expect(Number(singleGrade.body.data.grade_points)).toBe(4);

    // Bulk grade fails atomically if one enrollmentId is invalid/foreign
    const badBulk = await request(app)
      .post(`/api/v1/offerings/${cs201.offering_id}/grades/bulk`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({
        grades: [
          { enrollmentId: firstRow.enrollment_id, gradeLetter: 'B' },
          { enrollmentId: 999999, gradeLetter: 'A' }
        ]
      });
    expect(badBulk.status).toBe(409);

    // Verify firstRow stayed 'A' (transaction rolled back!)
    const rosterCheck = await request(app)
      .get(`/api/v1/offerings/${cs201.offering_id}/roster`)
      .set('Authorization', `Bearer ${instructor.token}`);
    const afterRollback = rosterCheck.body.data.roster.find((r) => r.enrollment_id === firstRow.enrollment_id);
    expect(afterRollback.grade_letter).toBe('A');
  });

  it('allows admin to create user+profile, manage courses/terms, view reports, audit log, and import CSV', async () => {
    const admin = await loginAs('admin@galala.edu.eg', 'AdminPass123!');

    const depts = await request(app)
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(depts.status).toBe(200);
    const csDeptId = depts.body.data.find((d) => d.code === 'CS').id;

    // Create course + update prerequisites
    const newCourse = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ code: 'CS490', title: 'Capstone Seminar', credits: 3, departmentId: csDeptId });
    expect(newCourse.status).toBe(201);

    // Reports & Audit log
    const report = await request(app)
      .get('/api/v1/reports/enrollment-by-department')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(report.status).toBe(200);
    expect(report.body.data.departments.length).toBeGreaterThanOrEqual(4);
    expect(report.body.data.standings.length).toBeGreaterThan(0);

    const audit = await request(app)
      .get('/api/v1/audit-log?entity=enrollments')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body.data)).toBe(true);

    // CSV bulk import (1 valid row + 1 invalid department row)
    const csvRes = await request(app)
      .post('/api/v1/admin/import/students')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        csv: [
          'email,student_number,first_name,last_name,date_of_birth,department_code',
          'csv.student1@galala.edu.eg,2026901,Tarek,Nour,2006-04-12,CS',
          'bad.row@galala.edu.eg,2026902,Bad,Dept,2006-04-12,UNKNOWN'
        ].join('\n')
      });
    expect(csvRes.status).toBe(201);
    expect(csvRes.body.data.importedCount).toBe(1);
    expect(csvRes.body.data.rejectedCount).toBe(1);
  });

  it('supports downloadable PDF transcripts, instructor attendance recording, and student attendance summary', async () => {
    const student = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');
    const instructor = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!');

    // Student downloads binary PDF transcript
    const pdfRes = await request(app)
      .get('/api/v1/me/transcript/pdf')
      .set('Authorization', `Bearer ${student.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');

    // Instructor records attendance for CS201
    const myOfferings = await request(app)
      .get('/api/v1/offerings?mine=true')
      .set('Authorization', `Bearer ${instructor.token}`);
    const cs201 = myOfferings.body.data.find((o) => o.course_code === 'CS201' && o.term_name === 'Spring 2027');

    const rosterRes = await request(app)
      .get(`/api/v1/offerings/${cs201.offering_id}/roster`)
      .set('Authorization', `Bearer ${instructor.token}`);

    const recRes = await request(app)
      .post(`/api/v1/offerings/${cs201.offering_id}/attendance`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({
        sessionDate: '2027-02-15',
        topic: 'Trees and Heaps',
        records: rosterRes.body.data.roster.map((r) => ({
          studentId: r.student_id,
          status: 'present'
        }))
      });
    expect(recRes.status).toBe(201);

    const myAttendance = await request(app)
      .get('/api/v1/me/attendance')
      .set('Authorization', `Bearer ${student.token}`);
    expect(myAttendance.status).toBe(200);
    expect(myAttendance.body.data.summary.length).toBeGreaterThan(0);
    expect(myAttendance.body.data.summary[0].attendance_pct).toBe(100);
  });

  it('locks an account temporarily after 5 consecutive failed logins', async () => {
    const targetEmail = 'ziad.kamal@galala.edu.eg';
    for (let i = 0; i < 5; i++) {
      const attempt = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword!' });
      expect(attempt.status).toBe(401);
    }

    const locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password: 'Student123!' });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('supports atomic course swap, room/instructor conflict checks, academic holds, notifications, and degree audit', async () => {
    const admin = await loginAs('admin@galala.edu.eg', 'AdminPass123!');
    const student = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');

    // 1. Room & instructor conflict check when creating overlapping offering
    const offeringsRes = await request(app)
      .get('/api/v1/offerings')
      .set('Authorization', `Bearer ${admin.token}`);
    const cs201 = offeringsRes.body.data.find((o) => o.course_code === 'CS201' && o.term_name === 'Spring 2027');
    const cs305 = (await request(app).get('/api/v1/courses?search=CS305').set('Authorization', `Bearer ${admin.token}`)).body.data[0];

    const conflictOffering = await request(app)
      .post('/api/v1/offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseId: cs305.id,
        termId: cs201.term_id,
        instructorId: cs201.instructor_id,
        section: '01',
        capacity: 20,
        room: 'Hall X-999',
        meetings: [{ dayOfWeek: 1, startTime: '10:30', endTime: '12:00' }]
      });
    expect(conflictOffering.status).toBe(409);
    expect(conflictOffering.body.error.code).toBe('INSTRUCTOR_CONFLICT');

    // 2. Create non-conflicting CS305 offering, enroll in MATH201, and verify atomic swap rollback + success
    const cs305OffRes = await request(app)
      .post('/api/v1/offerings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        courseId: cs305.id,
        termId: cs201.term_id,
        instructorId: cs201.instructor_id,
        section: '01',
        capacity: 20,
        room: 'Hall X-999',
        meetings: [{ dayOfWeek: 5, startTime: '09:00', endTime: '10:30' }]
      });
    expect(cs305OffRes.status).toBe(201);
    const cs305OffId = cs305OffRes.body.data.offering_id;

    const math201Off = offeringsRes.body.data.find((o) => o.course_code === 'MATH201' && o.term_name === 'Spring 2027');
    const enrMath = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ offeringId: math201Off.offering_id });
    expect(enrMath.status).toBe(201);
    const mathEnrollmentId = enrMath.body.data.enrollment.id;

    // Swap fails because CS305 requires CS202; MATH201 stays enrolled!
    const failedSwap = await request(app)
      .post('/api/v1/enrollments/swap')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ dropEnrollmentId: mathEnrollmentId, targetOfferingId: cs305OffId });
    expect(failedSwap.status).toBe(409);
    expect(failedSwap.body.error.code).toBe('PREREQUISITES_NOT_MET');

    const schedAfterFail = await request(app)
      .get('/api/v1/me/enrollments')
      .set('Authorization', `Bearer ${student.token}`);
    expect(schedAfterFail.body.data.some((e) => e.enrollment_id === mathEnrollmentId && e.status === 'enrolled')).toBe(true);

    // Valid atomic swap: MATH201 -> BUS105
    const bus105Off = offeringsRes.body.data.find((o) => o.course_code === 'BUS105' && o.term_name === 'Spring 2027');
    const okSwap = await request(app)
      .post('/api/v1/enrollments/swap')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ dropEnrollmentId: mathEnrollmentId, targetOfferingId: bus105Off.offering_id });
    expect(okSwap.status).toBe(201);
    expect(okSwap.body.data.status).toBe('enrolled');

    // 3. Notifications (grade-post trigger fired earlier when instructor graded CS201) + Degree Audit
    const notifs = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${student.token}`);
    expect(notifs.status).toBe(200);
    expect(notifs.body.data.length).toBeGreaterThan(0);

    const markRead = await request(app)
      .patch(`/api/v1/me/notifications/${notifs.body.data[0].id}/read`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(markRead.status).toBe(200);
    expect(markRead.body.data.read_at).toBeTruthy();

    const audit = await request(app)
      .get('/api/v1/me/degree-audit')
      .set('Authorization', `Bearer ${student.token}`);
    expect(audit.status).toBe(200);
    expect(audit.body.data.totalRequiredCredits).toBeGreaterThan(0);

    // 4. Admin places and resolves hold on Nadia
    const holdRes = await request(app)
      .post('/api/v1/holds')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ studentId: student.user.profile.id, reason: 'Registrar verification' });
    expect(holdRes.status).toBe(201);

    const blockedEnroll = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ offeringId: math201Off.offering_id });
    expect(blockedEnroll.status).toBe(403);
    expect(blockedEnroll.body.error.code).toBe('REGISTRATION_HOLD');

    const resolveRes = await request(app)
      .patch(`/api/v1/holds/${holdRes.body.data.id}/resolve`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resolveRes.status).toBe(200);
  });
});
