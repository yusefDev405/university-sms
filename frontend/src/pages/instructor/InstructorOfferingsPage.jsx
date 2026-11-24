import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ModalDialog } from '../../components/ModalDialog.jsx';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { DAY_NAMES, formatMeetings } from '../../utils/schedule.js';

const GRADE_LETTERS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'I', 'P', 'NP'];
const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'];

export function InstructorOfferingsPage({ notify }) {
  const [offerings, setOfferings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [subTab, setSubTab] = useState('roster'); // 'roster' | 'gradebook' | 'attendance' | 'announcements'
  const [roster, setRoster] = useState([]);
  const [distInfo, setDistInfo] = useState({ distribution: [], gradedCount: 0, averagePoints: null });
  const [draftGrades, setDraftGrades] = useState({});
  const [gradebook, setGradebook] = useState(null);
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [assessForm, setAssessForm] = useState({ title: '', category: 'quiz', weightPct: 10, maxScore: 100, dueDate: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [evalSummary, setEvalSummary] = useState(null);
  const [annForm, setAnnForm] = useState({ title: '', body: '' });
  const [syllabusDraft, setSyllabusDraft] = useState('');
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
      const [rosterRes, distRes, attRes, gbRes, annRes, evRes] = await Promise.all([
        apiRequest(`/offerings/${offeringId}/roster`),
        apiRequest(`/offerings/${offeringId}/grade-distribution`),
        apiRequest(`/offerings/${offeringId}/attendance`),
        apiRequest(`/offerings/${offeringId}/gradebook`),
        apiRequest(`/offerings/${offeringId}/announcements`),
        apiRequest(`/offerings/${offeringId}/evaluations/summary`)
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
      setGradebook(gbRes.data || null);
      setSyllabusDraft(gbRes.data?.offering?.syllabus_summary || '');
      setAnnouncements(annRes.data || []);
      setEvalSummary(evRes.data || null);

      const sDrafts = {};
      for (const st of gbRes.data?.students || []) {
        sDrafts[st.student_id] = {};
        for (const a of gbRes.data?.assessments || []) {
          const val = st.scores?.[a.id]?.score;
          sDrafts[st.student_id][a.id] = val !== null && val !== undefined ? String(val) : '';
        }
      }
      setScoreDrafts(sDrafts);

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

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/offerings/${selectedId}/assessments`, {
        method: 'POST',
        body: {
          title: assessForm.title,
          category: assessForm.category,
          weightPct: Number(assessForm.weightPct),
          maxScore: Number(assessForm.maxScore),
          dueDate: assessForm.dueDate || null
        }
      });
      setAssessForm({ title: '', category: 'quiz', weightPct: 10, maxScore: 100, dueDate: '' });
      notify('Assessment added to weighted gradebook.', 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDeleteAssessment = async (assessmentId) => {
    try {
      await apiRequest(`/assessments/${assessmentId}`, { method: 'DELETE' });
      notify('Assessment removed.', 'info');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveAssessmentScores = async (assessmentId) => {
    const scores = (gradebook?.students || [])
      .map((st) => {
        const raw = scoreDrafts[st.student_id]?.[assessmentId];
        if (raw === '' || raw === undefined) return null;
        return { studentId: st.student_id, score: Number(raw) };
      })
      .filter(Boolean);
    if (scores.length === 0) {
      notify('Enter at least one score first.', 'error');
      return;
    }
    try {
      await apiRequest(`/assessments/${assessmentId}/scores`, { method: 'PUT', body: { scores } });
      notify('Assessment scores saved.', 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleComputeFinalGrades = async () => {
    try {
      const res = await apiRequest(`/offerings/${selectedId}/grades/compute-from-gradebook`, { method: 'POST' });
      notify(`Posted ${res.data.updatedCount} weighted final grade(s).`, 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/offerings/${selectedId}/announcements`, { method: 'POST', body: annForm });
      setAnnForm({ title: '', body: '' });
      notify('Announcement posted and enrolled students notified.', 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveSyllabus = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/offerings/${selectedId}/syllabus`, {
        method: 'PATCH',
        body: { syllabusSummary: syllabusDraft }
      });
      notify('Offering syllabus summary updated.', 'success');
      await loadOfferingDetails(selectedId);
    } catch (err) {
      notify(err.message, 'error');
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
                    id="inst-tab-gradebook"
                    aria-selected={subTab === 'gradebook'}
                    className="tab-btn"
                    onClick={() => setSubTab('gradebook')}
                  >
                    Weighted Gradebook ({gradebook?.assessments?.length || 0})
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
                  <button
                    type="button"
                    role="tab"
                    id="inst-tab-announcements"
                    aria-selected={subTab === 'announcements'}
                    className="tab-btn"
                    onClick={() => setSubTab('announcements')}
                  >
                    Syllabus &amp; Announcements
                  </button>
                </div>

                {rosterLoading ? (
                  <p className="muted">Loading offering data…</p>
                ) : subTab === 'gradebook' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <strong>Total Configured Weight: {gradebook?.totalWeightPct || 0}% / 100%</strong>
                        <div className="weight-meter" style={{ inlineSize: '12rem', marginTop: '0.25rem' }}>
                          <div className="weight-meter-fill" style={{ inlineSize: `${Math.min(100, gradebook?.totalWeightPct || 0)}%` }} />
                        </div>
                      </div>
                      <button type="button" className="primary" onClick={handleComputeFinalGrades}>
                        Compute &amp; Post Final Grades
                      </button>
                    </div>

                    <form onSubmit={handleCreateAssessment} className="filter-bar">
                      <div className="field">
                        <label htmlFor="gb-title">New Assessment Title</label>
                        <input id="gb-title" required value={assessForm.title} onChange={(e) => setAssessForm((f) => ({ ...f, title: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label htmlFor="gb-cat">Category</label>
                        <select id="gb-cat" value={assessForm.category} onChange={(e) => setAssessForm((f) => ({ ...f, category: e.target.value }))}>
                          {['assignment', 'quiz', 'midterm', 'project', 'final', 'participation'].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="gb-wt">Weight %</label>
                        <input id="gb-wt" type="number" min="1" max="100" required value={assessForm.weightPct} onChange={(e) => setAssessForm((f) => ({ ...f, weightPct: e.target.value }))} />
                      </div>
                      <div className="field">
                        <label htmlFor="gb-max">Max Score</label>
                        <input id="gb-max" type="number" min="1" max="1000" required value={assessForm.maxScore} onChange={(e) => setAssessForm((f) => ({ ...f, maxScore: e.target.value }))} />
                      </div>
                      <button type="submit">+ Add Assessment</button>
                    </form>

                    {(gradebook?.assessments || []).map((a) => (
                      <div key={a.id} className="compact-list-item" style={{ display: 'block', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong>{a.title}</strong> · <span className="mono">{a.category} · {a.weight_pct}% (max {a.max_score})</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button type="button" className="primary" onClick={() => handleSaveAssessmentScores(a.id)}>Save Scores</button>
                            <button type="button" className="danger" onClick={() => handleDeleteAssessment(a.id)}>Delete</button>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          {(gradebook?.students || []).map((st) => (
                            <div key={st.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <span><span className="mono">{st.student_number}</span> {st.first_name} {st.last_name} {st.weightedPct !== null ? <small className="muted">({st.weightedPct}% · {st.projectedLetter})</small> : null}</span>
                              <input
                                type="number"
                                min="0"
                                max={a.max_score}
                                step="0.5"
                                aria-label={`${a.title} score for ${st.first_name}`}
                                style={{ inlineSize: '6.5rem' }}
                                value={scoreDrafts[st.student_id]?.[a.id] ?? ''}
                                onChange={(e) => setScoreDrafts((prev) => ({
                                  ...prev,
                                  [st.student_id]: { ...(prev[st.student_id] || {}), [a.id]: e.target.value }
                                }))}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : subTab === 'announcements' ? (
                  <div className="grid-2">
                    <div>
                      <h3>Syllabus Summary</h3>
                      <form onSubmit={handleSaveSyllabus}>
                        <div className="field">
                          <label htmlFor="off-syllabus">Course Overview &amp; Objectives</label>
                          <textarea id="off-syllabus" rows={3} required minLength={5} value={syllabusDraft} onChange={(e) => setSyllabusDraft(e.target.value)} />
                        </div>
                        <button type="submit">Update Syllabus</button>
                      </form>

                      <h3 style={{ marginTop: '1.1rem' }}>Post Class Announcement</h3>
                      <form onSubmit={handlePostAnnouncement}>
                        <div className="field">
                          <label htmlFor="ann-title">Title</label>
                          <input id="ann-title" required value={annForm.title} onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="field">
                          <label htmlFor="ann-body">Message (notifies all enrolled students)</label>
                          <textarea id="ann-body" rows={3} required value={annForm.body} onChange={(e) => setAnnForm((f) => ({ ...f, body: e.target.value }))} />
                        </div>
                        <button type="submit" className="primary">Broadcast Announcement</button>
                      </form>
                    </div>

                    <div>
                      <h3>Anonymous Student Evaluations</h3>
                      {evalSummary?.summary ? (
                        <div className="panel" style={{ marginBottom: '0.85rem' }}>
                          <div className="mono" style={{ fontSize: '0.85rem' }}>
                            Responses: {evalSummary.summary.response_count} • Teaching: {evalSummary.summary.avg_teaching ?? '—'}/5 • Content: {evalSummary.summary.avg_content ?? '—'}/5 • Fairness: {evalSummary.summary.avg_fairness ?? '—'}/5
                          </div>
                          {(evalSummary.comments || []).map((c) => (
                            <p key={c.id} className="muted" style={{ fontSize: '0.84rem', margin: '0.35rem 0 0' }}>
                              &ldquo;{c.comment}&rdquo;
                            </p>
                          ))}
                        </div>
                      ) : null}

                      <h3>Recent Announcements</h3>
                      <ul className="compact-list">
                        {announcements.map((a) => (
                          <li key={a.id} className="compact-list-item" style={{ display: 'block' }}>
                            <strong>{a.title}</strong>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem' }}>{a.body}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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
