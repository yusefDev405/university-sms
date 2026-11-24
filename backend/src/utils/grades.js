export const GRADE_SCALE = Object.freeze({
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  F: 0.0
});

export const VALID_GRADE_LETTERS = Object.keys(GRADE_SCALE);

export function gradeLetterToPoints(letter) {
  if (!Object.hasOwn(GRADE_SCALE, letter)) {
    return null;
  }
  return GRADE_SCALE[letter];
}

export function calculateGpa(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { gpa: null, creditsAttempted: 0, creditsEarned: 0 };
  }

  let weightedSum = 0;
  let creditsAttempted = 0;
  let creditsEarned = 0;

  for (const item of items) {
    const credits = Number(item.credits);
    const points = Number(item.grade_points ?? item.gradePoints);
    if (!Number.isFinite(credits) || credits <= 0 || !Number.isFinite(points)) {
      continue;
    }
    weightedSum += points * credits;
    creditsAttempted += credits;
    if (points >= 1.0) {
      creditsEarned += credits;
    }
  }

  if (creditsAttempted === 0) {
    return { gpa: null, creditsAttempted: 0, creditsEarned: 0 };
  }

  return {
    gpa: Number((weightedSum / creditsAttempted).toFixed(2)),
    creditsAttempted,
    creditsEarned
  };
}
