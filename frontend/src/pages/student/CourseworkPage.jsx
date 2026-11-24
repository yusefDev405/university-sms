import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CourseworkPage({ notify }) {
  const [tab, setTab] = useState('gradebook');
  const [coursework, setCoursework] = useState([]);
  const [exams, setExams] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [officeHours, setOfficeHours] = useState({ slots: [], bookings: [] });
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bookingForm, setBookingForm] = useState({ slotId: '', bookingDate: '2027-03-14', topic: '' });
  const [evalDrafts, setEvalDrafts] = useState({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cwRes, exRes, calRes, ohRes, evRes] = await Promise.all([
        apiRequest('/me/coursework'),
        apiRequest('/me/exams'),
        apiRequest('/calendar'),
        apiRequest('/office-hours'),
        apiRequest('/me/evaluations')
      ]);
      setCoursework(cwRes.data || []);
      setExams(exRes.data || []);
      setCalendar(calRes.data || []);
      setOfficeHours(ohRes.data || { slots: [], bookings: [] });
      setEvaluations(evRes.data || []);
      if (ohRes.data?.slots?.length > 0) {
        setBookingForm((f) => (f.slotId ? f : { ...f, slotId: String(ohRes.data.slots[0].id) }));
      }
    } catch (err) {
      notify(err.message || 'Could not load coursework portal', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleBookSlot = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/office-hours/bookings', {
        method: 'POST',
        body: {
          slotId: Number(bookingForm.slotId),
          bookingDate: bookingForm.bookingDate,
          topic: bookingForm.topic
        }
      });
      setBookingForm((f) => ({ ...f, topic: '' }));
      notify('Office hour appointment booked.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCancelBooking = async (id) => {
    try {
      await apiRequest(`/office-hours/bookings/${id}/cancel`, { method: 'PATCH' });
      notify('Appointment cancelled.', 'info');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSubmitEval = async (offeringId) => {
    const draft = evalDrafts[offeringId] || { ratingTeaching: 5, ratingContent: 5, ratingFairness: 5, comment: '' };
    try {
      await apiRequest('/evaluations', {
        method: 'POST',
        body: {
          offeringId: Number(offeringId),
          ratingTeaching: Number(draft.ratingTeaching),
          ratingContent: Number(draft.ratingContent),
          ratingFairness: Number(draft.ratingFairness),
          comment: draft.comment || undefined
        }
      });
      notify('Anonymous course evaluation recorded.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <section aria-labelledby="coursework-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Academic Portal</div>
          <h1 id="coursework-heading">Coursework, Exams &amp; Faculty Services</h1>
        </div>
      </div>

      <div className="tablist" role="tablist" aria-label="Coursework sections">
        {[
          { id: 'gradebook', label: 'Gradebook & Announcements' },
          { id: 'exams', label: 'Final Exams & Calendar' },
          { id: 'office-hours', label: 'Office Hours Booking' },
          { id: 'evaluations', label: 'Anonymous Evaluations' }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted" role="status">Loading academic coursework…</p>
      ) : null}

      {!loading && tab === 'gradebook' ? (
        <div role="tabpanel" aria-label="Gradebook and Announcements">
          {coursework.length === 0 ? (
            <div className="panel">
              <p className="muted">No active courses found for coursework tracking.</p>
            </div>
          ) : (
            coursework.map((cw) => (
              <div className="panel" key={cw.offering_id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'baseline' }}>
                  <div>
                    <h2 style={{ marginBottom: '0.15rem' }}>
                      <span className="mono">{cw.course_code}</span> · {cw.course_title} (Sec {cw.section})
                    </h2>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {cw.term_name} • {cw.instructor_name} • Room {cw.room}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {cw.weightedPct !== null ? (
                      <span className="mono" style={{ fontWeight: 600 }}>
                        Weighted: {cw.weightedPct}% ({cw.projectedLetter})
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: '0.84rem' }}>No graded items yet</span>
                    )}
                    <StatusBadge status={cw.status} />
                  </div>
                </div>

                {cw.syllabus_summary ? (
                  <p style={{ marginTop: '0.6rem', fontSize: '0.9rem' }}>
                    <strong>Syllabus:</strong> {cw.syllabus_summary}
                  </p>
                ) : null}

                {cw.assessments?.length > 0 ? (
                  <ResponsiveTable
                    caption="Weighted Assessments"
                    getRowKey={(r) => r.id}
                    columns={[
                      { key: 'title', header: 'Assessment', render: (r) => r.title },
                      { key: 'category', header: 'Category', render: (r) => <span className="mono">{r.category}</span> },
                      { key: 'weight', header: 'Weight', render: (r) => <span className="tabular">{r.weight_pct}%</span> },
                      {
                        key: 'score',
                        header: 'Score',
                        render: (r) => <span className="tabular">{r.score !== null ? `${r.score} / ${r.max_score}` : 'Pending'}</span>
                      },
                      { key: 'feedback', header: 'Feedback', render: (r) => r.feedback || '—' }
                    ]}
                    rows={cw.assessments}
                  />
                ) : (
                  <p className="muted" style={{ fontSize: '0.86rem' }}>No gradebook assessments published yet.</p>
                )}

                {cw.announcements?.length > 0 ? (
                  <details style={{ marginTop: '0.75rem' }} open>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      Course Announcements ({cw.announcements.length})
                    </summary>
                    <ul className="compact-list" style={{ marginTop: '0.5rem' }}>
                      {cw.announcements.map((a) => (
                        <li key={a.id} className="compact-list-item" style={{ display: 'block' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <strong>{a.title}</strong>
                            <span className="muted mono" style={{ fontSize: '0.76rem' }}>{String(a.created_at).slice(0, 10)}</span>
                          </div>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.86rem' }}>{a.body}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      {!loading && tab === 'exams' ? (
        <div role="tabpanel" aria-label="Final Exams and Academic Calendar" className="grid-2">
          <div className="panel">
            <h2>My Final Examination Schedule</h2>
            {exams.length === 0 ? (
              <p className="muted">No final exams scheduled for your current enrollments yet.</p>
            ) : (
              <ResponsiveTable
                caption="Scheduled Final Exams"
                getRowKey={(r) => r.id}
                columns={[
                  { key: 'course', header: 'Course', render: (r) => <span className="mono">{r.course_code}</span> },
                  { key: 'date', header: 'Date', render: (r) => <span className="mono">{String(r.exam_date).slice(0, 10)}</span> },
                  { key: 'time', header: 'Time', render: (r) => <span className="mono">{r.start_time}–{r.end_time}</span> },
                  { key: 'room', header: 'Hall', render: (r) => r.room }
                ]}
                rows={exams}
              />
            )}
          </div>

          <div className="panel">
            <h2>University Academic Calendar</h2>
            <ResponsiveTable
              caption="Key Deadlines & Milestones"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'date', header: 'Date', render: (r) => <span className="mono">{String(r.event_date).slice(0, 10)}</span> },
                { key: 'title', header: 'Milestone', render: (r) => r.title },
                { key: 'type', header: 'Category', render: (r) => <span className="mono">{r.event_type}</span> }
              ]}
              rows={calendar}
            />
          </div>
        </div>
      ) : null}

      {!loading && tab === 'office-hours' ? (
        <div role="tabpanel" aria-label="Office Hours Booking" className="grid-2">
          <div className="panel">
            <h2>Book Faculty Office Hours</h2>
            <form onSubmit={handleBookSlot}>
              <div className="field">
                <label htmlFor="oh-slot">Faculty Slot</label>
                <select
                  id="oh-slot"
                  value={bookingForm.slotId}
                  onChange={(e) => setBookingForm((f) => ({ ...f, slotId: e.target.value }))}
                  required
                >
                  {officeHours.slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.instructor_name} ({DAYS[s.day_of_week]} {s.start_time}–{s.end_time}, {s.location})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="oh-date">Appointment Date</label>
                <input
                  id="oh-date"
                  type="date"
                  required
                  value={bookingForm.bookingDate}
                  onChange={(e) => setBookingForm((f) => ({ ...f, bookingDate: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="oh-topic">Discussion Topic</label>
                <input
                  id="oh-topic"
                  type="text"
                  required
                  minLength={3}
                  placeholder="e.g. Midterm review or research project guidance"
                  value={bookingForm.topic}
                  onChange={(e) => setBookingForm((f) => ({ ...f, topic: e.target.value }))}
                />
              </div>
              <button type="submit" className="primary">Reserve Slot</button>
            </form>
          </div>

          <div className="panel">
            <h2>My Booked Appointments</h2>
            <ResponsiveTable
              caption="Office Hour Appointments"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'date', header: 'Date', render: (r) => <span className="mono">{String(r.booking_date).slice(0, 10)}</span> },
                { key: 'faculty', header: 'Instructor', render: (r) => `${r.instructor_name} (${r.location})` },
                { key: 'topic', header: 'Topic', render: (r) => r.topic },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                {
                  key: 'action',
                  header: 'Action',
                  render: (r) =>
                    r.status === 'booked' ? (
                      <button type="button" className="danger" onClick={() => handleCancelBooking(r.id)}>
                        Cancel
                      </button>
                    ) : '—'
                }
              ]}
              rows={officeHours.bookings}
            />
          </div>
        </div>
      ) : null}

      {!loading && tab === 'evaluations' ? (
        <div role="tabpanel" aria-label="Anonymous Course Evaluations" className="panel">
          <h2>End-of-Term Course &amp; Teaching Evaluations</h2>
          <p className="muted">
            Submissions are recorded separately from responses to guarantee strict anonymity.
          </p>
          {evaluations.map((ev) => {
            const draft = evalDrafts[ev.offering_id] || {
              ratingTeaching: 5,
              ratingContent: 5,
              ratingFairness: 5,
              comment: ''
            };
            return (
              <div className="compact-list-item" key={ev.offering_id} style={{ display: 'block', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <div>
                    <strong>{ev.course_code}: {ev.course_title}</strong> ({ev.term_name}) — {ev.instructor_name}
                  </div>
                  <StatusBadge status={ev.already_submitted ? 'completed' : 'pending'} label={ev.already_submitted ? 'Submitted' : 'Pending'} />
                </div>
                {!ev.already_submitted ? (
                  <div className="filter-bar" style={{ marginBottom: 0 }}>
                    <div className="field">
                      <label htmlFor={`ev-t-${ev.offering_id}`}>Teaching (1–5)</label>
                      <select
                        id={`ev-t-${ev.offering_id}`}
                        value={draft.ratingTeaching}
                        onChange={(e) =>
                          setEvalDrafts((prev) => ({ ...prev, [ev.offering_id]: { ...draft, ratingTeaching: e.target.value } }))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`ev-c-${ev.offering_id}`}>Course Content (1–5)</label>
                      <select
                        id={`ev-c-${ev.offering_id}`}
                        value={draft.ratingContent}
                        onChange={(e) =>
                          setEvalDrafts((prev) => ({ ...prev, [ev.offering_id]: { ...draft, ratingContent: e.target.value } }))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`ev-f-${ev.offering_id}`}>Grading Fairness (1–5)</label>
                      <select
                        id={`ev-f-${ev.offering_id}`}
                        value={draft.ratingFairness}
                        onChange={(e) =>
                          setEvalDrafts((prev) => ({ ...prev, [ev.offering_id]: { ...draft, ratingFairness: e.target.value } }))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`ev-msg-${ev.offering_id}`}>Anonymous Feedback</label>
                      <input
                        id={`ev-msg-${ev.offering_id}`}
                        type="text"
                        placeholder="Optional constructive comment"
                        value={draft.comment}
                        onChange={(e) =>
                          setEvalDrafts((prev) => ({ ...prev, [ev.offering_id]: { ...draft, comment: e.target.value } }))
                        }
                      />
                    </div>
                    <button type="button" className="primary" onClick={() => handleSubmitEval(ev.offering_id)}>
                      Submit Anonymously
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
