import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { formatMeetings } from '../../utils/schedule.js';

function hasTimeOverlap(meetingsA = [], meetingsB = []) {
  for (const a of meetingsA) {
    for (const b of meetingsB) {
      if (Number(a.day_of_week) === Number(b.day_of_week) && a.start_time < b.end_time && b.start_time < a.end_time) {
        return true;
      }
    }
  }
  return false;
}

export function CataloguePage({ notify }) {
  const [terms, setTerms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [passedCourseCodes, setPassedCourseCodes] = useState(new Set());
  const [termId, setTermId] = useState('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrollingId, setEnrollingId] = useState(null);

  const loadData = useCallback(async (selectedTermId, selectedDept, searchQuery, targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (selectedTermId) qs.set('termId', selectedTermId);
      if (selectedDept) qs.set('department', selectedDept);
      if (searchQuery) qs.set('search', searchQuery);
      qs.set('page', String(targetPage));
      qs.set('limit', '10');

      const [offRes, myRes, transRes] = await Promise.all([
        apiRequest(`/offerings?${qs.toString()}`),
        apiRequest('/me/enrollments'),
        apiRequest('/me/transcript')
      ]);
      setOfferings(offRes.data || []);
      setMeta(offRes.meta || { page: targetPage, limit: 10, total: 0 });
      setMyEnrollments(myRes.data || []);

      const passed = new Set(
        (transRes.data?.courses || [])
          .filter((c) => Number(c.grade_points) >= 1.0)
          .map((c) => c.course_code)
      );
      setPassedCourseCodes(passed);
    } catch (err) {
      setError(err.message || 'Could not load course offerings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [termsRes, deptRes] = await Promise.all([
          apiRequest('/terms'),
          apiRequest('/departments')
        ]);
        if (!active) return;
        const termList = termsRes.data || [];
        setTerms(termList);
        setDepartments(deptRes.data || []);
        const openTerm = termList.find((t) => t.is_registration_open) || termList[0];
        const initialTerm = openTerm ? String(openTerm.id) : '';
        setTermId(initialTerm);
        await loadData(initialTerm, '', '', 1);
      } catch (err) {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData(termId, department, search, 1);
  };

  const handleEnroll = async (offering) => {
    setEnrollingId(offering.offering_id);
    setError('');
    try {
      const res = await apiRequest('/enrollments', {
        method: 'POST',
        body: { offeringId: offering.offering_id }
      });
      const status = res.data.status;
      notify(
        status === 'waitlisted'
          ? `Added to waitlist for ${offering.course_code} (Section ${offering.section}).`
          : `Enrolled in ${offering.course_code} (Section ${offering.section}).`,
        'success'
      );
      await loadData(termId, department, search, page);
    } catch (err) {
      setError(`${offering.course_code}: ${err.message}`);
      notify(err.message, 'error');
    } finally {
      setEnrollingId(null);
    }
  };

  const myStatusByOffering = new Map(
    myEnrollments
      .filter((e) => e.status !== 'dropped')
      .map((e) => [Number(e.offering_id), e.status])
  );

  const getEligibilityHint = (row) => {
    const missing = (row.prerequisites || []).filter((p) => !passedCourseCodes.has(p.code));
    if (missing.length > 0) {
      return { ok: false, text: `Missing prereq: ${missing.map((m) => m.code).join(', ')}` };
    }
    const conflict = myEnrollments.find(
      (e) =>
        e.status === 'enrolled' &&
        Number(e.term_id) === Number(row.term_id) &&
        Number(e.offering_id) !== Number(row.offering_id) &&
        hasTimeOverlap(e.meetings, row.meetings)
    );
    if (conflict) {
      return { ok: false, text: `Time conflict with ${conflict.course_code}` };
    }
    return { ok: true, text: 'Eligible' };
  };

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 10)));

  const columns = [
    {
      key: 'course',
      header: 'Course',
      render: (row) => {
        const elig = getEligibilityHint(row);
        return (
          <div>
            <div className="mono">{row.course_code} · Sec {row.section}</div>
            <div>{row.course_title}</div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>
              {row.credits} cr · {row.department_code}
              {row.prerequisites?.length > 0
                ? ` · Prereqs: ${row.prerequisites.map((p) => p.code).join(', ')}`
                : ''}
            </div>
            {!elig.ok ? (
              <div style={{ marginBlockStart: '0.25rem' }}>
                <StatusBadge status="suspended" label={elig.text} />
              </div>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'instructor',
      header: 'Instructor & Room',
      render: (row) => (
        <div>
          <div>{row.instructor_name}</div>
          <div className="muted mono" style={{ fontSize: '0.8rem' }}>{row.room}</div>
        </div>
      )
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (row) => <span className="mono" style={{ fontSize: '0.82rem' }}>{formatMeetings(row.meetings)}</span>
    },
    {
      key: 'seats',
      header: 'Availability',
      render: (row) => (
        <div className="tabular">
          <div>
            <strong>{row.seats_left}</strong> / {row.capacity} seats left
          </div>
          {row.waitlist_count > 0 ? (
            <div className="muted" style={{ fontSize: '0.8rem' }}>{row.waitlist_count} waitlisted</div>
          ) : null}
        </div>
      )
    },
    {
      key: 'action',
      header: 'Registration',
      render: (row) => {
        const currentStatus = myStatusByOffering.get(Number(row.offering_id));
        if (currentStatus) {
          return <StatusBadge status={currentStatus} />;
        }
        if (!row.is_registration_open) {
          return <StatusBadge status="closed" label="Window Closed" />;
        }
        const isFull = Number(row.seats_left) <= 0;
        return (
          <button
            type="button"
            className={isFull ? '' : 'primary'}
            disabled={enrollingId === row.offering_id}
            onClick={() => handleEnroll(row)}
          >
            {enrollingId === row.offering_id
              ? 'Submitting…'
              : isFull
                ? 'Join Waitlist'
                : 'Enroll'}
          </button>
        );
      }
    }
  ];

  return (
    <section aria-labelledby="catalogue-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Student Registration</div>
          <h1 id="catalogue-heading">Course Catalogue &amp; Offerings</h1>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={() => setError('')}>Dismiss</button>
        </div>
      ) : null}

      <form className="panel filter-bar" onSubmit={handleFilterSubmit}>
        <div className="field">
          <label htmlFor="filter-term">Academic Term</label>
          <select
            id="filter-term"
            value={termId}
            onChange={(e) => {
              setTermId(e.target.value);
              setPage(1);
              loadData(e.target.value, department, search, 1);
            }}
          >
            <option value="">All terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_registration_open ? '(Registration Open)' : '(Closed)'}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-dept">Department</label>
          <select
            id="filter-dept"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
              loadData(termId, e.target.value, search, 1);
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.code}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="filter-search">Search Code / Title</label>
          <input
            id="filter-search"
            type="search"
            placeholder="e.g. CS201 or Database"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div>
          <button type="submit" className="primary">Apply Filters</button>
        </div>
      </form>

      {loading ? (
        <div className="panel" role="status"><p className="muted" style={{ margin: 0 }}>Loading course offerings…</p></div>
      ) : (
        <>
          <ResponsiveTable
            caption="Available course offerings and seat availability"
            columns={columns}
            rows={offerings}
            getRowKey={(r) => r.offering_id}
            emptyMessage="No course offerings match your filters."
          />
          <div className="pagination-bar">
            <span className="muted mono" style={{ fontSize: '0.84rem' }}>
              Page {meta.page} of {totalPages} ({meta.total} offerings)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const next = page - 1;
                  setPage(next);
                  loadData(termId, department, search, next);
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  loadData(termId, department, search, next);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
