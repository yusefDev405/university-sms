import * as service from './service.js';

export async function setSingleGrade(req, res, next) {
  try {
    const updated = await service.setSingleGrade(req.params.id, req.body.gradeLetter, req.user);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function setBulkGrades(req, res, next) {
  try {
    const updated = await service.setBulkGrades(req.params.id, req.body.grades, req.user);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}
