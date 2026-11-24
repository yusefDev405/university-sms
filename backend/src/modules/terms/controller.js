import * as service from './service.js';

export async function listTerms(_req, res, next) {
  try {
    const data = await service.listTerms();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createTerm(req, res, next) {
  try {
    const created = await service.createTerm(req.body, req.user.id);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
}

export async function updateTerm(req, res, next) {
  try {
    const updated = await service.updateTerm(req.params.id, req.body, req.user.id);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}
