import * as service from './service.js';

export async function myFinance(req, res, next) {
  try { res.json({ data: await service.getMyFinance(req.user) }); } catch (err) { next(err); }
}

export async function listLedger(req, res, next) {
  try {
    const sid = req.query.studentId ? Number(req.query.studentId) : null;
    res.json({ data: await service.listAllLedger(sid) });
  } catch (err) { next(err); }
}

export async function assessTerm(req, res, next) {
  try { res.status(201).json({ data: await service.assessTerm(req.body, req.user) }); } catch (err) { next(err); }
}

export async function createEntry(req, res, next) {
  try { res.status(201).json({ data: await service.createLedgerEntry(req.body, req.user) }); } catch (err) { next(err); }
}

export async function enforceHolds(req, res, next) {
  try { res.json({ data: await service.enforceHolds(req.user) }); } catch (err) { next(err); }
}
