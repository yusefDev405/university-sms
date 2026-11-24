import * as service from './service.js';

export async function listMyNotifications(req, res, next) {
  try {
    const data = await service.listMyNotifications(req.user.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const data = await service.markNotificationRead(req.params.id, req.user.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listMyHolds(req, res, next) {
  try {
    const data = await service.listMyHolds(req.user.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listAllHolds(_req, res, next) {
  try {
    const data = await service.listAllHolds();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createHold(req, res, next) {
  try {
    const data = await service.createHold(req.body, req.user.id);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function resolveHold(req, res, next) {
  try {
    const data = await service.resolveHold(req.params.id, req.user.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
