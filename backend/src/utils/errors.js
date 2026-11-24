export class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function mapPgError(err) {
  if (err instanceof AppError) return err;

  const pgCode = err?.code;
  const msg = String(err?.message || '');

  if (pgCode === '23505') {
    if (msg.includes('enrollments') || msg.toLowerCase().includes('already registered')) {
      return new AppError(409, 'ALREADY_REGISTERED', 'Already registered in this offering');
    }
    return new AppError(409, 'DUPLICATE_RESOURCE', 'Resource already exists');
  }

  if (pgCode === '23503') {
    return new AppError(409, 'REFERENCE_CONSTRAINT', 'Operation blocked by existing related records');
  }

  if (pgCode === '23514') {
    return new AppError(400, 'CONSTRAINT_VIOLATION', 'Input violates database integrity constraints');
  }

  if (pgCode === 'P0001' || msg) {
    if (msg.includes('Offering not found')) {
      return new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
    }
    if (msg.includes('Student not found')) {
      return new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    }
    if (msg.includes('Student is not active')) {
      return new AppError(403, 'STUDENT_INACTIVE', 'Student account is not active for registration');
    }
    if (msg.includes('Registration hold active')) {
      return new AppError(403, 'REGISTRATION_HOLD', 'Registration blocked due to an active academic hold');
    }
    if (msg.includes('Registration is closed')) {
      return new AppError(403, 'REGISTRATION_CLOSED', 'Registration window for this term is closed');
    }
    if (msg.includes('Prerequisites not met')) {
      return new AppError(409, 'PREREQUISITES_NOT_MET', 'Prerequisites not met');
    }
    if (msg.includes('Schedule conflict')) {
      return new AppError(409, 'SCHEDULE_CONFLICT', 'Schedule conflict with an existing enrolled course');
    }
    if (msg.includes('Credit limit exceeded')) {
      return new AppError(409, 'CREDIT_LIMIT_EXCEEDED', msg);
    }
  }

  return null;
}
