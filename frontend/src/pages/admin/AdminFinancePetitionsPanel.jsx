import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function AdminFinancePetitionsPanel({ terms, students, notify, onRefreshMain }) {
  const [ledgerData, setLedgerData] = useState({ entries: [], balances: [] });
  const [appeals, setAppeals] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [assessForm, setAssessForm] = useState({ termId: '', creditRate: 500, registrationFee: 250 });
  const [entryForm, setEntryForm] = useState({
    studentId: '',
    termId: '',
    entryType: 'payment',
    description: 'Bursar payment settlement',
    amount: 500
  });

  const loadAll = useCallback(async () => {
    try {
      const [lRes, aRes, pRes] = await Promise.all([
        apiRequest('/finance/ledger'),
        apiRequest('/grade-appeals'),
        apiRequest('/override-petitions')
      ]);
      setLedgerData(lRes.data || { entries: [], balances: [] });
      setAppeals(aRes.data || []);
      setPetitions(pRes.data || []);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!assessForm.termId && terms.length > 0) {
      setAssessForm((f) => ({ ...f, termId: String(terms[0].id) }));
    }
    if (!entryForm.studentId && students.length > 0) {
      setEntryForm((f) => ({ ...f, studentId: String(students[0].id) }));
    }
  }, [terms, students, assessForm.termId, entryForm.studentId]);

  const handleAssessTerm = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/finance/assess-term', {
        method: 'POST',
        body: {
          termId: Number(assessForm.termId),
          creditRate: Number(assessForm.creditRate),
          registrationFee: Number(assessForm.registrationFee)
        }
      });
      notify(`Assessed ${res.data.assessedStudents} students (${res.data.entriesCreated} entries including Dean's List waivers).`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handlePostEntry = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/finance/entries', {
        method: 'POST',
        body: {
          studentId: Number(entryForm.studentId),
          termId: entryForm.termId ? Number(entryForm.termId) : null,
          entryType: entryForm.entryType,
          description: entryForm.description,
          amount: Number(entryForm.amount)
        }
      });
      notify(
        `Entry recorded. New balance: ${res.data.netBalance.toFixed(2)}` +
          (res.data.resolvedFinancialHolds > 0 ? ' (financial hold lifted automatically!)' : ''),
        'success'
      );
      await loadAll();
      await onRefreshMain?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleEnforceHolds = async () => {
    try {
      const res = await apiRequest('/finance/enforce-holds', { method: 'POST' });
      notify(`Placed ${res.data.holdsPlaced} financial hold(s) on overdue accounts.`, 'info');
      await loadAll();
      await onRefreshMain?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDecidePetition = async (id, status) => {
    try {
      await apiRequest(`/override-petitions/${id}/decide`, {
        method: 'PATCH',
        body: { status, decisionNote: `Registrar decision: ${status}` }
      });
      notify(`Petition ${status}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div className="grid-2">
        <div className="panel">
          <h3>Term Tuition &amp; Merit Scholarship Assessment</h3>
          <form onSubmit={handleAssessTerm} className="filter-bar">
            <div className="field">
              <label htmlFor="fin-term">Term</label>
              <select id="fin-term" value={assessForm.termId} onChange={(e) => setAssessForm((f) => ({ ...f, termId: e.target.value }))}>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="fin-rate">Per-Credit Fee</label><input id="fin-rate" type="number" min="1" value={assessForm.creditRate} onChange={(e) => setAssessForm((f) => ({ ...f, creditRate: e.target.value }))} /></div>
            <div className="field"><label htmlFor="fin-reg">Reg Fee</label><input id="fin-reg" type="number" min="0" value={assessForm.registrationFee} onChange={(e) => setAssessForm((f) => ({ ...f, registrationFee: e.target.value }))} /></div>
            <button type="submit" className="primary">Run Term Billing</button>
          </form>
          <button type="button" className="danger" onClick={handleEnforceHolds}>
            Enforce Financial Holds on Overdue Balances
          </button>
        </div>

        <div className="panel">
          <h3>Record Payment, Waiver, or Charge</h3>
          <form onSubmit={handlePostEntry} className="filter-bar">
            <div className="field">
              <label htmlFor="ent-stu">Student</label>
              <select id="ent-stu" value={entryForm.studentId} onChange={(e) => setEntryForm((f) => ({ ...f, studentId: e.target.value }))}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.student_number} — {s.first_name} {s.last_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ent-type">Entry Type</label>
              <select id="ent-type" value={entryForm.entryType} onChange={(e) => setEntryForm((f) => ({ ...f, entryType: e.target.value }))}>
                <option value="payment">Payment (-)</option>
                <option value="scholarship_waiver">Scholarship Waiver (-)</option>
                <option value="tuition_charge">Tuition Charge (+)</option>
                <option value="fee">Fee (+)</option>
              </select>
            </div>
            <div className="field"><label htmlFor="ent-amt">Amount</label><input id="ent-amt" type="number" min="1" step="0.01" value={entryForm.amount} onChange={(e) => setEntryForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div className="field"><label htmlFor="ent-desc">Description</label><input id="ent-desc" required value={entryForm.description} onChange={(e) => setEntryForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <button type="submit" className="primary">Post Transaction</button>
          </form>
        </div>
      </div>

      <div className="panel">
        <h3>Student Account Balances</h3>
        <ResponsiveTable
          caption="Bursar Student Balances"
          getRowKey={(r) => r.student_id}
          columns={[
            { key: 'stu', header: 'Student', render: (r) => `${r.student_number} — ${r.student_name}` },
            { key: 'charges', header: 'Charges', render: (r) => <span className="mono">{r.total_charges.toFixed(2)}</span> },
            { key: 'waivers', header: 'Waivers', render: (r) => <span className="mono">-{r.total_waivers.toFixed(2)}</span> },
            { key: 'payments', header: 'Payments', render: (r) => <span className="mono">-{r.total_payments.toFixed(2)}</span> },
            { key: 'balance', header: 'Net Balance', render: (r) => <strong className="mono">{r.net_balance.toFixed(2)}</strong> },
            { key: 'hold', header: 'Financial Hold', render: (r) => r.has_financial_hold ? <StatusBadge status="suspended" label="Hold Active" /> : 'Clear' }
          ]}
          rows={ledgerData.balances || []}
        />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Override Petitions Queue</h3>
          <ResponsiveTable
            caption="All Override Petitions"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'stu', header: 'Student', render: (r) => `${r.student_name} (${r.course_code})` },
              { key: 'type', header: 'Type', render: (r) => r.petition_type.replace('_', ' ') },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'act',
                header: 'Decide',
                render: (r) =>
                  r.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" className="primary" onClick={() => handleDecidePetition(r.id, 'approved')}>Approve</button>
                      <button type="button" className="danger" onClick={() => handleDecidePetition(r.id, 'rejected')}>Reject</button>
                    </div>
                  ) : (r.decision_note || '—')
              }
            ]}
            rows={petitions}
          />
        </div>

        <div className="panel">
          <h3>Grade Appeals Oversight</h3>
          <ResponsiveTable
            caption="Grade Appeals Log"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'stu', header: 'Student', render: (r) => `${r.student_name} (${r.course_code})` },
              { key: 'grade', header: 'Grade', render: (r) => `${r.original_grade}${r.revised_grade ? ` → ${r.revised_grade}` : ''}` },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }
            ]}
            rows={appeals}
          />
        </div>
      </div>
    </div>
  );
}
