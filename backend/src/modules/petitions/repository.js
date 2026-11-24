import { query, withTransaction } from '../../config/db.js';

export async function findStudentByUserId(userId) {
  const res = await query('SELECT id, user_id, department_id FROM students WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

export async function findInstructorByUserId(userId) {
  const res = await query(
    'SELECT id, user_id, department_id, is_chair FROM instructors WHERE user_id = $1',
    [userId]
  );
  return res.rows[0] || null;
}

// --- Grade Appeals ---
export async function listGradeAppeals({ studentId = null, chairDepartmentId = null } = {}) {
  const res = await query(
    `SELECT ga.id, ga.enrollment_id, ga.student_id, ga.original_grade, ga.requested_reason,
            ga.status, ga.revised_grade, ga.decision_note, ga.created_at, ga.resolved_at,
            s.student_number, s.first_name || ' ' || s.last_name AS student_name,
            c.code AS course_code, c.title AS course_title, c.department_id,
            t.name AS term_name, o.section
     FROM grade_appeals ga
     JOIN enrollments e ON e.id = ga.enrollment_id
     JOIN students s ON s.id = ga.student_id
     JOIN course_offerings o ON o.id = e.offering_id
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     WHERE ($1::BIGINT IS NULL OR ga.student_id = $1)
       AND ($2::BIGINT IS NULL OR c.department_id = $2)
     ORDER BY (ga.status = 'pending') DESC, ga.created_at DESC`,
    [studentId, chairDepartmentId]
  );
  return res.rows;
}

export async function findEnrollmentForAppeal(enrollmentId) {
  const res = await query(
    `SELECT e.id, e.student_id, e.status, e.grade_letter, c.code AS course_code
     FROM enrollments e
     JOIN course_offerings o ON o.id = e.offering_id
     JOIN courses c ON c.id = o.course_id
     WHERE e.id = $1`,
    [enrollmentId]
  );
  return res.rows[0] || null;
}

export async function createGradeAppeal(studentId, enrollmentId, originalGrade, requestedReason, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO grade_appeals (enrollment_id, student_id, original_grade, requested_reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [enrollmentId, studentId, originalGrade, requestedReason]
    );
    return res.rows[0];
  }, { actorUserId });
}

export async function findGradeAppealById(id) {
  const res = await query(
    `SELECT ga.*, s.user_id AS student_user_id, c.department_id, c.code AS course_code
     FROM grade_appeals ga
     JOIN enrollments e ON e.id = ga.enrollment_id
     JOIN students s ON s.id = ga.student_id
     JOIN course_offerings o ON o.id = e.offering_id
     JOIN courses c ON c.id = o.course_id
     WHERE ga.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function decideGradeAppeal(appeal, { status, revisedGrade, revisedPoints, decisionNote }, actorUserId) {
  return withTransaction(async (tx) => {
    const upd = await tx.query(
      `UPDATE grade_appeals
       SET status = $2,
           revised_grade = $3,
           decision_note = $4,
           reviewed_by = $5,
           resolved_at = now()
       WHERE id = $1
       RETURNING *`,
      [appeal.id, status, revisedGrade || null, decisionNote, actorUserId]
    );

    if (status === 'approved' && revisedGrade) {
      await tx.query(
        `UPDATE enrollments
         SET status = 'completed', grade_letter = $2, grade_points = $3
         WHERE id = $1`,
        [appeal.enrollment_id, revisedGrade, revisedPoints]
      );
    }

    await tx.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      [
        appeal.student_user_id,
        `Grade Appeal ${status === 'approved' ? 'Approved' : 'Reviewed'}: ${appeal.course_code}`,
        status === 'approved' && revisedGrade
          ? `Your grade for ${appeal.course_code} was revised to ${revisedGrade}. Note: ${decisionNote}`
          : `Grade appeal decision (${status}): ${decisionNote}`
      ]
    );

    return upd.rows[0];
  }, { actorUserId });
}

// --- Override Petitions ---
export async function listOverridePetitions({ studentId = null, chairDepartmentId = null } = {}) {
  const res = await query(
    `SELECT op.id, op.student_id, op.offering_id, op.petition_type, op.reason,
            op.status, op.decision_note, op.created_at, op.resolved_at,
            s.student_number, s.first_name || ' ' || s.last_name AS student_name,
            c.code AS course_code, c.title AS course_title, c.department_id,
            t.name AS term_name, o.section
     FROM override_petitions op
     JOIN students s ON s.id = op.student_id
     JOIN course_offerings o ON o.id = op.offering_id
     JOIN courses c ON c.id = o.course_id
     JOIN terms t ON t.id = o.term_id
     WHERE ($1::BIGINT IS NULL OR op.student_id = $1)
       AND ($2::BIGINT IS NULL OR c.department_id = $2)
     ORDER BY (op.status = 'pending') DESC, op.created_at DESC`,
    [studentId, chairDepartmentId]
  );
  return res.rows;
}

export async function findOverridePetitionById(id) {
  const res = await query(
    `SELECT op.*, s.user_id AS student_user_id, c.department_id, c.code AS course_code
     FROM override_petitions op
     JOIN students s ON s.id = op.student_id
     JOIN course_offerings o ON o.id = op.offering_id
     JOIN courses c ON c.id = o.course_id
     WHERE op.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function findOfferingBasic(offeringId) {
  const res = await query(
    `SELECT o.id, c.code AS course_code
     FROM course_offerings o
     JOIN courses c ON c.id = o.course_id
     WHERE o.id = $1`,
    [offeringId]
  );
  return res.rows[0] || null;
}

export async function createOverridePetition(studentId, offeringId, petitionType, reason, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO override_petitions (student_id, offering_id, petition_type, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [studentId, offeringId, petitionType, reason]
    );
    return res.rows[0];
  }, { actorUserId });
}

export async function decideOverridePetition(petition, { status, decisionNote }, actorUserId) {
  return withTransaction(async (tx) => {
    const upd = await tx.query(
      `UPDATE override_petitions
       SET status = $2, decision_note = $3, decided_by = $4, resolved_at = now()
       WHERE id = $1
       RETURNING *`,
      [petition.id, status, decisionNote, actorUserId]
    );

    await tx.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      [
        petition.student_user_id,
        `Override Petition ${status}: ${petition.course_code}`,
        `Your ${petition.petition_type.replace('_', ' ')} petition for ${petition.course_code} was ${status}. Note: ${decisionNote}`
      ]
    );

    return upd.rows[0];
  }, { actorUserId });
}

// --- Advising & Early Alerts ---
export async function listAdvisees(instructorId = null) {
  const res = await query(
    `SELECT s.id, s.student_number, s.first_name, s.last_name, s.status, s.major_concentration,
            u.email, d.code AS department_code, d.name AS department_name,
            g.gpa::FLOAT AS gpa, COALESCE(g.credits_earned, 0)::INT AS credits_earned,
            (SELECT COUNT(*)::INT FROM academic_holds ah WHERE ah.student_id = s.id AND ah.resolved_at IS NULL) AS active_holds,
            (SELECT COUNT(*)::INT FROM early_alerts ea WHERE ea.student_id = s.id AND ea.status = 'open') AS open_alerts
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     LEFT JOIN v_student_gpa g ON g.student_id = s.id
     WHERE ($1::BIGINT IS NULL OR s.advisor_id = $1)
     ORDER BY s.student_number ASC`,
    [instructorId]
  );
  return res.rows;
}

export async function listEarlyAlerts({ studentId = null, instructorId = null } = {}) {
  const res = await query(
    `SELECT ea.id, ea.student_id, ea.offering_id, ea.instructor_id, ea.flag_type, ea.note,
            ea.status, ea.created_at, ea.resolved_at,
            s.student_number, s.first_name || ' ' || s.last_name AS student_name,
            i.title || ' ' || i.first_name || ' ' || i.last_name AS instructor_name,
            c.code AS course_code
     FROM early_alerts ea
     JOIN students s ON s.id = ea.student_id
     JOIN instructors i ON i.id = ea.instructor_id
     LEFT JOIN course_offerings o ON o.id = ea.offering_id
     LEFT JOIN courses c ON c.id = o.course_id
     WHERE ($1::BIGINT IS NULL OR ea.student_id = $1)
       AND ($2::BIGINT IS NULL OR ea.instructor_id = $2 OR s.advisor_id = $2)
     ORDER BY (ea.status = 'open') DESC, ea.created_at DESC`,
    [studentId, instructorId]
  );
  return res.rows;
}

export async function findStudentTargetForAlert(studentId) {
  const res = await query(
    `SELECT s.id, s.user_id, s.first_name, s.last_name, s.advisor_id, adv.user_id AS advisor_user_id,
            (SELECT id FROM instructors ORDER BY is_chair DESC, id ASC LIMIT 1) AS fallback_instructor_id
     FROM students s
     LEFT JOIN instructors adv ON adv.id = s.advisor_id
     WHERE s.id = $1`,
    [studentId]
  );
  return res.rows[0] || null;
}

export async function createEarlyAlert({ student, offeringId, instructorId, flagType, note }, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO early_alerts (student_id, offering_id, instructor_id, flag_type, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [student.id, offeringId || null, instructorId, flagType, note]
    );

    const title = flagType === 'commendation' ? 'Faculty Commendation' : `Academic Advising Notice (${flagType.replace('_', ' ')})`;
    await tx.query(
      `INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
      [student.user_id, title, note]
    );
    if (student.advisor_user_id && Number(student.advisor_user_id) !== Number(actorUserId)) {
      await tx.query(
        `INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
        [student.advisor_user_id, `Advisee Alert: ${student.first_name} ${student.last_name}`, note]
      );
    }
    return res.rows[0];
  }, { actorUserId });
}

export async function findEarlyAlertById(id) {
  const res = await query('SELECT * FROM early_alerts WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function updateEarlyAlertStatus(id, status) {
  const res = await query(
    `UPDATE early_alerts
     SET status = $2,
         resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return res.rows[0] || null;
}

// --- Multi-Term Degree Planner ---
export async function listDegreePlanItems(studentId) {
  const res = await query(
    `SELECT dp.id, dp.term_label, dp.course_id, dp.notes, dp.created_at,
            c.code AS course_code, c.title AS course_title, c.credits, d.code AS department_code
     FROM degree_plan_items dp
     JOIN courses c ON c.id = dp.course_id
     JOIN departments d ON d.id = c.department_id
     WHERE dp.student_id = $1
     ORDER BY dp.term_label ASC, c.code ASC`,
    [studentId]
  );
  return res.rows;
}

export async function upsertDegreePlanItem(studentId, { termLabel, courseId, notes }) {
  const res = await query(
    `INSERT INTO degree_plan_items (student_id, term_label, course_id, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, course_id)
     DO UPDATE SET term_label = EXCLUDED.term_label, notes = EXCLUDED.notes
     RETURNING *`,
    [studentId, termLabel, courseId, notes || null]
  );
  return res.rows[0];
}

export async function deleteDegreePlanItem(id, studentId) {
  const res = await query(
    'DELETE FROM degree_plan_items WHERE id = $1 AND student_id = $2 RETURNING id',
    [id, studentId]
  );
  return res.rows[0] || null;
}

// --- Corequisites & Equivalencies ---
export async function getCourseRelations(courseId) {
  const [prereqs, coreqs, equivs] = await Promise.all([
    query(
      `SELECT c.id, c.code, c.title FROM course_prerequisites cp
       JOIN courses c ON c.id = cp.prerequisite_id
       WHERE cp.course_id = $1 ORDER BY c.code`,
      [courseId]
    ),
    query(
      `SELECT c.id, c.code, c.title FROM course_corequisites cc
       JOIN courses c ON c.id = cc.corequisite_id
       WHERE cc.course_id = $1 ORDER BY c.code`,
      [courseId]
    ),
    query(
      `SELECT c.id, c.code, c.title FROM course_equivalencies ce
       JOIN courses c ON c.id = CASE WHEN ce.course_id = $1 THEN ce.equivalent_course_id ELSE ce.course_id END
       WHERE ce.course_id = $1 OR ce.equivalent_course_id = $1
       ORDER BY c.code`,
      [courseId]
    )
  ]);
  return { prerequisites: prereqs.rows, corequisites: coreqs.rows, equivalencies: equivs.rows };
}

export async function setCourseCorequisites(courseId, corequisiteIds) {
  return withTransaction(async (tx) => {
    await tx.query('DELETE FROM course_corequisites WHERE course_id = $1', [courseId]);
    for (const cid of corequisiteIds) {
      if (Number(cid) !== Number(courseId)) {
        await tx.query(
          'INSERT INTO course_corequisites (course_id, corequisite_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [courseId, cid]
        );
      }
    }
  });
}

export async function setCourseEquivalencies(courseId, equivalentIds) {
  return withTransaction(async (tx) => {
    await tx.query('DELETE FROM course_equivalencies WHERE course_id = $1 OR equivalent_course_id = $1', [courseId]);
    for (const eid of equivalentIds) {
      if (Number(eid) !== Number(courseId)) {
        await tx.query(
          'INSERT INTO course_equivalencies (course_id, equivalent_course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [courseId, eid]
        );
      }
    }
  });
}
