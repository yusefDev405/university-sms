import * as service from './service.js';

export async function listCourses(req, res, next) {
  try {
    const result = await service.listCourses(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCourseById(req, res, next) {
  try {
    const course = await service.getCourseById(req.params.id);
    res.json({ data: course });
  } catch (err) {
    next(err);
  }
}

export async function createCourse(req, res, next) {
  try {
    const created = await service.createCourse(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req, res, next) {
  try {
    const updated = await service.updateCourse(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function replacePrerequisites(req, res, next) {
  try {
    const updated = await service.replacePrerequisites(req.params.id, req.body.prerequisiteIds);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}
