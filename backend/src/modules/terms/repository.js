import { query, withTransaction } from '../../config/db.js';

export async function listTerms() {
  const res = await query(
    `SELECT id, name, start_date, end_date, registration_opens, registration_closes, withdrawal_closes, created_at,
            (now() BETWEEN registration_opens AND registration_closes) AS is_registration_open
     FROM terms
     ORDER BY start_date DESC`
  );
  return res.rows;
}

export async function createTerm(data, actorUserId) {
  return withTransaction(async (tx) => {
    const res = await tx.query(
      `INSERT INTO terms (name, start_date, end_date, registration_opens, registration_closes, withdrawal_closes)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::TIMESTAMPTZ, ($3::DATE::TIMESTAMPTZ + interval '1 day' - interval '1 second')))
       RETURNING id, name, start_date, end_date, registration_opens, registration_closes, withdrawal_closes, created_at,
                 (now() BETWEEN registration_opens AND registration_closes) AS is_registration_open`,
      [data.name, data.startDate, data.endDate, data.registrationOpens, data.registrationCloses, data.withdrawalCloses || null]
    );
    return res.rows[0];
  }, { actorUserId });
}

export async function updateTerm(id, data, actorUserId) {
  const map = {
    name: 'name',
    startDate: 'start_date',
    endDate: 'end_date',
    registrationOpens: 'registration_opens',
    registrationCloses: 'registration_closes',
    withdrawalCloses: 'withdrawal_closes'
  };

  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) {
      params.push(data[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  params.push(id);

  return withTransaction(async (tx) => {
    const res = await tx.query(
      `UPDATE terms SET ${sets.join(', ')} WHERE id = $${params.length} -- sql-safe: fixed column mapping
       RETURNING id, name, start_date, end_date, registration_opens, registration_closes, withdrawal_closes, created_at,
                 (now() BETWEEN registration_opens AND registration_closes) AS is_registration_open`,
      params
    );
    return res.rows[0] || null;
  }, { actorUserId });
}
