import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function PetitionsFinancePage({ notify }) {
  const [tab, setTab] = useState('finance');
  const [finance, setFinance] = useState({ entries: [], summary: {} });
  const [appeals, setAppeals] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [transcriptCourses, setTranscriptCourses] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [appealForm, setAppealForm] = useState({ enrollmentId: '', requestedReason: '' });
  const [petitionForm, setPetitionForm] = useState({ offeringId: '', petitionType: 'prerequisite', reason: '' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [finRes, appRes, petRes, alRes, trRes, offRes] = await Promise.all([
        apiRequest('/me/finance'),
        apiRequest('/grade-appeals'),
        apiRequest('/override-petitions'),
        apiRequest('/early-alerts'),
        apiRequest('/me/transcript'),
        apiRequest('/offerings?limit=50')
      ]);
      setFinance(finRes.data || { entries: [], summary: {} });
      setAppeals(appRes.data || []);
      setPetitions(petRes.data || []);
      setAlerts(alRes.data || []);
      const graded = (trRes.data?.courses || []).filter((c) => c.status === 'completed');
      setTranscriptCourses(graded);
      if (graded.length > 0) {
        setAppealForm((f) => (f.enrollmentId ? f : { ...f, enrollmentId: String(graded[0].enrollment_id) }));
      }
      const offs = offRes.data || [];
      setOfferings(offs);
      if (offs.length > 0) {
        setPetitionForm((f) => (f.offeringId ? f : { ...f, offeringId: String(offs[0].offering_id) }));
      }
    } catch (err) {
      notify(err.message || 'Failed to load petitions and finance data', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateAppeal = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/grade-appeals', {
        method: 'POST',
        body: {
          enrollmentId: Number(appealForm.enrollmentId),
          requestedReason: appealForm.requestedReason
        }
      });
      setAppealForm((f) => ({ ...f, requestedReason: '' }));
      notify('Grade appeal submitted to Department Chair.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreatePetition = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/override-petitions', {
        method: 'POST',
        body: {
          offeringId: Number(petitionForm.offeringId),
          petitionType: petitionForm.petitionType,
          reason: petitionForm.reason
        }
      });
      setPetitionForm((f) => ({ ...f, reason: '' }));
      notify('Registration override petition submitted.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const s = finance.summary || {};

  return (
    <section aria-labelledby="pf-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Student Services &amp; Bursar</div>
          <h1 id="pf-heading">Tuition Ledger, Petitions &amp; Advising</h1>
        </div>
      </div>

      <div className="tablist" role="tablist" aria-label="Petitions and Finance sections">
        {[
          { id: 'finance', label: 'Tuition & Scholarships' },
          { id: 'appeals', label: 'Grade Appeals' },
          { id: 'overrides', label: 'Override Petitions' },
          { id: 'alerts', label: `Early Alerts (${alerts.filter((a) => a.status === 'open').length})` }
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

      {loading ? <p className="muted" role="status">Loading student records…</p> : null}

      {!loading && tab === 'finance' ? (
        <div role="tabpanel" aria-label="Tuition and Scholarships">
          <div className="summary-strip">
            <div className="stat-card">
              <div className="stat-label">Total Billed</div>
              <div className="stat-value">{Number(s.total_charges || 0).toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Scholarships / Waivers</div>
              <div className="stat-value">-{Number(s.total_waivers || 0).toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Payments Settled</div>
              <div className="stat-value">-{Number(s.total_payments || 0).toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net Account Balance</div>
              <div className="stat-value">{Number(s.net_balance || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="panel">
            <h2>Append-Only Student Account Ledger</h2>
            <ResponsiveTable
              caption="Financial Transactions"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'date', header: 'Posted', render: (r) => <span className="mono">{String(r.created_at).slice(0, 10)}</span> },
                { key: 'term', header: 'Term', render: (r) => r.term_name || '—' },
                { key: 'type', header: 'Entry Type', render: (r) => <span className="mono">{r.entry_type}</span> },
                { key: 'desc', header: 'Description', render: (r) => r.description },
                { key: 'amount', header: 'Amount', render: (r) => <span className="mono tabular">{Number(r.amount).toFixed(2)}</span> }
              ]}
              rows={finance.entries || []}
            />
          </div>
        </div>
      ) : null}

      {!loading && tab === 'appeals' ? (
        <div role="tabpanel" aria-label="Grade Appeals" className="grid-2">
          <div className="panel">
            <h2>Submit Formal Grade Appeal</h2>
            {transcriptCourses.length === 0 ? (
              <p className="muted">You have no completed graded enrollments eligible for appeal.</p>
            ) : (
              <form onSubmit={handleCreateAppeal}>
                <div className="field">
                  <label htmlFor="appeal-enr">Graded Course</label>
                  <select
                    id="appeal-enr"
                    value={appealForm.enrollmentId}
                    onChange={(e) => setAppealForm((f) => ({ ...f, enrollmentId: e.target.value }))}
                  >
                    {transcriptCourses.map((c) => (
                      <option key={c.enrollment_id} value={c.enrollment_id}>
                        {c.course_code} ({c.term_name}) — Grade: {c.grade_letter}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="appeal-reason">Justification / Re-grading Basis</label>
                  <textarea
                    id="appeal-reason"
                    rows={3}
                    required
                    minLength={5}
                    value={appealForm.requestedReason}
                    onChange={(e) => setAppealForm((f) => ({ ...f, requestedReason: e.target.value }))}
                  />
                </div>
                <button type="submit" className="primary">Submit Grade Appeal</button>
              </form>
            )}
          </div>

          <div className="panel">
            <h2>My Grade Appeals</h2>
            <ResponsiveTable
              caption="Appeal History"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'course', header: 'Course', render: (r) => <span className="mono">{r.course_code} ({r.term_name})</span> },
                { key: 'grades', header: 'Grade', render: (r) => `${r.original_grade}${r.revised_grade ? ` → ${r.revised_grade}` : ''}` },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'note', header: 'Chair Note', render: (r) => r.decision_note || r.requested_reason }
              ]}
              rows={appeals}
            />
          </div>
        </div>
      ) : null}

      {!loading && tab === 'overrides' ? (
        <div role="tabpanel" aria-label="Override Petitions" className="grid-2">
          <div className="panel">
            <h2>Request Registration Override</h2>
            <form onSubmit={handleCreatePetition}>
              <div className="field">
                <label htmlFor="ov-off">Target Course Offering</label>
                <select
                  id="ov-off"
                  value={petitionForm.offeringId}
                  onChange={(e) => setPetitionForm((f) => ({ ...f, offeringId: e.target.value }))}
                >
                  {offerings.map((o) => (
                    <option key={o.offering_id} value={o.offering_id}>
                      {o.course_code} Sec {o.section} ({o.term_name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ov-type">Override Exception Type</label>
                <select
                  id="ov-type"
                  value={petitionForm.petitionType}
                  onChange={(e) => setPetitionForm((f) => ({ ...f, petitionType: e.target.value }))}
                >
                  <option value="prerequisite">Prerequisite / Corequisite Waiver</option>
                  <option value="credit_overload">Credit Overload (+6 credits)</option>
                  <option value="capacity">Closed Section Capacity Override</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="ov-reason">Academic Justification</label>
                <textarea
                  id="ov-reason"
                  rows={3}
                  required
                  minLength={5}
                  value={petitionForm.reason}
                  onChange={(e) => setPetitionForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <button type="submit" className="primary">Submit Petition</button>
            </form>
          </div>

          <div className="panel">
            <h2>My Override Petitions</h2>
            <ResponsiveTable
              caption="Petition Decisions"
              getRowKey={(r) => r.id}
              columns={[
                { key: 'course', header: 'Offering', render: (r) => <span className="mono">{r.course_code} Sec {r.section}</span> },
                { key: 'type', header: 'Exception', render: (r) => r.petition_type.replace('_', ' ') },
                { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'note', header: 'Decision Note', render: (r) => r.decision_note || r.reason }
              ]}
              rows={petitions}
            />
          </div>
        </div>
      ) : null}

      {!loading && tab === 'alerts' ? (
        <div role="tabpanel" aria-label="Advising Early Alerts" className="panel">
          <h2>Faculty Advising Flags &amp; Commendations</h2>
          <ResponsiveTable
            caption="Early Alerts"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'flag', header: 'Flag', render: (r) => <StatusBadge status={r.flag_type} /> },
              { key: 'course', header: 'Course', render: (r) => r.course_code || 'Advising' },
              { key: 'faculty', header: 'Faculty', render: (r) => r.instructor_name },
              { key: 'note', header: 'Guidance Note', render: (r) => r.note },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
            ]}
            rows={alerts}
          />
        </div>
      ) : null}
    </section>
  );
}
