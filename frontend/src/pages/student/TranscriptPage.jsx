import { useEffect, useState } from 'react';
import { apiRequest, downloadPdf } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function TranscriptPage({ notify }) {
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest('/me/transcript');
        if (active) setTranscript(res.data);
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
      render: (r) => (
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

      <ResponsiveTable
        caption="Completed coursework and credit-weighted grades"
        columns={columns}
        rows={courses}
        getRowKey={(r) => r.enrollment_id}
        emptyMessage="No completed graded courses on record yet."
      />
    </section>
  );
}
