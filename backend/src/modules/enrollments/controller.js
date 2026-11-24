import { generateTranscriptPdfBuffer } from '../../utils/pdf.js';
import * as service from './service.js';

export async function createEnrollment(req, res, next) {
  try {
    const result = await service.enrollCurrentStudent(req.user.id, req.body.offeringId);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function swapEnrollment(req, res, next) {
  try {
    const result = await service.swapEnrollment(
      req.user.id,
      req.body.dropEnrollmentId,
      req.body.targetOfferingId
    );
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function dropEnrollment(req, res, next) {
  try {
    await service.dropEnrollment(req.params.id, req.user);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getMyEnrollments(req, res, next) {
  try {
    const rows = await service.getMyEnrollments(req.user.id, req.query.termId);
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getMyTranscript(req, res, next) {
  try {
    const transcript = await service.getMyTranscript(req.user.id);
    res.json({ data: transcript });
  } catch (err) {
    next(err);
  }
}

export async function downloadMyTranscriptPdf(req, res, next) {
  try {
    const transcript = await service.getMyTranscript(req.user.id);
    const pdf = generateTranscriptPdfBuffer(transcript);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transcript_${transcript.student.student_number}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}

export async function getMyDegreeAudit(req, res, next) {
  try {
    const audit = await service.getMyDegreeAudit(req.user.id);
    res.json({ data: audit });
  } catch (err) {
    next(err);
  }
}
