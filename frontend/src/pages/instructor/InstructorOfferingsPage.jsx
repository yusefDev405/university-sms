import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ModalDialog } from '../../components/ModalDialog.jsx';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { DAY_NAMES, formatMeetings } from '../../utils/schedule.js';

const GRADE_LETTERS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'];

export function InstructorOfferingsPage({ notify }) {
  const [offerings, setOfferings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [subTab, setSubTab] = useState('roster'); // 'roster' | 'attendance'
  const [roster, setRoster] = useState([]);
  const [distInfo, setDistInfo] = useState({ distribution: [], gradedCount: 0, averagePoints: null });
  const [draftGrades, setDraftGrades] = useState({});
  const [attendanceData, setAttendanceData] = useState({ sessions: [], summary: [] });
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionTopic, setSessionTopic] = useState('');
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [inspectedStudent, setInspectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [error, setError] = useState('');

  const loadOfferingDetails = useCallback(async (offeringId) => {
    setRosterLoading(true);
    setError('');
    try {
      const [rosterRes, distRes, attRes] = await Promise.all([
        apiRequest(`/offerings/${offeringId}/roster`),
        apiRequest(`/offerings/${offeringId}/grade-distribution`),
        apiRequest(`/offerings/${offeringId}/attendance`)
      ]);
      const rows = rosterRes.data.roster || [];
      setRoster(rows);
      setDistInfo({
        distribution: distRes.data.distribution || [],
        gradedCount: distRes.data.gradedCount || 0,
        averagePoints: distRes.data.averagePoints ?? null
      });
      setAttendanceData({
        sessions: attRes.data.sessions || [],
        summary: attRes.data.summary || []
      });

      const drafts = {};
      const attDrafts = {};
      for (const r of rows) {
        drafts[r.enrollment_id] = r.grade_letter || '';
        if (r.status === 'enrolled' || r.status === 'completed') {
          attDrafts[r.student_id] = 'present';
        }
      }
      setDraftGrades(drafts);
      setAttendanceDraft(attDrafts);
    } catch (err) {
      setError(err.message || 'Could not load offering roster');
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest('/offerings?mine=true&limit=50');
        if (!active) return;
        const list = res.data || [];
        setOfferings(list);
        if (list.length > 0) {
          const firstId = list[0].offering_id;
          setSelectedId(firstId);
          await loadOfferingDetails(firstId);
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load your offerings');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadOfferingDetails]);

  const handleSingleSave = async (enrollmentId) => {
    const gradeLetter = draftGrades[enrollmentId];
    if (!gradeLetter) {
      notify('Select a grade letter before saving.', 'error');
      return;
    }
    try {
      await apiRequest(`/enrollments/${enrollmentId}/grade`, {
        method: 'PUT',
        body: { gradeLetter }
      });
      notify('Grade recorded and audited.', 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      setError(err.message);
      notify(err.message, 'error');
    }
  };

  const handleBulkSave = async () => {
    const gradable = roster
      .filter((r) => (r.status === 'enrolled' || r.status === 'completed') && draftGrades[r.enrollment_id])
      .map((r) => ({
        enrollmentId: r.enrollment_id,
        gradeLetter: draftGrades[r.enrollment_id]
      }));

    if (gradable.length === 0) {
      notify('Select at least one grade to submit.', 'error');
      return;
    }

    setSavingBulk(true);
    setError('');
    try {
      await apiRequest(`/offerings/${selectedId}/grades/bulk`, {
        method: 'POST',
        body: { grades: gradable }
      });
      notify(`Saved ${gradable.length} grades in a single transaction.`, 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      setError(err.message);
      notify(err.message, 'error');
    } finally {
      setSavingBulk(false);
    }
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    const gradable = roster.filter((r) => r.status === 'enrolled' || r.status === 'completed');
    if (gradable.length === 0) {
      notify('No enrolled students to record attendance for.', 'error');
      return;
    }
    setSavingAttendance(true);
    setError('');
    try {
      await apiRequest(`/offerings/${selectedId}/attendance`, {
        method: 'POST',
        body: {
          sessionDate,
          topic: sessionTopic,
          records: gradable.map((r) => ({
            studentId: r.student_id,
            status: attendanceDraft[r.student_id] || 'present'
          }))
        }
      });
      setSessionTopic('');
      notify(`Saved attendance for ${sessionDate}.`, 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      setError(err.message);
      notify(err.message, 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleInspectStudent = async (studentId) => {
    try {
      const res = await apiRequest(`/students/${studentId}`);
      setInspectedStudent(res.data);
    } catch (err) {
      notify(err.message || 'Could not load student profile', 'error');
    }
  };

  const handleExportCsv = () => {
    if (!selectedOffering || roster.length === 0) return;
    const header = 'student_number,first_name,last_name,email,department,status,grade_letter,grade_points\n';
    const body = roster
      .map((r) =>
        [
          r.student_number,
          r.first_name,
          r.last_name,
          r.email,
          r.department_code,
          r.status,
          r.grade_letter || '',
          r.grade_points ?? ''
        ].join(',')
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster_${selectedOffering.course_code}_sec${selectedOffering.section}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const selectedOffering = offerings.find((o) => o.offering_id === selectedId);
  const maxDistCount = Math.max(1, ...distInfo.distribution.map((d) => Number(d.count || 0)));
  const activeStudents = roster.filter((r) => r.status === 'enrolled' || r.status === 'completed');

  const rosterColumns = [
    { key: 'student_number', header: 'Student ID', render: (r) => <span className="mono">{r.student_number}</span> },
    {
      key: 'name',
      header: 'Student',
      render: (r) => (
        <div>
          <button
            type="button"
            className="ghost"
            style={{ padding: 0, minBlockSize: 'auto', textDecoration: 'underline' }}
            onClick={() => handleInspectStudent(r.student_id)}
          >
            {r.first_name} {r.last_name}
          </button>
          <div className="muted" style={{ fontSize: '0.8rem' }}>{r.email} · {r.department_code}</div>
        </div>
      )
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'grade',
      header: 'Grade Entry',
      render: (r) =>
        r.status === 'waitlisted' ? (
          <span className="muted">Waitlisted</span>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <select
              aria-label={`Grade for ${r.first_name} ${r.last_name}`}
              value={draftGrades[r.enrollment_id] || ''}
              onChange={(e) =>
                setDraftGrades((prev) => ({ ...prev, [r.enrollment_id]: e.target.value }))
              }
              style={{ minInlineSize: '5.5rem', inlineSize: 'auto' }}
            >
              <option value="">—</option>
              {GRADE_LETTERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <button type="button" onClick={() => handleSingleSave(r.enrollment_id)}>
              Save
            </button>
          </div>
        )
    }
  ];

  return (
    <section aria-labelledby="instructor-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Faculty Grading &amp; Attendance</div>
          <h1 id="instructor-heading">My Course Offerings</h1>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={() => setError('')}>Dismiss</button>
        </div>
      ) : null}

      {loading ? (
        <div className="panel" role="status"><p className="muted" style={{ margin: 0 }}>Loading assigned offerings…</p></div>
      ) : (
        <>
          <details className="panel" style={{ paddingBlock: '0.8rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Weekly Teaching Timetable ({offerings.filter((o) => o.is_registration_open).length} active-term sections)
            </summary>
            <div className="timetable-grid" style={{ marginBlockStart: '0.85rem' }}>
              {[0, 1, 2, 3, 4].map((dayIdx) => {
                const slots = [];
                for (const off of offerings) {
                  for (const m of off.meetings || []) {
                    if (Number(m.day_of_week) === dayIdx) {
                      slots.push({
                        id: `${off.offering_id}-${m.start_time}`,
                        code: off.course_code,
                        section: off.section,
                        room: off.room,
                        term: off.term_name,
                        start: m.start_time,
                        end: m.end_time
                      });
                    }
                  }
                }
                slots.sort((a, b) => a.start.localeCompare(b.start));
                return (
                  <div key={dayIdx} className="day-column">
                    <h3>{DAY_NAMES[dayIdx]}</h3>
                    {slots.length === 0 ? (
                      <p className="muted" style={{ fontSize: '0.82rem', margin: 0 }}>No classes</p>
                    ) : (
                      slots.map((s) => (
                        <div key={s.id} className="slot-card">
                          <div className="mono" style={{ fontWeight: 600 }}>{s.start}–{s.end}</div>
                          <div><strong>{s.code}</strong> · Sec {s.section}</div>
                          <div className="muted" style={{ fontSize: '0.78rem' }}>{s.room} · {s.term}</div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </details>

          <div className="grid-2" style={{ gridTemplateColumns: 'minmax(16rem, 1fr) minmax(20rem, 2.3fr)', alignItems: 'start' }}>
          <div className="panel">
            <h2>Assigned Sections</h2>
            {offerings.length === 0 ? (
              <p className="muted">No offerings assigned to your account.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {offerings.map((o) => (
                  <button
                    key={o.offering_id}
                    type="button"
                    className={o.offering_id === selectedId ? 'primary' : ''}
                    style={{ justifyContent: 'space-between', textAlign: 'start', whiteSpace: 'normal' }}
                    onClick={() => {
                      setSelectedId(o.offering_id);
                      loadOfferingDetails(o.offering_id);
                    }}
                  >
                    <span>
                      <strong className="mono">{o.course_code}</strong> · {o.term_name}
                      <br />
                      <small>{o.course_title} (Sec {o.section})</small>
                    </span>
                    <span className="mono">{o.enrolled_count}/{o.capacity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {selectedOffering ? (
              <div className="panel">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBlockEnd: '0.85rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>
                      {selectedOffering.course_code}: {selectedOffering.course_title}
                    </h2>
                    <div className="muted mono" style={{ fontSize: '0.82rem' }}>
                      {selectedOffering.term_name} · Sec {selectedOffering.section} · {selectedOffering.room} · {formatMeetings(selectedOffering.meetings)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" onClick={handleExportCsv} disabled={roster.length === 0}>
                      Export Roster CSV
                    </button>
                    {subTab === 'roster' ? (
                      <button type="button" className="primary" disabled={savingBulk} onClick={handleBulkSave}>
                        {savingBulk ? 'Submitting…' : 'Submit All Grades'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div role="tablist" aria-label="Offering workspace" className="tablist">
                  <button
                    type="button"
                    role="tab"
                    id="inst-tab-roster"
                    aria-selected={subTab === 'roster'}
                    className="tab-btn"
                    onClick={() => setSubTab('roster')}
                  >
                    Roster &amp; Grades
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="inst-tab-attendance"
                    aria-selected={subTab === 'attendance'}
                    className="tab-btn"
                    onClick={() => setSubTab('attendance')}
                  >
                    Attendance Register ({attendanceData.sessions.length})
                  </button>
                </div>

                {rosterLoading ? (
                  <p className="muted">Loading offering data…</p>
                ) : subTab === 'roster' ? (
                  <>
                    {distInfo.distribution.length > 0 ? (
                      <div style={{ marginBlockEnd: '1rem' }}>
                        <p className="muted" style={{ fontSize: '0.84rem', marginBlockEnd: '0.45rem' }}>
                          Grade distribution ({distInfo.gradedCount} graded · Avg points:{' '}
                          <strong className="mono">{distInfo.averagePoints ?? '—'}</strong>)
                        </p>
                        <div className="dist-chart">
                          {distInfo.distribution.map((d) => (
                            <div key={d.grade_letter} className="dist-row">
                              <span className="mono">{d.grade_letter}</span>
                              <div className="dist-track">
                                <div
                                  className="dist-fill"
                                  style={{ inlineSize: `${Math.round((Number(d.count) / maxDistCount) * 100)}%` }}
                                />
                              </div>
                              <span className="mono tabular">{d.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <ResponsiveTable
                      caption={`Class roster for ${selectedOffering.course_code} (${roster.length} students)`}
                      columns={rosterColumns}
                      rows={roster}
                      getRowKey={(r) => r.enrollment_id}
                      emptyMessage="No students are currently registered in this offering."
                    />
                  </>
                ) : (
                  <div>
                    <form onSubmit={handleSaveAttendance} style={{ marginBlockEnd: '1.25rem' }}>
                      <div className="grid-2">
                        <div className="field">
                          <label htmlFor="att-date">Session Date</label>
                          <input
                            id="att-date"
                            type="date"
                            required
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="att-topic">Lecture / Lab Topic</label>
                          <input
                            id="att-topic"
                            placeholder="e.g. Trees, Heaps & Priority Queues"
                            value={sessionTopic}
                            onChange={(e) => setSessionTopic(e.target.value)}
                          />
                        </div>
                      </div>

                      <ResponsiveTable
                        caption="Mark attendance for enrolled students"
                        columns={[
                          { key: 'student_number', header: 'ID', render: (r) => <span className="mono">{r.student_number}</span> },
                          { key: 'name', header: 'Student', render: (r) => `${r.first_name} ${r.last_name}` },
                          {
                            key: 'mark',
                            header: 'Attendance Status',
                            render: (r) => (
                              <select
                                aria-label={`Attendance for ${r.first_name} ${r.last_name}`}
                                value={attendanceDraft[r.student_id] || 'present'}
                                onChange={(e) =>
                                  setAttendanceDraft((prev) => ({ ...prev, [r.student_id]: e.target.value }))
                                }
                                style={{ inlineSize: 'auto', minInlineSize: '7.5rem' }}
                              >
                                {ATTENDANCE_STATUSES.map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                            )
                          }
                        ]}
                        rows={activeStudents}
                        getRowKey={(r) => r.student_id}
                        emptyMessage="No active enrolled students in this section."
                      />

                      <div style={{ marginBlockStart: '0.85rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="primary" disabled={savingAttendance || activeStudents.length === 0}>
                          {savingAttendance ? 'Saving…' : 'Save Attendance Session'}
                        </button>
                      </div>
                    </form>

                    <ResponsiveTable
                      caption="Cumulative student attendance summary"
                      columns={[
                        { key: 'student_number', header: 'ID', render: (r) => <span className="mono">{r.student_number}</span> },
                        { key: 'name', header: 'Student', render: (r) => `${r.first_name} ${r.last_name}` },
                        { key: 'sessions_recorded', header: 'Sessions', render: (r) => <span className="tabular">{r.sessions_recorded}</span> },
                        {
                          key: 'counts',
                          header: 'P / L / A / E',
                          render: (r) => <span className="mono">{r.present_count} / {r.late_count} / {r.absent_count} / {r.excused_count}</span>
                        },
                        {
                          key: 'pct',
                          header: 'Rate',
                          render: (r) => (
                            <StatusBadge
                              status={Number(r.attendance_pct) >= 75 ? 'open' : 'suspended'}
                              label={`${r.attendance_pct}%`}
                            />
                          )
                        }
                      ]}
                      rows={attendanceData.summary}
                      getRowKey={(r) => r.student_id}
                      emptyMessage="No attendance records yet."
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
        </>
      )}

      <ModalDialog
        open={Boolean(inspectedStudent)}
        title="Roster Student Profile"
        onClose={() => setInspectedStudent(null)}
      >
        {inspectedStudent ? (
          <div>
            <p className="mono" style={{ marginBlockEnd: '0.35rem' }}>
              ID: {inspectedStudent.student_number} · Status: {inspectedStudent.status}
            </p>
            <p>
              <strong>{inspectedStudent.first_name} {inspectedStudent.last_name}</strong> ({inspectedStudent.email})
            </p>
            <p className="muted">
              Department: {inspectedStudent.department_code} — {inspectedStudent.department_name}
              <br />
              Cumulative GPA: <strong className="mono">{inspectedStudent.gpa ?? 'N/A'}</strong> · Credits Earned:{' '}
              <strong className="mono">{inspectedStudent.credits_earned}</strong>
            </p>
            <div className="dialog-actions">
              <button type="button" className="primary" onClick={() => setInspectedStudent(null)}>Close</button>
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </section>
  );
}
