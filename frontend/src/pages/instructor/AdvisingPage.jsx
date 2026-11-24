import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REVISED_GRADES = ['', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];

export function AdvisingPage({ user, notify }) {
  const isChair = Boolean(user?.profile?.is_chair);
  const [tab, setTab] = useState('advisees');
  const [advisees, setAdvisees] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [officeHours, setOfficeHours] = useState({ slots: [], bookings: [] });
  const [appeals, setAppeals] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [alertForm, setAlertForm] = useState({ studentId: '', flagType: 'academic_risk', note: '' });
  const [slotForm, setSlotForm] = useState({ dayOfWeek: 2, startTime: '13:00', endTime: '14:30', location: 'Faculty Wing B-210' });
  const [appealDecision, setAppealDecision] = useState({});
  const [petitionDecision, setPetitionDecision] = useState({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = [
        apiRequest('/advising/advisees'),
        apiRequest('/early-alerts'),
        apiRequest('/office-hours')
      ];
      if (isChair) {
        reqs.push(apiRequest('/grade-appeals'), apiRequest('/override-petitions'));
      }
      const results = await Promise.all(reqs);
      const adv = results[0].data || [];
      setAdvisees(adv);
      if (adv.length > 0) {
        setAlertForm((f) => (f.studentId ? f : { ...f, studentId: String(adv[0].id) }));
      }
      setAlerts(results[1].data || []);
      setOfficeHours(results[2].data || { slots: [], bookings: [] });
      if (isChair) {
        setAppeals(results[3].data || []);
        setPetitions(results[4].data || []);
      }
    } catch (err) {
      notify(err.message || 'Could not load advising workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [isChair, notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/early-alerts', {
        method: 'POST',
        body: {
          studentId: Number(alertForm.studentId),
          flagType: alertForm.flagType,
          note: alertForm.note
        }
      });
      setAlertForm((f) => ({ ...f, note: '' }));
      notify('Early alert sent to student & advisor.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await apiRequest(`/early-alerts/${id}/status`, { method: 'PATCH', body: { status: 'resolved' } });
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/office-hours/slots', {
        method: 'POST',
        body: {
          dayOfWeek: Number(slotForm.dayOfWeek),
          startTime: slotForm.startTime,
          endTime: slotForm.endTime,
          location: slotForm.location
        }
      });
      notify('Office hour slot published.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDecideAppeal = async (id, status) => {
    const draft = appealDecision[id] || { revisedGrade: '', decisionNote: 'Reviewed by Department Chair' };
    try {
      await apiRequest(`/grade-appeals/${id}/decide`, {
        method: 'PATCH',
        body: {
          status,
          revisedGrade: status === 'approved' && draft.revisedGrade ? draft.revisedGrade : undefined,
          decisionNote: draft.decisionNote || 'Reviewed by Department Chair'
        }
      });
      notify(`Grade appeal ${status}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDecidePetition = async (id, status) => {
    const note = petitionDecision[id] || (status === 'approved' ? 'Approved by Department Chair' : 'Denied by Department Chair');
    try {
      await apiRequest(`/override-petitions/${id}/decide`, {
        method: 'PATCH',
        body: { status, decisionNote: note }
      });
      notify(`Override petition ${status}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <section aria-labelledby="advising-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Faculty Advising &amp; Governance</div>
          <h1 id="advising-heading">Academic Advising, Office Hours{isChair ? ' & Chair Review' : ''}</h1>
        </div>
      </div>

      <div className="tablist" role="tablist" aria-label="Advising workspace">
        <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'advisees'} onClick={() => setTab('advisees')}>
          Advisees &amp; Early Alerts
        </button>
        <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'hours'} onClick={() => setTab('hours')}>
          Office Hours &amp; Bookings
        </button>
        {isChair ? (
          <button type="button" role="tab" className="tab-btn" aria-selected={tab === 'chair'} onClick={() => setTab('chair')}>
            Chair Approvals ({appeals.filter((a) => a.status === 'pending').length + petitions.filter((p) => p.status === 'pending').length})
          </button>
        ) : null}
      </div>

      {loading ? <p className="muted" role="status">Loading advising records…</p> : null}

      {!loading && tab === 'advisees' ? (
        <div role="tabpanel" aria-label="Advisees and Early Alerts">
          <div className="panel">
            <h2>Assigned Academic Advisees</h2>
            <ResponsiveTable
              caption="Advisee Cohort"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'student_number', header: 'ID', render: (r) => <span className="mono">{r.student_number}</span> },
                { key: 'name', header: 'Student', render: (r) => `${r.first_name} ${r.last_name} (${r.department_code})` },
                { key: 'gpa', header: 'GPA', render: (r) => <span className="mono tabular">{r.gpa !== null ? Number(r.gpa).toFixed(2) : 'N/A'}</span> },
                { key: 'credits', header: 'Earned Cr', render: (r) => <span className="tabular">{r.credits_earned}</span> },
                { key: 'holds', header: 'Holds / Alerts', render: (r) => `${r.active_holds} holds · ${r.open_alerts} alerts` }
              ]}
              rows={advisees}
            />
          </div>

          <div className="grid-2">
            <div className="panel">
              <h2>Issue Early Alert / Commendation</h2>
              <form onSubmit={handleCreateAlert}>
                <div className="field">
                  <label htmlFor="ea-student">Student</label>
                  <select
                    id="ea-student"
                    value={alertForm.studentId}
                    onChange={(e) => setAlertForm((f) => ({ ...f, studentId: e.target.value }))}
                    required
                  >
                    {advisees.map((a) => (
                      <option key={a.id} value={a.id}>{a.student_number} — {a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ea-type">Alert Category</label>
                  <select
                    id="ea-type"
                    value={alertForm.flagType}
                    onChange={(e) => setAlertForm((f) => ({ ...f, flagType: e.target.value }))}
                  >
                    <option value="academic_risk">Academic Risk</option>
                    <option value="attendance">Attendance Concern</option>
                    <option value="missing_work">Missing Assignments</option>
                    <option value="commendation">Dean/Faculty Commendation</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ea-note">Guidance Note</label>
                  <textarea
                    id="ea-note"
                    rows={3}
                    required
                    minLength={3}
                    value={alertForm.note}
                    onChange={(e) => setAlertForm((f) => ({ ...f, note: e.target.value }))}
                  />
                </div>
                <button type="submit" className="primary">Send Early Alert</button>
              </form>
            </div>

            <div className="panel">
              <h2>Early Alerts Log</h2>
              <ResponsiveTable
                caption="Issued & Advisee Alerts"
                getRowKey={(r) => r.id}
                columns={[
                  { key: 'student', header: 'Student', render: (r) => r.student_name },
                  { key: 'flag', header: 'Type', render: (r) => <StatusBadge status={r.flag_type} /> },
                  { key: 'note', header: 'Note', render: (r) => r.note },
                  {
                    key: 'action',
                    header: 'Status',
                    render: (r) =>
                      r.status !== 'resolved' ? (
                        <button type="button" onClick={() => handleResolveAlert(r.id)}>Resolve</button>
                      ) : <StatusBadge status="resolved" />
                  }
                ]}
                rows={alerts}
              />
            </div>
          </div>
        </div>
      ) : null}

      {!loading && tab === 'hours' ? (
        <div role="tabpanel" aria-label="Office Hours Management" className="grid-2">
          <div className="panel">
            <h2>Publish Weekly Office Hour Slot</h2>
            <form onSubmit={handleCreateSlot}>
              <div className="field">
                <label htmlFor="slot-dow">Day of Week</label>
                <select
                  id="slot-dow"
                  value={slotForm.dayOfWeek}
                  onChange={(e) => setSlotForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                >
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="slot-start">Start Time</label>
                  <input id="slot-start" type="time" value={slotForm.startTime} onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))} required />
                </div>
                <div className="field">
                  <label htmlFor="slot-end">End Time</label>
                  <input id="slot-end" type="time" value={slotForm.endTime} onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))} required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="slot-loc">Office / Room</label>
                <input id="slot-loc" value={slotForm.location} onChange={(e) => setSlotForm((f) => ({ ...f, location: e.target.value }))} required />
              </div>
              <button type="submit" className="primary">Add Office Hour Slot</button>
            </form>
          </div>

          <div className="panel">
            <h2>Upcoming Student Bookings</h2>
            <ResponsiveTable
              caption="Student Office Hour Bookings"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'date', header: 'Date', render: (r) => <span className="mono">{String(r.booking_date).slice(0, 10)} ({r.start_time})</span> },
                { key: 'student', header: 'Student', render: (r) => `${r.student_name} (${r.student_number})` },
                { key: 'topic', header: 'Topic', render: (r) => r.topic },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
              ]}
              rows={officeHours.bookings}
            />
          </div>
        </div>
      ) : null}

      {!loading && tab === 'chair' && isChair ? (
        <div role="tabpanel" aria-label="Department Chair Approvals" className="grid-2">
          <div className="panel">
            <h2>Department Grade Appeals</h2>
            {appeals.length === 0 ? (
              <p className="muted">No grade appeals in your department.</p>
            ) : (
              appeals.map((ap) => {
                const draft = appealDecision[ap.id] || { revisedGrade: '', decisionNote: '' };
                return (
                  <div key={ap.id} className="compact-list-item" style={{ display: 'block', marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{ap.student_name} · {ap.course_code} ({ap.original_grade})</strong>
                      <StatusBadge status={ap.status} />
                    </div>
                    <p style={{ margin: '0.3rem 0', fontSize: '0.85rem' }}>{ap.requested_reason}</p>
                    {ap.status === 'pending' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                        <select
                          aria-label="Revised grade"
                          style={{ inlineSize: '5.5rem' }}
                          value={draft.revisedGrade}
                          onChange={(e) => setAppealDecision((p) => ({ ...p, [ap.id]: { ...draft, revisedGrade: e.target.value } }))}
                        >
                          {REVISED_GRADES.map((g) => <option key={g || 'keep'} value={g}>{g || 'No change'}</option>)}
                        </select>
                        <input
                          type="text"
                          placeholder="Chair decision rationale"
                          style={{ flex: 1, minInlineSize: '10rem' }}
                          value={draft.decisionNote}
                          onChange={(e) => setAppealDecision((p) => ({ ...p, [ap.id]: { ...draft, decisionNote: e.target.value } }))}
                        />
                        <button type="button" className="primary" onClick={() => handleDecideAppeal(ap.id, 'approved')}>Approve</button>
                        <button type="button" className="danger" onClick={() => handleDecideAppeal(ap.id, 'rejected')}>Reject</button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="panel">
            <h2>Department Override Petitions</h2>
            {petitions.length === 0 ? (
              <p className="muted">No override petitions in your department.</p>
            ) : (
              petitions.map((pt) => (
                <div key={pt.id} className="compact-list-item" style={{ display: 'block', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{pt.student_name} · {pt.course_code} ({pt.petition_type.replace('_', ' ')})</strong>
                    <StatusBadge status={pt.status} />
                  </div>
                  <p style={{ margin: '0.3rem 0', fontSize: '0.85rem' }}>{pt.reason}</p>
                  {pt.status === 'pending' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Decision note"
                        style={{ flex: 1, minInlineSize: '10rem' }}
                        value={petitionDecision[pt.id] || ''}
                        onChange={(e) => setPetitionDecision((p) => ({ ...p, [pt.id]: e.target.value }))}
                      />
                      <button type="button" className="primary" onClick={() => handleDecidePetition(pt.id, 'approved')}>Approve</button>
                      <button type="button" className="danger" onClick={() => handleDecidePetition(pt.id, 'rejected')}>Reject</button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
