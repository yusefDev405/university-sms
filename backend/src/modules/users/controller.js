import * as service from './service.js';

export async function listUsers(req, res, next) {
  try {
    const result = await service.listUsers(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const created = await service.createUser(req.body, req.user.id);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const updated = await service.updateUser(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function listInstructors(_req, res, next) {
  try {
    const rows = await service.listInstructors();
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}
