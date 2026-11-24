import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function AdminAdmissionsPanel({ departments, students, courses, notify, onRefreshMain }) {
  const [admissions, setAdmissions] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [gradApps, setGradApps] = useState([]);

  const [admForm, setAdmForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '2007-05-10',
    departmentId: '',
    entryScore: 90
  });
  const [tcForm, setTcForm] = useState({
    studentId: '',
    institutionName: '',
    externalCourseCode: '',
    equivalentCourseId: '',
    credits: 3
  });

  const loadAll = useCallback(async () => {
    try {
      const [aRes, tRes, gRes] = await Promise.all([
        apiRequest('/admissions'),
        apiRequest('/transfer-credits'),
        apiRequest('/graduation-applications')
      ]);
      setAdmissions(aRes.data || []);
      setTransfers(tRes.data || []);
      setGradApps(gRes.data || []);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!admForm.departmentId && departments.length > 0) {
      setAdmForm((f) => ({ ...f, departmentId: String(departments[0].id) }));
    }
    if (!tcForm.studentId && students.length > 0) {
      setTcForm((f) => ({ ...f, studentId: String(students[0].id) }));
    }
    if (!tcForm.equivalentCourseId && courses.length > 0) {
      setTcForm((f) => ({ ...f, equivalentCourseId: String(courses[0].id) }));
    }
  }, [departments, students, courses, admForm.departmentId, tcForm.studentId, tcForm.equivalentCourseId]);

  const handleCreateAdmission = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admissions', {
        method: 'POST',
        body: {
          ...admForm,
          departmentId: Number(admForm.departmentId),
          entryScore: Number(admForm.entryScore)
        }
      });
      setAdmForm((f) => ({ ...f, email: '', firstName: '', lastName: '' }));
      notify('Admissions application logged.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleAdmStatus = async (id, status) => {
    try {
      await apiRequest(`/admissions/${id}/status`, { method: 'PATCH', body: { status } });
      notify(`Applicant marked ${status}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleMatriculate = async (id) => {
    try {
      const res = await apiRequest(`/admissions/${id}/matriculate`, { method: 'POST' });
      notify(`Matriculated student #${res.data.student.student_number} (temp pass: ${res.data.temporaryPassword}).`, 'success');
      await loadAll();
      await onRefreshMain?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleAddTransfer = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/transfer-credits', {
        method: 'POST',
        body: {
          studentId: Number(tcForm.studentId),
          institutionName: tcForm.institutionName,
          externalCourseCode: tcForm.externalCourseCode,
          equivalentCourseId: tcForm.equivalentCourseId ? Number(tcForm.equivalentCourseId) : null,
          credits: Number(tcForm.credits)
        }
      });
      setTcForm((f) => ({ ...f, institutionName: '', externalCourseCode: '' }));
      notify('Approved transfer credit recorded.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDecideGrad = async (id, status) => {
    try {
      await apiRequest(`/graduation-applications/${id}/decide`, {
        method: 'PATCH',
        body: { status, decisionNote: `Registrar status: ${status}` }
      });
      notify(`Graduation application ${status}.`, 'success');
      await loadAll();
      await onRefreshMain?.();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div className="panel">
        <h2>Admissions &amp; 1-Click Student Matriculation</h2>
        <form onSubmit={handleCreateAdmission} className="filter-bar">
          <div className="field"><label htmlFor="ad-email">Email</label><input id="ad-email" type="email" required value={admForm.email} onChange={(e) => setAdmForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className="field"><label htmlFor="ad-fn">First Name</label><input id="ad-fn" required value={admForm.firstName} onChange={(e) => setAdmForm((f) => ({ ...f, firstName: e.target.value }))} /></div>
          <div className="field"><label htmlFor="ad-ln">Last Name</label><input id="ad-ln" required value={admForm.lastName} onChange={(e) => setAdmForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
          <div className="field"><label htmlFor="ad-dept">Program</label><select id="ad-dept" value={admForm.departmentId} onChange={(e) => setAdmForm((f) => ({ ...f, departmentId: e.target.value }))}>{departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}</select></div>
          <div className="field"><label htmlFor="ad-sc">Score %</label><input id="ad-sc" type="number" min="0" max="100" step="0.5" value={admForm.entryScore} onChange={(e) => setAdmForm((f) => ({ ...f, entryScore: e.target.value }))} /></div>
          <button type="submit" className="primary">New Application</button>
        </form>
        <ResponsiveTable
          caption="Admissions Pipeline"
          getRowKey={(r) => r.id}
          columns={[
            { key: 'applicant', header: 'Applicant', render: (r) => `${r.first_name} ${r.last_name} (${r.email})` },
            { key: 'dept', header: 'Dept', render: (r) => <span className="mono">{r.department_code}</span> },
            { key: 'score', header: 'Score', render: (r) => <span className="tabular">{r.entry_score}%</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {r.status === 'submitted' || r.status === 'under_review' ? (
                    <>
                      <button type="button" onClick={() => handleAdmStatus(r.id, 'admitted')}>Admit</button>
                      <button type="button" className="danger" onClick={() => handleAdmStatus(r.id, 'rejected')}>Reject</button>
                    </>
                  ) : null}
                  {r.status === 'admitted' ? (
                    <button type="button" className="primary" onClick={() => handleMatriculate(r.id)}>Matriculate Student</button>
                  ) : null}
                  {r.matriculated_student_number ? <span className="mono">#{r.matriculated_student_number}</span> : null}
                </div>
              )
            }
          ]}
          rows={admissions}
        />
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Transfer Credit Equivalencies</h3>
          <form onSubmit={handleAddTransfer} className="filter-bar">
            <div className="field">
              <label htmlFor="tc-stu">Student</label>
              <select id="tc-stu" value={tcForm.studentId} onChange={(e) => setTcForm((f) => ({ ...f, studentId: e.target.value }))}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.student_number} — {s.first_name} {s.last_name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="tc-inst">Origin University</label><input id="tc-inst" required value={tcForm.institutionName} onChange={(e) => setTcForm((f) => ({ ...f, institutionName: e.target.value }))} /></div>
            <div className="field"><label htmlFor="tc-ext">External Code</label><input id="tc-ext" required value={tcForm.externalCourseCode} onChange={(e) => setTcForm((f) => ({ ...f, externalCourseCode: e.target.value }))} /></div>
            <div className="field">
              <label htmlFor="tc-eq">Equivalent Course</label>
              <select id="tc-eq" value={tcForm.equivalentCourseId} onChange={(e) => setTcForm((f) => ({ ...f, equivalentCourseId: e.target.value }))}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <button type="submit" className="primary">Grant Transfer</button>
          </form>
          <ResponsiveTable
            caption="Approved Transfer Credits"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'stu', header: 'Student', render: (r) => `${r.student_number} (${r.student_name})` },
              { key: 'src', header: 'Origin', render: (r) => `${r.institution_name}: ${r.external_course_code}` },
              { key: 'eq', header: 'Equivalent', render: (r) => <span className="mono">{r.equivalent_course_code || 'Elective'}</span> }
            ]}
            rows={transfers}
          />
        </div>

        <div className="panel">
          <h3>Graduation &amp; Degree Conferral</h3>
          <ResponsiveTable
            caption="Graduation Applications"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'stu', header: 'Candidate', render: (r) => `${r.student_name} (${r.student_number})` },
              { key: 'code', header: 'Verify Code', render: (r) => <span className="mono">{r.verification_code}</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'actions',
                header: 'Decide',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {r.status !== 'conferred' ? (
                      <>
                        <button type="button" className="primary" onClick={() => handleDecideGrad(r.id, 'conferred')}>Confer Degree</button>
                        <button type="button" className="danger" onClick={() => handleDecideGrad(r.id, 'denied')}>Deny</button>
                      </>
                    ) : 'Conferred'}
                  </div>
                )
              }
            ]}
            rows={gradApps}
          />
        </div>
      </div>
    </div>
  );
}
