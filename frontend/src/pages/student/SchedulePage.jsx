import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { DAY_NAMES, formatMeetings } from '../../utils/schedule.js';

export function SchedulePage({ notify }) {
  const [enrollments, setEnrollments] = useState([]);
  const [attendance, setAttendance] = useState({ summary: [], recent: [] });
  const [maxTermCredits, setMaxTermCredits] = useState(18);
  const [standing, setStanding] = useState('Good Standing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dropTarget, setDropTarget] = useState(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [schedRes, transRes, attRes] = await Promise.all([
        apiRequest('/me/enrollments'),
        apiRequest('/me/transcript'),
        apiRequest('/me/attendance')
      ]);
      setEnrollments(schedRes.data || []);
      setMaxTermCredits(transRes.data?.summary?.maxTermCredits || 18);
      setStanding(transRes.data?.summary?.standing || 'Good Standing');
      setAttendance(attRes.data || { summary: [], recent: [] });
    } catch (err) {
      setError(err.message || 'Could not load your schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const confirmDrop = async () => {
    if (!dropTarget) return;
    const target = dropTarget;
    setDropTarget(null);
    try {
      await apiRequest(`/enrollments/${target.enrollment_id}`, { method: 'DELETE' });
      notify(`Dropped ${target.course_code} (Section ${target.section}).`, 'success');
      await loadSchedule();
    } catch (err) {
      setError(err.message || 'Could not drop course');
      notify(err.message, 'error');
    }
  };

  const activeItems = enrollments.filter((e) => e.status === 'enrolled' || e.status === 'waitlisted');
  const enrolledOnly = enrollments.filter((e) => e.status === 'enrolled');
  const totalActiveCredits = enrolledOnly.reduce((acc, e) => acc + Number(e.credits || 0), 0);

  const slotsByDay = [0, 1, 2, 3, 4].map((dayIdx) => {
    const items = [];
    for (const enr of enrolledOnly) {
      for (const m of enr.meetings || []) {
        if (Number(m.day_of_week) === dayIdx) {
          items.push({
            id: `${enr.enrollment_id}-${m.start_time}`,
            code: enr.course_code,
            title: enr.course_title,
            room: enr.room,
            start: m.start_time,
            end: m.end_time
          });
        }
      }
    }
    items.sort((a, b) => a.start.localeCompare(b.start));
    return { dayIdx, dayName: DAY_NAMES[dayIdx], items };
  });

  const columns = [
    {
      key: 'course',
      header: 'Course',
      render: (r) => (
        <div>
          <div className="mono">{r.course_code} · Sec {r.section}</div>
          <div>{r.course_title}</div>
        </div>
      )
    },
    { key: 'term_name', header: 'Term' },
    {
      key: 'meetings',
      header: 'Meeting Times',
      render: (r) => <span className="mono" style={{ fontSize: '0.82rem' }}>{formatMeetings(r.meetings)}</span>
    },
    { key: 'room', header: 'Room', render: (r) => <span className="mono">{r.room}</span> },
    { key: 'credits', header: 'Credits', render: (r) => <span className="tabular">{r.credits}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) =>
        r.status === 'waitlisted' && r.waitlist_position ? (
          <StatusBadge
            status="waitlisted"
            label={`Waitlisted #${r.waitlist_position} of ${r.waitlist_total}`}
          />
        ) : (
          <StatusBadge status={r.status} />
        )
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) =>
        r.status === 'enrolled' || r.status === 'waitlisted' ? (
          <button type="button" className="danger" onClick={() => setDropTarget(r)}>
            Drop
          </button>
        ) : (
          <span className="muted">{r.grade_letter ? `Grade: ${r.grade_letter}` : '—'}</span>
        )
    }
  ];

  return (
    <section aria-labelledby="schedule-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Academic Timetable</div>
          <h1 id="schedule-heading">My Schedule &amp; Registrations</h1>
        </div>
        <div className="stat-card" style={{ minInlineSize: '14rem' }}>
          <div className="stat-label">Credit Load ({standing})</div>
          <div className="stat-value">
            {totalActiveCredits} / {maxTermCredits}
          </div>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={() => setError('')}>Dismiss</button>
        </div>
      ) : null}

      <div className="panel">
        <h2>Weekly Class Timetable (Enrolled)</h2>
        <div className="timetable-grid">
          {slotsByDay.map((col) => (
            <div key={col.dayIdx} className="day-column">
              <h3>{col.dayName}</h3>
              {col.items.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>No classes</p>
              ) : (
                col.items.map((item) => (
                  <div key={item.id} className="slot-card">
                    <div className="mono" style={{ fontWeight: 600 }}>{item.start}–{item.end}</div>
                    <div><strong>{item.code}</strong> · {item.room}</div>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>{item.title}</div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="panel" role="status"><p className="muted" style={{ margin: 0 }}>Loading schedule…</p></div>
      ) : (
        <>
          <div style={{ marginBlockEnd: '1.25rem' }}>
            <ResponsiveTable
              caption={`Current and historical registrations (${activeItems.length} active)`}
              columns={columns}
              rows={enrollments}
              getRowKey={(r) => r.enrollment_id}
              emptyMessage="You have no course registrations yet. Visit the Course Catalogue to enroll."
            />
          </div>

          <ResponsiveTable
            caption="Course attendance summary"
            columns={[
              { key: 'course_code', header: 'Course', render: (r) => <span className="mono">{r.course_code} ({r.term_name})</span> },
              { key: 'course_title', header: 'Title' },
              { key: 'sessions_recorded', header: 'Sessions', render: (r) => <span className="tabular">{r.sessions_recorded}</span> },
              {
                key: 'breakdown',
                header: 'Present / Late / Absent',
                render: (r) => <span className="mono">{r.present_count} / {r.late_count} / {r.absent_count}</span>
              },
              {
                key: 'attendance_pct',
                header: 'Attendance',
                render: (r) => (
                  <StatusBadge
                    status={Number(r.attendance_pct) >= 75 ? 'open' : 'suspended'}
                    label={`${r.attendance_pct}%`}
                  />
                )
              }
            ]}
            rows={attendance.summary}
            getRowKey={(r) => r.offering_id}
            emptyMessage="No attendance sessions recorded yet for your active courses."
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(dropTarget)}
        destructive
        title="Drop Course Registration?"
        message={
          dropTarget
            ? `Are you sure you want to drop ${dropTarget.course_code} (${dropTarget.course_title})? If another student is on the waitlist, the vacated seat will be assigned automatically.`
            : ''
        }
        confirmLabel="Drop Course"
        cancelLabel="Keep Course"
        onConfirm={confirmDrop}
        onCancel={() => setDropTarget(null)}
      />
    </section>
  );
}
