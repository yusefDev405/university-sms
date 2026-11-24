import { query, withTransaction } from '../../config/db.js';

export async function findStudentByUserId(userId) {
  const res = await query('SELECT id, user_id, first_name, last_name FROM students WHERE user_id = $1', [userId]);
  return res.rows[0] || null;
}

export async function findStudentById(studentId) {
  const res = await query('SELECT id, user_id FROM students WHERE id = $1', [studentId]);
  return res.rows[0] || null;
}

export async function getStudentLedger(studentId) {
  const entriesRes = await query(
    `SELECT tl.id, tl.student_id, tl.term_id, t.name AS term_name,
            tl.entry_type, tl.description, tl.amount::FLOAT AS amount, tl.created_at
     FROM tuition_ledger tl
     LEFT JOIN terms t ON t.id = tl.term_id
     WHERE tl.student_id = $1
     ORDER BY tl.created_at DESC, tl.id DESC`,
    [studentId]
  );

  const summaryRes = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type IN ('tuition_charge', 'fee') THEN amount ELSE 0 END), 0)::FLOAT AS total_charges,
       COALESCE(SUM(CASE WHEN entry_type = 'scholarship_waiver' THEN ABS(amount) ELSE 0 END), 0)::FLOAT AS total_waivers,
       COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)::FLOAT AS total_payments,
       COALESCE(SUM(amount), 0)::FLOAT AS net_balance
     FROM tuition_ledger
     WHERE student_id = $1`,
    [studentId]
  );

  return {
    entries: entriesRes.rows,
    summary: summaryRes.rows[0]
  };
}

export async function listAllLedger({ studentId = null } = {}) {
  const [entriesRes, balancesRes] = await Promise.all([
    query(
      `SELECT tl.id, tl.student_id, s.student_number,
              s.first_name || ' ' || s.last_name AS student_name,
              tl.term_id, t.name AS term_name,
              tl.entry_type, tl.description, tl.amount::FLOAT AS amount, tl.created_at
       FROM tuition_ledger tl
       JOIN students s ON s.id = tl.student_id
       LEFT JOIN terms t ON t.id = tl.term_id
       WHERE ($1::BIGINT IS NULL OR tl.student_id = $1)
       ORDER BY tl.created_at DESC, tl.id DESC`,
      [studentId]
    ),
    query(
      `SELECT s.id AS student_id, s.student_number, s.first_name || ' ' || s.last_name AS student_name,
              d.code AS department_code,
              COALESCE(SUM(CASE WHEN tl.entry_type IN ('tuition_charge', 'fee') THEN tl.amount ELSE 0 END), 0)::FLOAT AS total_charges,
              COALESCE(SUM(CASE WHEN tl.entry_type = 'scholarship_waiver' THEN ABS(tl.amount) ELSE 0 END), 0)::FLOAT AS total_waivers,
              COALESCE(SUM(CASE WHEN tl.entry_type = 'payment' THEN ABS(tl.amount) ELSE 0 END), 0)::FLOAT AS total_payments,
              COALESCE(SUM(tl.amount), 0)::FLOAT AS net_balance,
              EXISTS (
                SELECT 1 FROM academic_holds ah
                WHERE ah.student_id = s.id AND ah.hold_type = 'financial' AND ah.resolved_at IS NULL
              ) AS has_financial_hold
       FROM students s
       JOIN departments d ON d.id = s.department_id
       LEFT JOIN tuition_ledger tl ON tl.student_id = s.id
       GROUP BY s.id, d.code
       ORDER BY net_balance DESC, s.student_number ASC`
    )
  ]);

  return {
    entries: entriesRes.rows,
    balances: balancesRes.rows
  };
}

export async function assessTermTuition({ termId, creditRate, registrationFee }, actorUserId) {
  return withTransaction(async (tx) => {
    const termRes = await tx.query('SELECT id, name FROM terms WHERE id = $1', [termId]);
    const term = termRes.rows[0];
    if (!term) return null;

    const candidatesRes = await tx.query(
      `SELECT e.student_id, s.user_id, s.student_number, SUM(c.credits)::INT AS enrolled_credits,
              g.gpa::FLOAT AS gpa
       FROM enrollments e
       JOIN course_offerings o ON o.id = e.offering_id
       JOIN courses c ON c.id = o.course_id
       JOIN students s ON s.id = e.student_id
       LEFT JOIN v_student_gpa g ON g.student_id = e.student_id
       WHERE o.term_id = $1
         AND e.status IN ('enrolled', 'completed')
         AND NOT EXISTS (
           SELECT 1 FROM tuition_ledger tl
           WHERE tl.student_id = e.student_id AND tl.term_id = $1 AND tl.entry_type = 'tuition_charge'
         )
       GROUP BY e.student_id, s.user_id, s.student_number, g.gpa`,
      [termId]
    );

    const created = [];
    for (const row of candidatesRes.rows) {
      const tuitionAmt = Number((row.enrolled_credits * creditRate + registrationFee).toFixed(2));
      const chargeRes = await tx.query(
        `INSERT INTO tuition_ledger (student_id, term_id, entry_type, description, amount, created_by)
         VALUES ($1, $2, 'tuition_charge', $3, $4, $5)
         RETURNING *`,
        [
          row.student_id,
          termId,
          `${term.name} Tuition (${row.enrolled_credits} cr @ ${creditRate} + ${registrationFee} fee)`,
          tuitionAmt,
          actorUserId
        ]
      );
      created.push(chargeRes.rows[0]);

      if (row.gpa !== null && Number(row.gpa) >= 3.5) {
        const waiverAmt = Number((-0.25 * (row.enrolled_credits * creditRate)).toFixed(2));
        if (waiverAmt < 0) {
          const waiverRes = await tx.query(
            `INSERT INTO tuition_ledger (student_id, term_id, entry_type, description, amount, created_by)
             VALUES ($1, $2, 'scholarship_waiver', $3, $4, $5)
             RETURNING *`,
            [
              row.student_id,
              termId,
              `${term.name} Dean's List Merit Waiver (25%)`,
              waiverAmt,
              actorUserId
            ]
          );
          created.push(waiverRes.rows[0]);
        }
      }
    }

    return { termName: term.name, assessedStudents: candidatesRes.rows.length, entriesCreated: created.length };
  }, { actorUserId });
}

export async function createLedgerEntry({ studentId, studentUserId, termId, entryType, description, signedAmount }, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO tuition_ledger (student_id, term_id, entry_type, description, amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [studentId, termId || null, entryType, description, signedAmount, actorUserId]
    );

    const balRes = await tx.query(
      'SELECT COALESCE(SUM(amount), 0)::FLOAT AS net_balance FROM tuition_ledger WHERE student_id = $1',
      [studentId]
    );
    const netBalance = Number(balRes.rows[0].net_balance);
    let resolvedHolds = 0;

    if (netBalance <= 0) {
      const clearRes = await tx.query(
        `UPDATE academic_holds
         SET resolved_at = now(), resolved_by = $2
         WHERE student_id = $1 AND hold_type = 'financial' AND resolved_at IS NULL
         RETURNING id`,
        [studentId, actorUserId]
      );
      resolvedHolds = clearRes.rows.length;
      if (resolvedHolds > 0) {
        await tx.query(
          `INSERT INTO notifications (user_id, title, message)
           VALUES ($1, 'Financial Hold Cleared', 'Your tuition balance has been settled and your registration financial hold was lifted automatically.')`,
          [studentUserId]
        );
      }
    }

    return { entry: res.rows[0], netBalance, resolvedFinancialHolds: resolvedHolds };
  }, { actorUserId });
}

export async function enforceFinancialHolds(actorUserId) {
  return withTransaction(async (tx) => {
    const overdueRes = await tx.query(
      `SELECT s.id AS student_id, s.user_id, SUM(tl.amount)::FLOAT AS balance
       FROM students s
       JOIN tuition_ledger tl ON tl.student_id = s.id
       WHERE NOT EXISTS (
         SELECT 1 FROM academic_holds ah
         WHERE ah.student_id = s.id AND ah.hold_type = 'financial' AND ah.resolved_at IS NULL
       )
       GROUP BY s.id, s.user_id
       HAVING SUM(tl.amount) > 0`
    );

    for (const row of overdueRes.rows) {
      await tx.query(
        `INSERT INTO academic_holds (student_id, hold_type, reason, placed_by)
         VALUES ($1, 'financial', $2, $3)`,
        [row.student_id, `Overdue tuition balance: ${row.balance.toFixed(2)}`, actorUserId]
      );
      await tx.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES ($1, 'Financial Registration Hold Placed', $2)`,
        [row.user_id, `An overdue tuition balance (${row.balance.toFixed(2)}) has placed a financial hold on course registration until settled.`]
      );
    }

    return { holdsPlaced: overdueRes.rows.length };
  }, { actorUserId });
}
