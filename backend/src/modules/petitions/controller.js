import * as service from './service.js';

export async function listGradeAppeals(req, res, next) {
  try {
    res.json({ data: await service.listGradeAppeals(req.user) });
  } catch (err) { next(err); }
}

export async function createGradeAppeal(req, res, next) {
  try {
    res.status(201).json({ data: await service.createGradeAppeal(req.body, req.user) });
  } catch (err) { next(err); }
}

export async function decideGradeAppeal(req, res, next) {
  try {
    res.json({ data: await service.decideGradeAppeal(req.params.id, req.body, req.user) });
  } catch (err) { next(err); }
}

export async function listOverridePetitions(req, res, next) {
  try {
    res.json({ data: await service.listOverridePetitions(req.user) });
  } catch (err) { next(err); }
}

export async function createOverridePetition(req, res, next) {
  try {
    res.status(201).json({ data: await service.createOverridePetition(req.body, req.user) });
  } catch (err) { next(err); }
}

export async function decideOverridePetition(req, res, next) {
  try {
    res.json({ data: await service.decideOverridePetition(req.params.id, req.body, req.user) });
  } catch (err) { next(err); }
}

export async function listAdvisees(req, res, next) {
  try {
    res.json({ data: await service.listAdvisees(req.user) });
  } catch (err) { next(err); }
}

export async function listEarlyAlerts(req, res, next) {
  try {
    res.json({ data: await service.listEarlyAlerts(req.user) });
  } catch (err) { next(err); }
}

export async function createEarlyAlert(req, res, next) {
  try {
    res.status(201).json({ data: await service.createEarlyAlert(req.body, req.user) });
  } catch (err) { next(err); }
}

export async function updateEarlyAlertStatus(req, res, next) {
  try {
    res.json({ data: await service.updateEarlyAlertStatus(req.params.id, req.body.status) });
  } catch (err) { next(err); }
}

export async function listMyDegreePlan(req, res, next) {
  try {
    res.json({ data: await service.listMyDegreePlan(req.user) });
  } catch (err) { next(err); }
}

export async function addMyDegreePlanItem(req, res, next) {
  try {
    res.status(201).json({ data: await service.addMyDegreePlanItem(req.body, req.user) });
  } catch (err) { next(err); }
}

export async function deleteMyDegreePlanItem(req, res, next) {
  try {
    await service.deleteMyDegreePlanItem(req.params.id, req.user);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getCourseRelations(req, res, next) {
  try {
    res.json({ data: await service.getCourseRelations(req.params.id) });
  } catch (err) { next(err); }
}

export async function setCourseCorequisites(req, res, next) {
  try {
    res.json({ data: await service.setCourseCorequisites(req.params.id, req.body.courseIds) });
  } catch (err) { next(err); }
}

export async function setCourseEquivalencies(req, res, next) {
  try {
    res.json({ data: await service.setCourseEquivalencies(req.params.id, req.body.courseIds) });
  } catch (err) { next(err); }
}
