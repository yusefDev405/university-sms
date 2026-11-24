import { query, withTransaction } from '../../config/db.js';

export async function findStudentByUserId(userId) {
  const res = await query(
    `SELECT s.id, s.user_id, s.student_number, d.code AS department_code
     FROM students s
     JOIN departments d ON d.id = s.department_id
     WHERE s.user_id = $1`,
    [userId]
  );
  return res.rows[0] || null;
}

// --- Admissions ---
export async function listAdmissions() {
  const res = await query(
    `SELECT aa.*, d.code AS department_code, d.name AS department_name,
            s.student_number AS matriculated_student_number
     FROM admissions_applications aa
     JOIN departments d ON d.id = aa.department_id
     LEFT JOIN students s ON s.id = aa.matriculated_student_id
     ORDER BY aa.created_at DESC, aa.id DESC`
  );
  return res.rows;
}

export async function findAdmissionById(id) {
  const res = await query('SELECT * FROM admissions_applications WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function createAdmission(payload) {
  const res = await query(
    `INSERT INTO admissions_applications
       (email, first_name, last_name, date_of_birth, department_id, entry_score, decision_note)
     VALUES ($1, $2, $3, $4::DATE, $5, $6, $7)
     RETURNING *`,
    [
      payload.email,
      payload.firstName,
      payload.lastName,
      payload.dateOfBirth,
      payload.departmentId,
      payload.entryScore,
      payload.decisionNote || null
    ]
  );
  return res.rows[0];
}

export async function updateAdmissionStatus(id, status, decisionNote, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `UPDATE admissions_applications
       SET status = $2, decision_note = COALESCE($3, decision_note), reviewed_by = $4
       WHERE id = $1
       RETURNING *`,
      [id, status, decisionNote || null, actorUserId]
    );
    return res.rows[0] || null;
  }, { actorUserId });
}

export async function matriculateApplicant(app, { passwordHash, studentNumber }, actorUserId) {
  return withTransaction(async (tx) => {
    const userRes = await tx.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'student', true)
       RETURNING id, email, role`,
      [app.email, passwordHash]
    );
    const user = userRes.rows[0];

    const stuRes = await tx.query(
      `INSERT INTO students (user_id, student_number, first_name, last_name, date_of_birth, department_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [user.id, studentNumber, app.first_name, app.last_name, app.date_of_birth, app.department_id]
    );
    const student = stuRes.rows[0];

    const updRes = await tx.query(
      `UPDATE admissions_applications
       SET status = 'matriculated',
           matriculated_student_id = $2,
           reviewed_by = $3
       WHERE id = $1
       RETURNING *`,
      [app.id, student.id, actorUserId]
    );

    return { application: updRes.rows[0], student, email: user.email };
  }, { actorUserId });
}

export async function getNextStudentNumber() {
  const res = await query(
    `SELECT COALESCE(MAX(student_number::BIGINT), 2024000) + 1 AS next_num
     FROM students
     WHERE student_number ~ '^[0-9]+$'`
  );
  return String(res.rows[0]?.next_num || '2024050');
}

// --- Transfer Credits ---
export async function listTransferCredits(studentId = null) {
  const res = await query(
    `SELECT tc.*, s.student_number, s.first_name || ' ' || s.last_name AS student_name,
            c.code AS equivalent_course_code, c.title AS equivalent_course_title
     FROM transfer_credits tc
     JOIN students s ON s.id = tc.student_id
     LEFT JOIN courses c ON c.id = tc.equivalent_course_id
     WHERE ($1::BIGINT IS NULL OR tc.student_id = $1)
     ORDER BY tc.created_at DESC`,
    [studentId]
  );
  return res.rows;
}

export async function createTransferCredit(payload, actorUserId) {
  const res = await query(
    `INSERT INTO transfer_credits
       (student_id, institution_name, external_course_code, equivalent_course_id, credits, approved_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      payload.studentId,
      payload.institutionName,
      payload.externalCourseCode,
      payload.equivalentCourseId || null,
      payload.credits,
      actorUserId
    ]
  );
  return res.rows[0];
}

export async function deleteTransferCredit(id) {
  const res = await query('DELETE FROM transfer_credits WHERE id = $1 RETURNING id', [id]);
  return res.rows[0] || null;
}

// --- Graduation Applications & Public Credential Verification ---
export async function listGraduationApplications(studentId = null) {
  const res = await query(
    `SELECT ga.*, s.student_number, s.first_name || ' ' || s.last_name AS student_name,
            d.code AS department_code, d.name AS department_name
     FROM graduation_applications ga
     JOIN students s ON s.id = ga.student_id
     JOIN departments d ON d.id = s.department_id
     WHERE ($1::BIGINT IS NULL OR ga.student_id = $1)
     ORDER BY ga.created_at DESC`,
    [studentId]
  );
  return res.rows;
}

export async function getStudentAcademicSummary(studentId) {
  const res = await query(
    `SELECT g.gpa::FLOAT AS gpa,
            COALESCE(g.credits_earned, 0)::INT AS earned_credits,
            COALESCE((SELECT SUM(tc.credits)::INT FROM transfer_credits tc WHERE tc.student_id = $1), 0) AS transfer_credits
     FROM students s
     LEFT JOIN v_student_gpa g ON g.student_id = s.id
     WHERE s.id = $1`,
    [studentId]
  );
  return res.rows[0] || { gpa: null, earned_credits: 0, transfer_credits: 0 };
}

export async function createGraduationApplication(studentId, { targetTerm, verificationCode, creditsVerified, gpaVerified }, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO graduation_applications
         (student_id, target_term, verification_code, credits_verified, gpa_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [studentId, targetTerm, verificationCode, creditsVerified, gpaVerified]
    );
    return res.rows[0];
  }, { actorUserId });
}

export async function findGraduationApplicationById(id) {
  const res = await query(
    `SELECT ga.*, s.user_id AS student_user_id, s.first_name, s.last_name
     FROM graduation_applications ga
     JOIN students s ON s.id = ga.student_id
     WHERE ga.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function decideGraduationApplication(app, { status, decisionNote }, actorUserId) {
  return withTransaction(async (tx) => {
    const upd = await tx.query(
      `UPDATE graduation_applications
       SET status = $2,
           decision_note = COALESCE($3, decision_note),
           decided_by = $4,
           decided_at = now()
       WHERE id = $1
       RETURNING *`,
      [app.id, status, decisionNote || null, actorUserId]
    );

    if (status === 'conferred') {
      await tx.query("UPDATE students SET status = 'graduated' WHERE id = $1", [app.student_id]);
    }

    const notifTitle = `Graduation Application ${status.toUpperCase()}`;
    const notifBody =
      status === 'conferred'
        ? `Congratulations! Your degree for ${app.target_term} is conferred. Public verification code: ${app.verification_code}`
        : `Graduation review result (${status}). ${decisionNote || ''}`.trim();

    await tx.query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
      [app.student_user_id, notifTitle, notifBody]
    );

    return upd.rows[0];
  }, { actorUserId });
}

export async function verifyCredentialByCode(code) {
  const res = await query(
    `SELECT ga.verification_code, ga.target_term, ga.status, ga.credits_verified,
            ga.gpa_verified::FLOAT AS gpa_verified, ga.decision_note, ga.decided_at,
            s.student_number, s.first_name, s.last_name,
            d.code AS department_code, d.name AS department_name
     FROM graduation_applications ga
     JOIN students s ON s.id = ga.student_id
     JOIN departments d ON d.id = s.department_id
     WHERE upper(ga.verification_code) = upper($1)
       AND ga.status IN ('approved', 'conferred')`,
    [code]
  );
  return res.rows[0] || null;
}
