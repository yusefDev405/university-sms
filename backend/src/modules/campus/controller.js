import * as service from './service.js';

export async function listRooms(_req, res, next) {
  try { res.json({ data: await service.listRooms() }); } catch (err) { next(err); }
}

export async function createRoom(req, res, next) {
  try { res.status(201).json({ data: await service.createRoom(req.body) }); } catch (err) { next(err); }
}

export async function deleteRoom(req, res, next) {
  try { await service.deleteRoom(req.params.id); res.status(204).send(); } catch (err) { next(err); }
}

export async function listExams(req, res, next) {
  try {
    const termId = req.query.termId ? Number(req.query.termId) : null;
    res.json({ data: await service.listExams(termId) });
  } catch (err) { next(err); }
}

export async function listMyExams(req, res, next) {
  try { res.json({ data: await service.listMyExams(req.user) }); } catch (err) { next(err); }
}

export async function createExam(req, res, next) {
  try { res.status(201).json({ data: await service.createOrUpdateExam(req.body) }); } catch (err) { next(err); }
}

export async function deleteExam(req, res, next) {
  try { await service.deleteExam(req.params.id); res.status(204).send(); } catch (err) { next(err); }
}

export async function listOfficeHours(req, res, next) {
  try { res.json({ data: await service.listOfficeHours(req.user) }); } catch (err) { next(err); }
}

export async function createOfficeHourSlot(req, res, next) {
  try { res.status(201).json({ data: await service.createOfficeHourSlot(req.body, req.user) }); } catch (err) { next(err); }
}

export async function deleteOfficeHourSlot(req, res, next) {
  try { await service.deleteOfficeHourSlot(req.params.id, req.user); res.status(204).send(); } catch (err) { next(err); }
}

export async function bookOfficeHour(req, res, next) {
  try { res.status(201).json({ data: await service.bookOfficeHour(req.body, req.user) }); } catch (err) { next(err); }
}

export async function cancelBooking(req, res, next) {
  try { res.json({ data: await service.cancelBooking(req.params.id, req.user) }); } catch (err) { next(err); }
}

export async function listMyEvaluations(req, res, next) {
  try { res.json({ data: await service.listMyEvaluations(req.user) }); } catch (err) { next(err); }
}

export async function submitEvaluation(req, res, next) {
  try { res.status(201).json({ data: await service.submitEvaluation(req.body, req.user) }); } catch (err) { next(err); }
}

export async function getEvaluationSummary(req, res, next) {
  try { res.json({ data: await service.getEvaluationSummary(req.params.id, req.user) }); } catch (err) { next(err); }
}

export async function listCalendarEvents(req, res, next) {
  try {
    const termId = req.query.termId ? Number(req.query.termId) : null;
    res.json({ data: await service.listCalendarEvents(termId) });
  } catch (err) { next(err); }
}

export async function createCalendarEvent(req, res, next) {
  try { res.status(201).json({ data: await service.createCalendarEvent(req.body) }); } catch (err) { next(err); }
}

export async function deleteCalendarEvent(req, res, next) {
  try { await service.deleteCalendarEvent(req.params.id); res.status(204).send(); } catch (err) { next(err); }
}

export async function getExecutiveAnalytics(_req, res, next) {
  try { res.json({ data: await service.getExecutiveAnalytics() }); } catch (err) { next(err); }
}
