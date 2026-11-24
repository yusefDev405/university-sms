import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateTotpCode } from '../src/utils/totp.js';
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
    user: res.body.data.user,
    cookies: res.headers['set-cookie']
  };
}

describe('Phase C, D & E: Campus Facilities, Anonymous Evaluations, Finance ERP, Analytics, Sessions & 2FA', () => {
  it('detects room and student conflicts on final exam schedules', async () => {
    const admin = await loginAs('admin@galala.edu.eg', 'AdminPass123!');
    const offRes = await request(app)
      .get('/api/v1/offerings?limit=50')
      .set('Authorization', `Bearer ${admin.token}`);
    const spring2027 = offRes.body.data.filter((o) => o.term_name === 'Spring 2027');
    const cs101 = spring2027.find((o) => o.course_code === 'CS101');
    expect(cs101).toBeTruthy();

    // Conflict with seeded CS201 exam (2027-05-12 09:00-11:00 Hall B-202)
    const roomConflict = await request(app)
      .post('/api/v1/exams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        offeringId: cs101.offering_id,
        examDate: '2027-05-12',
        startTime: '09:30',
        endTime: '11:30',
        room: 'Hall B-202'
      });
    expect(roomConflict.status).toBe(409);
    expect(roomConflict.body.error.code).toBe('EXAM_CONFLICT');

    // Non-conflicting slot succeeds
    const ok = await request(app)
      .post('/api/v1/exams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        offeringId: cs101.offering_id,
        examDate: '2027-05-19',
        startTime: '13:00',
        endTime: '15:00',
        room: 'Hall B-101'
      });
    expect(ok.status).toBe(201);
  });

  it('prevents office hour double-booking and preserves evaluation anonymity', async () => {
    const nadia = await loginAs('nadia.mansour@galala.edu.eg', 'Student123!');
    const omar = await loginAs('omar.farouk@galala.edu.eg', 'Student123!');
    const instructor = await loginAs('amina.darwish@galala.edu.eg', 'Instructor123!');

    const ohRes = await request(app)
      .get('/api/v1/office-hours')
      .set('Authorization', `Bearer ${nadia.token}`);
    const slotId = ohRes.body.data.slots[0].id;

    const book1 = await request(app)
      .post('/api/v1/office-hours/bookings')
      .set('Authorization', `Bearer ${nadia.token}`)
      .send({ slotId, bookingDate: '2027-04-04', topic: 'Algorithms project Q&A' });
    expect(book1.status).toBe(201);

    const book2 = await request(app)
      .post('/api/v1/office-hours/bookings')
      .set('Authorization', `Bearer ${omar.token}`)
      .send({ slotId, bookingDate: '2027-04-04', topic: 'Same slot conflict check' });
    expect(book2.status).toBe(409);

    // Evaluations: Nadia evaluates CS201 once; duplicate blocked; summary omits student identities
    const evList = await request(app)
      .get('/api/v1/me/evaluations')
      .set('Authorization', `Bearer ${nadia.token}`);
    const target = evList.body.data.find((e) => e.course_code === 'CS201' && !e.already_submitted);
    expect(target).toBeTruthy();

    const submit = await request(app)
      .post('/api/v1/evaluations')
      .set('Authorization', `Bearer ${nadia.token}`)
      .send({
        offeringId: target.offering_id,
        ratingTeaching: 5,
        ratingContent: 5,
        ratingFairness: 4,
        comment: 'Clear lectures and practical assignments'
      });
    expect(submit.status).toBe(201);

    const dup = await request(app)
      .post('/api/v1/evaluations')
      .set('Authorization', `Bearer ${nadia.token}`)
      .send({
        offeringId: target.offering_id,
        ratingTeaching: 5,
        ratingContent: 5,
        ratingFairness: 5
      });
    expect(dup.status).toBe(409);

    const summary = await request(app)
      .get(`/api/v1/offerings/${target.offering_id}/evaluations/summary`)
      .set('Authorization', `Bearer ${instructor.token}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.summary.response_count).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.comments[0].student_id).toBeUndefined();
  });

  it('assesses tuition & merit waivers, enforces financial holds, and lifts hold automatically upon settlement', async () => {
    const admin = await loginAs('admin@galala.edu.eg', 'AdminPass123!');
    const karim = await loginAs('karim.salah@galala.edu.eg', 'Student123!'); // Seeded with +1750 unpaid balance

    // Enforce holds -> Karim gets a financial hold
    const enforce = await request(app)
      .post('/api/v1/finance/enforce-holds')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(enforce.status).toBe(200);
    expect(enforce.body.data.holdsPlaced).toBeGreaterThanOrEqual(1);

    // Karim blocked from enrolling while financial hold active
    const offRes = await request(app)
      .get('/api/v1/offerings?search=MATH201')
      .set('Authorization', `Bearer ${karim.token}`);
    const math201 = offRes.body.data.find((o) => o.term_name === 'Spring 2027');

    const blockedEnroll = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${karim.token}`)
      .send({ offeringId: math201.offering_id });
    expect(blockedEnroll.status).toBe(403);
    expect(blockedEnroll.body.error.code).toBe('REGISTRATION_HOLD');

    // Admin records full payment for Karim -> net balance <= 0 -> financial hold lifted automatically
    const finBefore = await request(app)
      .get('/api/v1/me/finance')
      .set('Authorization', `Bearer ${karim.token}`);
    const balance = finBefore.body.data.summary.net_balance;
    expect(balance).toBeGreaterThan(0);

    const pay = await request(app)
      .post('/api/v1/finance/entries')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        studentId: karim.user.profile.id,
        entryType: 'payment',
        description: 'Full settlement transfer',
        amount: balance
      });
    expect(pay.status).toBe(201);
    expect(pay.body.data.netBalance).toBe(0);
    expect(pay.body.data.resolvedFinancialHolds).toBeGreaterThanOrEqual(1);

    // Executive analytics endpoint returns all 4 datasets
    const analytics = await request(app)
      .get('/api/v1/admin/analytics/executive')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.dfwRates.length).toBeGreaterThan(0);
    expect(analytics.body.data.roomUtilization.length).toBeGreaterThan(0);
    expect(analytics.body.data.instructorWorkload.length).toBeGreaterThan(0);
    expect(analytics.body.data.prereqBottlenecks.length).toBeGreaterThan(0);
  });

  it('supports active session revocation and pure-Node RFC 6238 TOTP 2FA lifecycle', async () => {
    const dev1 = await loginAs('youssef.adel@galala.edu.eg', 'Student123!');
    const dev2 = await loginAs('youssef.adel@galala.edu.eg', 'Student123!');

    const sessions = await request(app)
      .get('/api/v1/me/sessions')
      .set('Authorization', `Bearer ${dev2.token}`)
      .set('Cookie', dev2.cookies);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.length).toBeGreaterThanOrEqual(2);

    const revokeOthers = await request(app)
      .post('/api/v1/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${dev2.token}`)
      .set('Cookie', dev2.cookies);
    expect(revokeOthers.status).toBe(200);
    expect(revokeOthers.body.data.revokedCount).toBeGreaterThanOrEqual(1);

    // Enable TOTP 2FA
    const setup = await request(app)
      .post('/api/v1/me/2fa/setup')
      .set('Authorization', `Bearer ${dev2.token}`);
    expect(setup.status).toBe(200);
    const { secret } = setup.body.data;

    const validCode = generateTotpCode(secret);
    const enabled = await request(app)
      .post('/api/v1/me/2fa/enable')
      .set('Authorization', `Bearer ${dev2.token}`)
      .send({ code: validCode });
    expect(enabled.status).toBe(200);
    expect(enabled.body.data.totpEnabled).toBe(true);

    // Login without totpCode returns 401 TOTP_REQUIRED
    const loginNoCode = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'youssef.adel@galala.edu.eg', password: 'Student123!' });
    expect(loginNoCode.status).toBe(401);
    expect(loginNoCode.body.error.code).toBe('TOTP_REQUIRED');

    // Login with generated 6-digit TOTP succeeds
    const loginWithCode = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'youssef.adel@galala.edu.eg',
        password: 'Student123!',
        totpCode: generateTotpCode(secret)
      });
    expect(loginWithCode.status).toBe(200);

    // Disable 2FA cleanly
    const disabled = await request(app)
      .post('/api/v1/me/2fa/disable')
      .set('Authorization', `Bearer ${loginWithCode.body.data.accessToken}`)
      .send({ password: 'Student123!' });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data.totpEnabled).toBe(false);
  });
});
