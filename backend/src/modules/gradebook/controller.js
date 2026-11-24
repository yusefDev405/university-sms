import * as service from './service.js';

export async function getGradebook(req, res, next) {
  try {
    const data = await service.getOfferingGradebook(req.params.id, req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createAssessment(req, res, next) {
  try {
    const data = await service.createAssessment(req.params.id, req.body, req.user);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    await service.deleteAssessment(req.params.assessmentId, req.user);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function upsertScores(req, res, next) {
  try {
    const data = await service.upsertScores(req.params.assessmentId, req.body.scores, req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function computeFinalGrades(req, res, next) {
  try {
    const data = await service.computeAndPostFinalGrades(req.params.id, req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function listAnnouncements(req, res, next) {
  try {
    const data = await service.listAnnouncements(req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req, res, next) {
  try {
    const data = await service.createAnnouncement(req.params.id, req.body, req.user);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateSyllabus(req, res, next) {
  try {
    const data = await service.updateSyllabus(req.params.id, req.body.syllabusSummary, req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function myCoursework(req, res, next) {
  try {
    const data = await service.getMyCoursework(req.user);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
