import * as service from './service.js';

export async function listOfferings(req, res, next) {
  try {
    const result = await service.listOfferings(req.query, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOfferingById(req, res, next) {
  try {
    const offering = await service.getOfferingById(req.params.id);
    res.json({ data: offering });
  } catch (err) {
    next(err);
  }
}

export async function createOffering(req, res, next) {
  try {
    const created = await service.createOffering(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
}

export async function updateOffering(req, res, next) {
  try {
    const updated = await service.updateOffering(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getOfferingRoster(req, res, next) {
  try {
    const result = await service.getOfferingRoster(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getGradeDistribution(req, res, next) {
  try {
    const result = await service.getGradeDistribution(req.params.id, req.user);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
