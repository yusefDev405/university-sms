import { describe, expect, it } from 'vitest';
import { calculateGpa, gradeLetterToPoints } from '../src/utils/grades.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from '../src/utils/tokens.js';
import { createUserSchema } from '../src/modules/users/schema.js';
import { setSingleGradeSchema } from '../src/modules/grades/schema.js';

describe('Unit: grades & GPA maths', () => {
  it('maps valid grade letters to grade points and rejects invalid ones', () => {
    expect(gradeLetterToPoints('A')).toBe(4.0);
    expect(gradeLetterToPoints('B+')).toBe(3.3);
    expect(gradeLetterToPoints('D')).toBe(1.0);
    expect(gradeLetterToPoints('F')).toBe(0.0);
    expect(gradeLetterToPoints('Z')).toBeNull();
  });

  it('computes credit-weighted GPA and earned credits accurately', () => {
    const result = calculateGpa([
      { credits: 3, grade_points: 4.0 }, // 12
      { credits: 3, grade_points: 3.0 }, // 9
      { credits: 4, grade_points: 0.0 }  // 0 (failed -> attempted 10, earned 6)
    ]);
    expect(result).toEqual({
      gpa: 2.1,
      creditsAttempted: 10,
      creditsEarned: 6
    });
  });

  it('returns null GPA for empty transcript', () => {
    expect(calculateGpa([])).toEqual({ gpa: null, creditsAttempted: 0, creditsEarned: 0 });
  });
});

describe('Unit: tokens & hashing', () => {
  it('signs and verifies JWT access token with sub and role', () => {
    const token = signAccessToken({ userId: 42, role: 'student' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.role).toBe('student');
  });

  it('generates 256-bit refresh tokens and deterministic SHA-256 hashes', () => {
    const t1 = generateRefreshToken();
    const t2 = generateRefreshToken();
    expect(t1).toHaveLength(64);
    expect(t1).not.toBe(t2);
    expect(hashRefreshToken(t1)).toHaveLength(64);
    expect(hashRefreshToken(t1)).toBe(hashRefreshToken(t1));
  });
});

describe('Unit: Zod validation schemas (strict mass-assignment protection)', () => {
  it('rejects unknown fields on user creation', () => {
    const res = createUserSchema.body.safeParse({
      email: 'test@galala.edu.eg',
      password: 'Password123!',
      role: 'student',
      extraPrivilege: true
    });
    expect(res.success).toBe(false);
  });

  it('rejects out-of-scale grade letters', () => {
    const res = setSingleGradeSchema.body.safeParse({ gradeLetter: 'E+' });
    expect(res.success).toBe(false);
  });
});
