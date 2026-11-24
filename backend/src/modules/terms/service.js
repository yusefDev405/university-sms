import { AppError } from '../../utils/errors.js';
import * as repo from './repository.js';

export async function listTerms() {
  return repo.listTerms();
}

export async function createTerm(body, actorUserId) {
  if (body.startDate >= body.endDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'startDate must be before endDate');
  }
  if (new Date(body.registrationOpens) > new Date(body.registrationCloses)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'registrationOpens must be before or equal to registrationCloses');
  }
  return repo.createTerm(body, actorUserId);
}

export async function updateTerm(id, body, actorUserId) {
  const updated = await repo.updateTerm(id, body, actorUserId);
  if (!updated) {
    throw new AppError(404, 'TERM_NOT_FOUND', 'Term not found');
  }
  return updated;
}
