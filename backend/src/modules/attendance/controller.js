import * as service from './service.js';

export async function getOfferingAttendance(req, res, next) {
  try {
    const data = await service.getOfferingAttendance(req.params.id, req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function recordAttendance(req, res, next) {
  try {
    const session = await service.recordAttendance(req.params.id, req.body, req.user);
    res.status(201).json({ data: session });
  } catch (err) {
    next(err);
  }
}

export async function getMyAttendance(req, res, next) {
  try {
    const data = await service.getMyAttendance(req.user.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
