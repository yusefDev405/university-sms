import * as service from './service.js';

export async function listAdmissions(_req, res, next) {
  try { res.json({ data: await service.listAdmissions() }); } catch (err) { next(err); }
}

export async function createAdmission(req, res, next) {
  try { res.status(201).json({ data: await service.createAdmission(req.body) }); } catch (err) { next(err); }
}

export async function updateAdmissionStatus(req, res, next) {
  try { res.json({ data: await service.updateAdmissionStatus(req.params.id, req.body, req.user) }); } catch (err) { next(err); }
}

export async function matriculateApplicant(req, res, next) {
  try { res.status(201).json({ data: await service.matriculateApplicant(req.params.id, req.user) }); } catch (err) { next(err); }
}

export async function listTransferCredits(req, res, next) {
  try {
    const sid = req.query.studentId ? Number(req.query.studentId) : null;
    res.json({ data: await service.listTransferCredits(sid, req.user) });
  } catch (err) { next(err); }
}

export async function createTransferCredit(req, res, next) {
  try { res.status(201).json({ data: await service.createTransferCredit(req.body, req.user) }); } catch (err) { next(err); }
}

export async function deleteTransferCredit(req, res, next) {
  try { await service.deleteTransferCredit(req.params.id); res.status(204).send(); } catch (err) { next(err); }
}

export async function listGraduationApplications(req, res, next) {
  try { res.json({ data: await service.listGraduationApplications(req.user) }); } catch (err) { next(err); }
}

export async function applyForGraduation(req, res, next) {
  try { res.status(201).json({ data: await service.applyForGraduation(req.body, req.user) }); } catch (err) { next(err); }
}

export async function decideGraduationApplication(req, res, next) {
  try { res.json({ data: await service.decideGraduationApplication(req.params.id, req.body, req.user) }); } catch (err) { next(err); }
}

export async function verifyCredential(req, res, next) {
  try { res.json({ data: await service.verifyPublicCredential(req.params.code) }); } catch (err) { next(err); }
}
