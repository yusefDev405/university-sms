import { AppError } from '../../utils/errors.js';
import * as repo from './repository.js';

export async function listRooms() {
  return repo.listRooms();
}

export async function createRoom(payload) {
  return repo.createRoom(payload);
}

export async function deleteRoom(id) {
  const del = await repo.deleteRoom(id);
  if (!del) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
}

export async function listExams(termId) {
  return repo.listExams({ termId: termId || null });
}

export async function listMyExams(actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  return repo.listExams({ studentId: st.id });
}

export async function createOrUpdateExam(payload) {
  const [roomConflicts, studentConflicts] = await Promise.all([
    repo.findExamRoomConflicts(payload),
    repo.findStudentExamConflicts(payload)
  ]);

  if (roomConflicts.length > 0) {
    const first = roomConflicts[0];
    throw new AppError(
      409,
      'EXAM_CONFLICT',
      `Room ${payload.room} is already booked on ${payload.examDate} for ${first.course_code} (Sec ${first.section})`
    );
  }

  if (studentConflicts.length > 0) {
    const first = studentConflicts[0];
    throw new AppError(
      409,
      'EXAM_CONFLICT',
      `Enrolled student ${first.student_number} has an overlapping final exam in ${first.conflicting_course}`
    );
  }

  return repo.upsertExamSchedule(payload);
}

export async function deleteExam(id) {
  const del = await repo.deleteExamSchedule(id);
  if (!del) throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam schedule not found');
}

export async function listOfficeHours(actor) {
  const slots = await repo.listOfficeHourSlots();
  let bookings = [];
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (st) bookings = await repo.listOfficeHourBookings({ studentId: st.id });
  } else if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (inst) bookings = await repo.listOfficeHourBookings({ instructorId: inst.id });
  } else {
    bookings = await repo.listOfficeHourBookings({});
  }
  return { slots, bookings };
}

export async function createOfficeHourSlot(payload, actor) {
  const inst = await repo.findInstructorByUserId(actor.id);
  if (!inst) throw new AppError(400, 'INSTRUCTOR_REQUIRED', 'Instructor profile required to publish office hours');
  return repo.createOfficeHourSlot(inst.id, payload);
}

export async function deleteOfficeHourSlot(id, actor) {
  const slot = await repo.findOfficeHourSlotById(id);
  if (!slot) throw new AppError(404, 'SLOT_NOT_FOUND', 'Office hour slot not found');
  if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst || Number(inst.id) !== Number(slot.instructor_id)) {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete your own office hour slots');
    }
  }
  await repo.deleteOfficeHourSlot(id);
}

export async function bookOfficeHour(payload, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  const slot = await repo.findOfficeHourSlotById(payload.slotId);
  if (!slot) throw new AppError(404, 'SLOT_NOT_FOUND', 'Office hour slot not found');
  try {
    return await repo.createOfficeHourBooking(st.id, payload);
  } catch (err) {
    if (err?.code === '23505') {
      throw new AppError(409, 'SLOT_ALREADY_BOOKED', 'This office hour date/slot is already booked');
    }
    throw err;
  }
}

export async function cancelBooking(id, actor) {
  const booking = await repo.findBookingWithOwners(id);
  if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  if (actor.role === 'student') {
    const st = await repo.findStudentByUserId(actor.id);
    if (!st || Number(booking.student_id) !== Number(st.id)) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel your own booking');
    }
  } else if (actor.role === 'instructor') {
    const inst = await repo.findInstructorByUserId(actor.id);
    if (!inst || Number(booking.instructor_id) !== Number(inst.id)) {
      throw new AppError(403, 'FORBIDDEN', 'You can only cancel bookings on your own office hours');
    }
  }
  return repo.cancelOfficeHourBooking(id);
}

export async function listMyEvaluations(actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  return repo.listStudentEvaluationsStatus(st.id);
}

export async function submitEvaluation(payload, actor) {
  const st = await repo.findStudentByUserId(actor.id);
  if (!st) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student profile not found');
  const enrolled = await repo.isStudentEnrolledInOffering(st.id, payload.offeringId);
  if (!enrolled) {
    throw new AppError(403, 'FORBIDDEN', 'You can only evaluate courses you are or were enrolled in');
  }
  try {
    return await repo.submitAnonymousEvaluation(st.id, payload);
  } catch (err) {
    if (err?.code === '23505') {
      throw new AppError(409, 'ALREADY_EVALUATED', 'You have already submitted an anonymous evaluation for this offering');
    }
    throw err;
  }
}

export async function getEvaluationSummary(offeringId, actor) {
  const owner = await repo.getOfferingOwner(offeringId);
  if (!owner) throw new AppError(404, 'OFFERING_NOT_FOUND', 'Course offering not found');
  if (actor.role === 'instructor' && Number(owner.instructor_user_id) !== Number(actor.id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view evaluation summaries for your own offerings');
  }
  return repo.getEvaluationSummary(offeringId);
}

export async function listCalendarEvents(termId) {
  return repo.listCalendarEvents(termId || null);
}

export async function createCalendarEvent(payload) {
  return repo.createCalendarEvent(payload);
}

export async function deleteCalendarEvent(id) {
  const del = await repo.deleteCalendarEvent(id);
  if (!del) throw new AppError(404, 'EVENT_NOT_FOUND', 'Calendar event not found');
}

export async function getExecutiveAnalytics() {
  return repo.getExecutiveAnalytics();
}
