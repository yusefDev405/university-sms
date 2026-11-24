import { query } from '../../config/db.js';

export async function listDepartments() {
  const res = await query('SELECT id, code, name, created_at FROM departments ORDER BY code ASC');
  return res.rows;
}

export async function createDepartment({ code, name }) {
  const res = await query(
    'INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING id, code, name, created_at',
    [code, name]
  );
  return res.rows[0];
}
