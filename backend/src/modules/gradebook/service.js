import { AppError } from '../../utils/errors.js';
import { gradeLetterToPoints, percentageToGradeLetter } from '../../utils/grades.js';
import * as repo from './repository.js';

function assertOfferingTeacherOrAdmin(offering, actor) {
  if (!offering) throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only manage your own course offerings');
  }
}

export function computeStudentWeightedProjection(assessments, studentScoresMap) {
  let earnedWeighted = 0;
  let gradedWeight = 0;
  for (const a of assessments) {
    const rec = studentScoresMap.get(Number(a.id));
    if (rec && rec.score !== null && rec.score !== undefined) {
      earnedWeighted += (Number(rec.score) / Number(a.max_score)) * Number(a.weight_pct);
      gradedWeight += Number(a.weight_pct);
    }
  }
  if (gradedWeight === 0) {
    return { weightedPct: null, gradedWeightPct: 0, projectedLetter: null };
  }
  const normalizedPct = Number(((earnedWeighted / gradedWeight) * 100).toFixed(1));
  return {
    weightedPct: normalizedPct,
    gradedWeightPct: Number(gradedWeight.toFixed(1)),
    projectedLetter: percentageToGradeLetter(normalizedPct)
  };
}

export async function getOfferingGradebook(offeringId, actor) {
  const offering = await repo.findOfferingWithOwner(offeringId);
  if (!offering) throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');

  const [assessments, roster, allScores] = await Promise.all([
    repo.listAssessmentsByOffering(offeringId),
    repo.listRosterForGradebook(offeringId),
    repo.listScoresByOffering(offeringId)
  ]);

  let filteredRoster = roster;
  if (actor.role === 'instructor' && Number(offering.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view gradebooks for your own offerings');
  }
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
    filteredRoster = roster.filter((r) => Number(r.student_id) === Number(st.id));
    if (filteredRoster.length === 0) {
      throw new AppError(403, 'FORBIDDEN', 'You are not enrolled in this offering');
    }
  }

  const scoreByStudent = new Map();
  for (const sc of allScores) {
    if (!scoreByStudent.has(Number(sc.student_id))) {
      scoreByStudent.set(Number(sc.student_id), new Map());
    }
    scoreByStudent.get(Number(sc.student_id)).set(Number(sc.assessment_id), sc);
  }

  const rows = filteredRoster.map((student) => {
    const map = scoreByStudent.get(Number(student.student_id)) || new Map();
    const scores = {};
    for (const a of assessments) {
      const s = map.get(Number(a.id));
      scores[a.id] = s ? { score: s.score, feedback: s.feedback } : null;
    }
    const projection = computeStudentWeightedProjection(assessments, map);
    return {
      ...student,
      scores,
      ...projection
    };
  });

  const totalWeightPct = Number(assessments.reduce((acc, a) => acc + Number(a.weight_pct), 0).toFixed(1));
  return { offering, totalWeightPct, assessments, students: rows };
}

export async function createAssessment(offeringId, payload, actor) {
  const offering = await repo.findOfferingWithOwner(offeringId);
  assertOfferingTeacherOrAdmin(offering, actor);

  const existing = await repo.listAssessmentsByOffering(offeringId);
  const currentWeight = existing.reduce((sum, a) => sum + Number(a.weight_pct), 0);
  if (currentWeight + Number(payload.weightPct) > 100.001) {
    throw new AppError(400, 'WEIGHT_LIMIT_EXCEEDED', `Total assessment weight cannot exceed 100% (currently ${currentWeight}%)`);
  }

  return repo.createAssessment(offeringId, payload);
}

export async function deleteAssessment(assessmentId, actor) {
  const assessment = await repo.findAssessmentWithOwner(assessmentId);
  if (!assessment) throw new AppError(404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found');
  if (actor.role === 'instructor' && Number(assessment.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only modify your own assessments');
  }
  await repo.deleteAssessment(assessmentId);
}

export async function upsertScores(assessmentId, scores, actor) {
  const assessment = await repo.findAssessmentWithOwner(assessmentId);
  if (!assessment) throw new AppError(404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found');
  if (actor.role === 'instructor' && Number(assessment.instructor_user_id) !== actor.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only grade your own assessments');
  }

  for (const item of scores) {
    if (Number(item.score) > Number(assessment.max_score)) {
      throw new AppError(400, 'SCORE_EXCEEDS_MAX', `Score ${item.score} exceeds max score ${assessment.max_score}`);
    }
  }

  return repo.upsertAssessmentScores(assessmentId, scores, actor.id);
}

export async function computeAndPostFinalGrades(offeringId, actor) {
  const gb = await getOfferingGradebook(offeringId, actor);
  if (gb.assessments.length === 0) {
    throw new AppError(400, 'NO_ASSESSMENTS', 'Define at least one assessment before computing final grades');
  }
  const items = [];
  for (const st of gb.students) {
    if (st.projectedLetter) {
      items.push({
        enrollmentId: st.enrollment_id,
        gradeLetter: st.projectedLetter,
        gradePoints: gradeLetterToPoints(st.projectedLetter)
      });
    }
  }
  if (items.length === 0) {
    throw new AppError(400, 'NO_GRADED_SCORES', 'No student assessment scores available to compute final grades');
  }
  const updated = await repo.applyComputedGrades(offeringId, items, actor.id);
  return { updatedCount: updated.length, updated };
}

export async function listAnnouncements(offeringId) {
  const offering = await repo.findOfferingWithOwner(offeringId);
  if (!offering) throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  return repo.listAnnouncements(offeringId);
}

export async function createAnnouncement(offeringId, payload, actor) {
  const offering = await repo.findOfferingWithOwner(offeringId);
  assertOfferingTeacherOrAdmin(offering, actor);
  return repo.createAnnouncement(offeringId, actor.id, offering.course_code, payload);
}

export async function updateSyllabus(offeringId, syllabusSummary, actor) {
  const offering = await repo.findOfferingWithOwner(offeringId);
  assertOfferingTeacherOrAdmin(offering, actor);
  return repo.updateSyllabus(offeringId, syllabusSummary);
}

export async function getMyCoursework(actor) {
  const student = await repo.findStudentByUserId(actor.id);
  if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  const offerings = await repo.listStudentCourseworkOfferings(student.id);

  const enriched = await Promise.all(
    offerings.map(async (off) => {
      const [assessments, allScores, announcements] = await Promise.all([
        repo.listAssessmentsByOffering(off.offering_id),
        repo.listScoresByOffering(off.offering_id),
        repo.listAnnouncements(off.offering_id)
      ]);
      const studentMap = new Map();
      for (const sc of allScores) {
        if (Number(sc.student_id) === Number(student.id)) {
          studentMap.set(Number(sc.assessment_id), sc);
        }
      }
      const items = assessments.map((a) => {
        const s = studentMap.get(Number(a.id));
        return {
          ...a,
          score: s ? s.score : null,
          feedback: s ? s.feedback : null
        };
      });
      const projection = computeStudentWeightedProjection(assessments, studentMap);
      return {
        ...off,
        assessments: items,
        announcements,
        ...projection
      };
    })
  );

  return enriched;
}
