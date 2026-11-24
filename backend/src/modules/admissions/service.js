import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import * as repo from './repository.js';

export async function listAdmissions() {
  return repo.listAdmissions();
}

export async function createAdmission(payload) {
  return repo.createAdmission(payload);
}

export async function updateAdmissionStatus(id, payload, actor) {
  const existing = await repo.findAdmissionById(id);
  if (!existing) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Admissions application not found');
  if (existing.status === 'matriculated') {
    throw new AppError(409, 'ALREADY_MATRICULATED', 'Applicant is already matriculated');
  }
  return repo.updateAdmissionStatus(id, payload.status, payload.decisionNote, actor.id);
}

export async function matriculateApplicant(id, actor) {
  const app = await repo.findAdmissionById(id);
  if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Admissions application not found');
  if (app.status !== 'admitted') {
    throw new AppError(409, 'NOT_ADMITTED', 'Only admitted applications can be matriculated into student records');
  }

  const rounds = env.NODE_ENV === 'test' ? 6 : 12;
  const tempPassword = 'Student123!';
  const passwordHash = await bcrypt.hash(tempPassword, rounds);
  const studentNumber = await repo.getNextStudentNumber();

  const res = await repo.matriculateApplicant(app, { passwordHash, studentNumber }, actor.id);
  return { ...res, temporaryPassword: tempPassword };
}

export async function listTransferCredits(studentId, actor) {
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    return repo.listTransferCredits(st.id);
  }
  return repo.listTransferCredits(studentId || null);
}

export async function createTransferCredit(payload, actor) {
  return repo.createTransferCredit(payload, actor.id);
}

export async function deleteTransferCredit(id) {
  const deleted = await repo.deleteTransferCredit(id);
  if (!deleted) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Transfer credit record not found');
}

export async function listGraduationApplications(actor) {
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    return repo.listGraduationApplications(st.id);
  }
  return repo.listGraduationApplications(null);
}

export async function applyForGraduation({ targetTerm }, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');

  const summary = await repo.getStudentAcademicSummary(st.id);
  const creditsVerified = Number(summary.earned_credits || 0) + Number(summary.transfer_credits || 0);
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  const verificationCode = `GAL-${year}-${st.department_code}-${st.student_number}-${suffix}`;

  return repo.createGraduationApplication(
    st.id,
    {
      targetTerm,
      verificationCode,
      creditsVerified,
      gpaVerified: summary.gpa
    },
    actor.id
  );
}

export async function decideGraduationApplication(id, payload, actor) {
  const app = await repo.findGraduationApplicationById(id);
  if (!app) throw new AppError(404, 'GRADUATION_APP_NOT_FOUND', 'Graduation application not found');
  return repo.decideGraduationApplication(app, payload, actor.id);
}

export async function verifyPublicCredential(code) {
  const record = await repo.verifyCredentialByCode(code);
  if (!record) {
    throw new AppError(404, 'CREDENTIAL_NOT_FOUND', 'No conferred or approved academic credential matches that verification code');
  }
  return record;
}
