import { AppError } from '../../utils/errors.js';
import * as repo from './repository.js';

export async function getMyFinance(actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  return repo.getStudentLedger(st.id);
}

export async function listAllLedger(studentId) {
  return repo.listAllLedger({ studentId: studentId || null });
}

export async function assessTerm(payload, actor) {
  const res = await repo.assessTermTuition(payload, actor.id);
  if (!res) throw new AppError(404, 'TERM_NOT_FOUND', 'Term not found');
  return res;
}

export async function createLedgerEntry(payload, actor) {
  const student = await repo.findStudentById(payload.studentId);
  if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');

  const isCredit = payload.entryType === 'scholarship_waiver' || payload.entryType === 'payment';
  const signedAmount = isCredit ? -Math.abs(Number(payload.amount)) : Math.abs(Number(payload.amount));

  return repo.createLedgerEntry(
    {
      studentId: student.id,
      studentUserId: student.user_id,
      termId: payload.termId,
      entryType: payload.entryType,
      description: payload.description,
      signedAmount
    },
    actor.id
  );
}

export async function enforceHolds(actor) {
  return repo.enforceFinancialHolds(actor.id);
}
