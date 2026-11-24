import { query, withTransaction } from '../../config/db.js';

export async function listCourses({ department, search, limit, offset, sortColumn, sortDirection }) {
  const conditions = [];
  const params = [];

  if (department) {
    params.push(department);
    conditions.push(`d.code = upper($${params.length})`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(c.code ILIKE $${params.length} OR c.title ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortExpr = sortColumn === 'title' ? 'c.title' : sortColumn === 'credits' ? 'c.credits' : 'c.code';

  const countRes = await query(
    `SELECT count(*)::INT AS total
     FROM courses c
     JOIN departments d ON d.id = c.department_id
     ${where}`, // sql-safe: parameterized filters
    params
  );

  const listParams = [...params, limit, offset];
  const rowsRes = await query(
    `SELECT c.id, c.code, c.title, c.credits, c.department_id,
            d.code AS department_code, d.name AS department_name, c.created_at,
            COALESCE(
              json_agg(
                json_build_object('id', p.id, 'code', p.code, 'title', p.title)
                ORDER BY p.code
              ) FILTER (WHERE p.id IS NOT NULL),
              '[]'::json
            ) AS prerequisites
     FROM courses c
     JOIN departments d ON d.id = c.department_id
     LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
     LEFT JOIN courses p ON p.id = cp.prerequisite_id
     ${where}
     GROUP BY c.id, d.id
     ORDER BY ${sortExpr} ${sortDirection}, c.id ASC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, // sql-safe: whitelisted sortExpr/direction
    listParams
  );

  return { rows: rowsRes.rows, total: countRes.rows[0].total };
}

export async function findCourseById(id) {
  const res = await query(
    `SELECT c.id, c.code, c.title, c.credits, c.department_id,
            d.code AS department_code, d.name AS department_name, c.created_at,
            COALESCE(
              json_agg(
                json_build_object('id', p.id, 'code', p.code, 'title', p.title)
                ORDER BY p.code
              ) FILTER (WHERE p.id IS NOT NULL),
              '[]'::json
            ) AS prerequisites
     FROM courses c
     JOIN departments d ON d.id = c.department_id
     LEFT JOIN course_prerequisites cp ON cp.course_id = c.id
     LEFT JOIN courses p ON p.id = cp.prerequisite_id
     WHERE c.id = $1
     GROUP BY c.id, d.id`,
    [id]
  );
  return res.rows[0] || null;
}

export async function createCourse({ code, title, credits, departmentId }) {
  const res = await query(
    `INSERT INTO courses (code, title, credits, department_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, code, title, credits, department_id, created_at`,
    [code, title, credits, departmentId]
  );
  return findCourseById(res.rows[0].id);
}

export async function updateCourse(id, data) {
  const sets = [];
  const params = [];
  const map = { code: 'code', title: 'title', credits: 'credits', departmentId: 'department_id' };

  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) {
      params.push(data[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }

  params.push(id);
  const res = await query(
    `UPDATE courses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`, // sql-safe: fixed column mapping
    params
  );
  if (!res.rows[0]) return null;
  return findCourseById(id);
}

export async function replacePrerequisites(courseId, prerequisiteIds) {
  await withTransaction(async (tx) => {
    await tx.query('DELETE FROM course_prerequisites WHERE course_id = $1', [courseId]);
    for (const prereqId of prerequisiteIds) {
      await tx.query(
        'INSERT INTO course_prerequisites (course_id, prerequisite_id) VALUES ($1, $2)',
        [courseId, prereqId]
      );
    }
  });
  return findCourseById(courseId);
}
