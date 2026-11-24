import * as service from './service.js';

export async function getEnrollmentByDepartmentReport(_req, res, next) {
  try {
    const report = await service.getEnrollmentByDepartmentReport();
    res.json({ data: report });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLog(req, res, next) {
  try {
    const result = await service.listAuditLog(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function importStudentsCsv(req, res, next) {
  try {
    const result = await service.importStudentsCsv(req.body.csv, req.user.id);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}
