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
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return {
    token: res.body.data.accessToken,
    user: res.body.data.user
  };
}

describe('Phase A & B: Gradebook, Appeals, Overrides, Equivalencies, Advising, Admissions & Graduation', () => {
  it('manages weighted gradebook assessments, enforces <=100% weight, computes final grades, and broadcasts announcements', async () => {
    const instructor = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!');
    const student = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');

    const cwRes = await request(app)
      .get('/api/v1/me/coursework')
      .set('Authorization', `Bearer ${student.token}`);
    expect(cwRes.status).toBe(200);
    const cs201 = cwRes.body.data.find((c) => c.course_code === 'CS201');
    expect(cs201).toBeTruthy();

    // Already 100% (20 + 30 + 50), adding +10% should fail 400 WEIGHT_LIMIT_EXCEEDED
    const tooHeavy = await request(app)
      .post(`/api/v1/offerings/${cs201.offering_id}/assessments`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ title: 'Bonus Quiz', category: 'quiz', weightPct: 10, maxScore: 20 });
    expect(tooHeavy.status).toBe(400);

    // Fetch gradebook and update final exam score for Nadia, then compute final grade
    const gbRes = await request(app)
      .get(`/api/v1/offerings/${cs201.offering_id}/gradebook`)
      .set('Authorization', `Bearer ${instructor.token}`);
    expect(gbRes.status).toBe(200);
    const finalAssessment = gbRes.body.data.assessments.find((a) => a.category === 'final');
    const nadiaRow = gbRes.body.data.students.find((s) => s.student_number === '2024001');

    const saveScore = await request(app)
      .put(`/api/v1/assessments/${finalAssessment.id}/scores`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ scores: [{ studentId: nadiaRow.student_id, score: 95 }] });
    expect(saveScore.status).toBe(200);

    const computed = await request(app)
      .post(`/api/v1/offerings/${cs201.offering_id}/grades/compute-from-gradebook`)
      .set('Authorization', `Bearer ${instructor.token}`);
    expect(computed.status).toBe(200);
    expect(computed.body.data.updatedCount).toBeGreaterThanOrEqual(2);

    // Broadcast announcement -> student receives notification
    const ann = await request(app)
      .post(`/api/v1/offerings/${cs201.offering_id}/announcements`)
      .set('Authorization', `Bearer ${instructor.token}`)
      .send({ title: 'Final Grades Published', body: 'Check your weighted scores and transcript.' });
    expect(ann.status).toBe(201);

    const notifs = await request(app)
      .get('/api/v1/me/notifications')
      .set('Authorization', `Bearer ${student.token}`);
    expect(notifs.body.data.some((n) => n.title.includes('Final Grades Published'))).toBe(true);
  });

  it('enforces Department Chair RBAC on grade appeals and revises grade atomically when approved', async () => {
    const nadia = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');
    const hisham = await loginAs('hisham.lotfy@galala.edu.eg', 'Instructor123!'); // Not chair
    const chair = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!'); // CS chair

    const trRes = await request(app)
      .get('/api/v1/me/transcript')
      .set('Authorization', `Bearer ${nadia.token}`);
    const cs101 = trRes.body.data.courses.find((c) => c.course_code === 'CS101');
    expect(cs101).toBeTruthy();

    const appeal = await request(app)
      .post('/api/v1/grade-appeals')
      .set('Authorization', `Bearer ${nadia.token}`)
      .send({ enrollmentId: cs101.enrollment_id, requestedReason: 'Bonus lab rubric points were omitted' });
    expect(appeal.status).toBe(201);

    const forbiddenReview = await request(app)
      .patch(`/api/v1/grade-appeals/${appeal.body.data.id}/decide`)
      .set('Authorization', `Bearer ${hisham.token}`)
      .send({ status: 'approved', revisedGrade: 'A', decisionNote: 'Attempt' });
    expect(forbiddenReview.status).toBe(403);

    const approved = await request(app)
      .patch(`/api/v1/grade-appeals/${appeal.body.data.id}/decide`)
      .set('Authorization', `Bearer ${chair.token}`)
      .send({ status: 'approved', revisedGrade: 'A', decisionNote: 'Verified bonus lab points' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.revised_grade).toBe('A');

    const trAfter = await request(app)
      .get('/api/v1/me/transcript')
      .set('Authorization', `Bearer ${nadia.token}`);
    const cs101After = trAfter.body.data.courses.find((c) => c.course_code === 'CS101');
    expect(cs101After.grade_letter).toBe('A');
  });

  it('allows approved prerequisite override petitions to unlock enrollment inside enroll_student()', async () => {
    const hana = await loginAs('hana.tarek@galala.edu.eg', 'Student123!'); // Has not completed CS201
    const chair = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!');

    const offRes = await request(app)
      .get('/api/v1/offerings?search=CS301')
      .set('Authorization', `Bearer ${hana.token}`);
    const cs301Off = offRes.body.data[0];
    expect(cs301Off).toBeTruthy();

    // Without override -> 409 PREREQUISITES_NOT_MET
    const blocked = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${hana.token}`)
      .send({ offeringId: cs301Off.offering_id });
    expect(blocked.status).toBe(409);

    // Submit prerequisite override petition
    const pet = await request(app)
      .post('/api/v1/override-petitions')
      .set('Authorization', `Bearer ${hana.token}`)
      .send({ offeringId: cs301Off.offering_id, petitionType: 'prerequisite', reason: 'Prior equivalent systems coursework' });
    expect(pet.status).toBe(201);

    // Chair approves petition
    const dec = await request(app)
      .patch(`/api/v1/override-petitions/${pet.body.data.id}/decide`)
      .set('Authorization', `Bearer ${chair.token}`)
      .send({ status: 'approved', decisionNote: 'Instructor & chair approved waiver' });
    expect(dec.status).toBe(200);

    // Enroll now succeeds!
    const ok = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${hana.token}`)
      .send({ offeringId: cs301Off.offering_id });
    expect(ok.status).toBe(201);
    expect(ok.body.data.status).toBe('enrolled');
  });

  it('supports advising early alerts, multi-term planner, admissions matriculation, and public graduation verification', async () => {
    const admin = await loginAs('admin@galala.edu.eg', 'AdminPass123!');
    const advisor = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!');
    const student = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');

    // 1. Public credential verification of seeded conferred graduate (no auth header)
    const verifyOk = await request(app).get('/api/v1/verify/GAL-2027-CS-2024003');
    expect(verifyOk.status).toBe(200);
    expect(verifyOk.body.data.student_number).toBe('2024003');

    const verifyMissing = await request(app).get('/api/v1/verify/INVALID-CODE-999');
    expect(verifyMissing.status).toBe(404);

    // 2. Advisor lists advisees & issues early alert
    const adviseesRes = await request(app)
      .get('/api/v1/advising/advisees')
      .set('Authorization', `Bearer ${advisor.token}`);
    expect(adviseesRes.status).toBe(200);
    expect(adviseesRes.body.data.length).toBeGreaterThanOrEqual(3);

    const alertRes = await request(app)
      .post('/api/v1/early-alerts')
      .set('Authorization', `Bearer ${advisor.token}`)
      .send({
        studentId: adviseesRes.body.data[0].id,
        flagType: 'commendation',
        note: 'Outstanding midterm progress'
      });
    expect(alertRes.status).toBe(201);

    // 3. Multi-term degree planner add & delete
    const coursesRes = await request(app)
      .get('/api/v1/courses?limit=20')
      .set('Authorization', `Bearer ${student.token}`);
    const busCourse = coursesRes.body.data.find((c) => c.code === 'BUS105');
    const planAdd = await request(app)
      .post('/api/v1/me/degree-plan')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ termLabel: 'Spring 2028', courseId: busCourse.id, notes: 'Elective plan' });
    expect(planAdd.status).toBe(201);

    const planDel = await request(app)
      .delete(`/api/v1/me/degree-plan/${planAdd.body.data.id}`)
      .set('Authorization', `Bearer ${student.token}`);
    expect(planDel.status).toBe(204);

    // 4. Admissions application -> admit -> 1-click matriculate
    const depts = await request(app).get('/api/v1/departments').set('Authorization', `Bearer ${admin.token}`);
    const admCreate = await request(app)
      .post('/api/v1/admissions')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        email: 'new.applicant@galala.edu.eg',
        firstName: 'Mostafa',
        lastName: 'Gamal',
        dateOfBirth: '2007-03-11',
        departmentId: depts.body.data[0].id,
        entryScore: 95.5
      });
    expect(admCreate.status).toBe(201);

    await request(app)
      .patch(`/api/v1/admissions/${admCreate.body.data.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'admitted', decisionNote: 'Honours admit' });

    const matriculated = await request(app)
      .post(`/api/v1/admissions/${admCreate.body.data.id}/matriculate`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(matriculated.status).toBe(201);
    expect(matriculated.body.data.student.student_number).toBeTruthy();

    // New matriculated student can immediately sign in
    const newStudentLogin = await loginAs('new.applicant@galala.edu.eg', 'Student123!');
    expect(newStudentLogin.user.role).toBe('student');
  });
});
