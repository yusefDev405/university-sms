import { generateTranscriptPdfBuffer } from '../../utils/pdf.js';
import * as service from './service.js';

export async function listStudents(req, res, next) {
  try {
    const result = await service.listStudents(req.query, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStudentById(req, res, next) {
  try {
    const student = await service.getStudentById(req.params.id, req.user);
    res.json({ data: student });
  } catch (err) {
    next(err);
  }
}

export async function createStudent(req, res, next) {
  try {
    const created = await service.createStudent(req.body);
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
}

export async function updateStudent(req, res, next) {
  try {
    const updated = await service.updateStudent(req.params.id, req.body);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getStudentTranscript(req, res, next) {
  try {
    const transcript = await service.getStudentTranscript(req.params.id);
    res.json({ data: transcript });
  } catch (err) {
    next(err);
  }
}

export async function downloadStudentTranscriptPdf(req, res, next) {
  try {
    const transcript = await service.getStudentTranscript(req.params.id);
    const pdf = generateTranscriptPdfBuffer(transcript);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transcript_${transcript.student.student_number}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}
