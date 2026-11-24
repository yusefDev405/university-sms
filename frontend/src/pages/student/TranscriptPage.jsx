import { useEffect, useMemo, useState } from 'react';
import { apiRequest, downloadPdf } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { GRADE_SCALE, projectWhatIfGpa } from '../../utils/gpa.js';

export function TranscriptPage({ notify }) {
  const [transcript, setTranscript] = useState(null);
  const [degreeAudit, setDegreeAudit] = useState(null);
  const [whatIfRows, setWhatIfRows] = useState([{ id: 1, credits: 3, gradeLetter: 'A' }]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [tRes, auditRes] = await Promise.all([
          apiRequest('/me/transcript'),
          apiRequest('/me/degree-audit')
        ]);
        if (active) {
          setTranscript(tRes.data);
          setDegreeAudit(auditRes.data);
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load transcript');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const projected = useMemo(() => {
    if (!transcript) return { gpa: null, totalCredits: 0 };
    return projectWhatIfGpa(transcript.courses, whatIfRows);
  }, [transcript, whatIfRows]);

  const handleDownloadPdf = async () => {
    if (!transcript) return;
    setDownloading(true);
    try {
      await downloadPdf('/me/transcript/pdf', `transcript_${transcript.student.student_number}.pdf`);
      notify?.('Official PDF transcript downloaded.', 'success');
    } catch (err) {
      notify?.(err.message || 'Could not download PDF', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="panel" role="status"><p className="muted" style={{ margin: 0 }}>Loading official transcript…</p></div>;
  }

  if (error) {
    return <div className="banner banner--error" role="alert"><span>{error}</span></div>;
  }

  const { student, summary, courses } = transcript;
  const standingTone =
    summary.standing === 'Academic Probation'
      ? 'suspended'
      : summary.standing === "Dean's List"
        ? 'open'
        : 'completed';

  const columns = [
    { key: 'course_code', header: 'Code', render: (r) => <span className="mono">{r.course_code}</span> },
    { key: 'course_title', header: 'Course Title' },
    { key: 'term_name', header: 'Term' },
    { key: 'credits', header: 'Credits', render: (r) => <span className="tabular">{r.credits}</span> },
    {
      key: 'grade_letter',
      header: 'Grade',
      render: (r) =>
        r.status === 'withdrawn' || r.grade_points === null ? (
          <StatusBadge status="suspended" label="W (Withdrawn)" />
        ) : (
          <StatusBadge
            status={Number(r.grade_points) >= 1.0 ? 'completed' : 'dropped'}
            label={`${r.grade_letter} (${Number(r.grade_points).toFixed(2)})`}
          />
        )
    }
  ];

  return (
    <section aria-labelledby="transcript-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Official Academic Record</div>
          <h1 id="transcript-heading">
            Transcript — {student.first_name} {student.last_name}
          </h1>
          <p className="muted mono" style={{ margin: '0 0 0.4rem' }}>
            Student ID: {student.student_number} · Dept: {student.department_code} ({student.department_name})
          </p>
          <StatusBadge status={standingTone} label={`${summary.standing} · Max ${summary.maxTermCredits} cr/term`} />
        </div>
        <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" onClick={() => window.print()}>
            Print View
          </button>
          <button type="button" className="primary" disabled={downloading} onClick={handleDownloadPdf}>
            {downloading ? 'Generating PDF…' : 'Download Official PDF'}
          </button>
        </div>
      </div>

      <div className="summary-strip">
        <div className="stat-card">
          <div className="stat-label">Cumulative GPA</div>
          <div className="stat-value">{summary.gpa !== null ? summary.gpa.toFixed(2) : 'N/A'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credits Earned</div>
          <div className="stat-value">{summary.creditsEarned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credits Attempted</div>
          <div className="stat-value">{summary.creditsAttempted}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Department Standing</div>
          <div className="stat-value">
            {summary.departmentRank ? `#${summary.departmentRank} / ${summary.departmentTotal}` : '—'}
          </div>
        </div>
      </div>

      <div style={{ marginBlockEnd: '1.25rem' }}>
        <ResponsiveTable
          caption="Completed coursework and credit-weighted grades"
          columns={columns}
          rows={courses}
          getRowKey={(r) => r.enrollment_id}
          emptyMessage="No completed graded courses on record yet."
        />
      </div>

      <div className="grid-2 no-print">
        {degreeAudit ? (
          <div className="panel">
            <h2>Degree Audit ({student.department_code})</h2>
            <p className="muted" style={{ fontSize: '0.86rem' }}>
              Completed: <strong className="mono">{degreeAudit.completedCredits}</strong> /{' '}
              <strong className="mono">{degreeAudit.totalRequiredCredits}</strong> credits · In progress:{' '}
              <strong className="mono">{degreeAudit.inProgressCredits}</strong> cr
            </p>
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {degreeAudit.courses.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', borderBlockEnd: '1px solid var(--border)', paddingBlockEnd: '0.35rem' }}>
                  <span>
                    <strong className="mono">{c.code}</strong> — {c.title} ({c.credits} cr)
                  </span>
                  <StatusBadge
                    status={c.is_completed ? 'completed' : c.is_in_progress ? 'enrolled' : 'closed'}
                    label={c.is_completed ? 'Completed' : c.is_in_progress ? 'In Progress' : 'Remaining'}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="panel">
          <h2>&ldquo;What-If&rdquo; GPA Simulator</h2>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            Projected Cumulative GPA:{' '}
            <strong className="mono" style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>
              {projected.gpa !== null ? projected.gpa.toFixed(2) : 'N/A'}
            </strong>{' '}
            ({projected.totalCredits} total credits)
          </p>
          <div style={{ display: 'grid', gap: '0.55rem', marginBlockEnd: '0.75rem' }}>
            {whatIfRows.map((row, idx) => (
              <div key={row.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label className="visually-hidden" htmlFor={`wi-cr-${row.id}`}>Course {idx + 1} credits</label>
                <input
                  id={`wi-cr-${row.id}`}
                  type="number"
                  min={1}
                  max={6}
                  style={{ inlineSize: '5rem' }}
                  value={row.credits}
                  onChange={(e) =>
                    setWhatIfRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, credits: Number(e.target.value) } : r))
                    )
                  }
                />
                <span className="muted">cr</span>
                <label className="visually-hidden" htmlFor={`wi-gr-${row.id}`}>Course {idx + 1} expected grade</label>
                <select
                  id={`wi-gr-${row.id}`}
                  style={{ inlineSize: '6.5rem' }}
                  value={row.gradeLetter}
                  onChange={(e) =>
                    setWhatIfRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, gradeLetter: e.target.value } : r))
                    )
                  }
                >
                  {Object.keys(GRADE_SCALE).map((g) => (
                    <option key={g} value={g}>{g} ({GRADE_SCALE[g].toFixed(1)})</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setWhatIfRows((prev) => prev.filter((r) => r.id !== row.id))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setWhatIfRows((prev) => [...prev, { id: Date.now(), credits: 3, gradeLetter: 'A' }])
            }
          >
            + Add Hypothetical Course
          </button>
        </div>
      </div>
    </section>
  );
}
