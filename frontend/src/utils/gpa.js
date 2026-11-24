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

export function projectWhatIfGpa(existingCourses = [], hypotheticalCourses = []) {
  // Apply same highest-grade-per-course rule when courseCode repeats, or sum all hypothetical courses
  let totalPoints = 0;
  let totalCredits = 0;

  for (const c of existingCourses) {
    if (c.status === 'withdrawn' || c.grade_points === null || c.grade_points === undefined) continue;
    const credits = Number(c.credits || 0);
    const pts = Number(c.grade_points);
    if (credits > 0 && Number.isFinite(pts)) {
      totalPoints += pts * credits;
      totalCredits += credits;
    }
  }

  for (const h of hypotheticalCourses) {
    const credits = Number(h.credits || 0);
    const pts = GRADE_SCALE[h.gradeLetter];
    if (credits > 0 && Number.isFinite(pts)) {
      totalPoints += pts * credits;
      totalCredits += credits;
    }
  }

  if (totalCredits === 0) {
    return { gpa: null, totalCredits: 0 };
  }
  return {
    gpa: Number((totalPoints / totalCredits).toFixed(2)),
    totalCredits
  };
}
