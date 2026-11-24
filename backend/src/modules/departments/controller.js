import * as service from './service.js';

export async function listDepartments(_req, res, next) {
  try {
    const data = await service.listDepartments();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createDepartment(req, res, next) {
  try {
    const created = await service.createDepartment(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
}
