import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function AdminAnalyticsPanel({ notify }) {
  const [data, setData] = useState({
    dfwRates: [],
    roomUtilization: [],
    instructorWorkload: [],
    prereqBottlenecks: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('/admin/analytics/executive');
        setData(res.data || {});
      } catch (err) {
        notify(err.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  if (loading) return <p className="muted" role="status">Computing executive institutional analytics…</p>;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div className="grid-2">
        <div className="panel">
          <h3>DFW Rate &amp; Course Outcomes</h3>
          <ResponsiveTable
            caption="Course D / F / W / NP Failure & Withdrawal Rates"
            getRowKey={(r) => r.course_id}
            columns={[
              { key: 'code', header: 'Course', render: (r) => <span className="mono">{r.course_code} ({r.department_code})</span> },
              { key: 'graded', header: 'Graded', render: (r) => <span className="tabular">{r.total_graded}</span> },
              { key: 'dfw', header: 'DFW Rate', render: (r) => <span className="mono tabular">{r.dfw_rate_pct}% ({r.dfw_count})</span> },
              { key: 'avg', header: 'Avg GPA Pts', render: (r) => <span className="mono">{r.avg_grade_points ?? '—'}</span> }
            ]}
            rows={data.dfwRates || []}
          />
        </div>

        <div className="panel">
          <h3>Prerequisite Bottleneck Impact</h3>
          <ResponsiveTable
            caption="Gateway Courses Unlocking Downstream Curriculum"
            getRowKey={(r) => r.course_code}
            columns={[
              { key: 'code', header: 'Gateway Course', render: (r) => `${r.course_code} — ${r.course_title}` },
              { key: 'unlocks', header: 'Unlocks', render: (r) => <span className="tabular">{r.unlocks_courses} course(s)</span> },
              { key: 'wait', header: 'Waitlist Demand', render: (r) => <span className="tabular">{r.downstream_waitlist}</span> }
            ]}
            rows={data.prereqBottlenecks || []}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>Offering Seat &amp; Room Utilization</h3>
          <ResponsiveTable
            caption="Section Capacity Utilization"
            getRowKey={(r) => r.offering_id}
            columns={[
              { key: 'off', header: 'Offering', render: (r) => `${r.course_code} Sec ${r.section} (${r.term_name})` },
              { key: 'room', header: 'Room', render: (r) => r.room },
              { key: 'fill', header: 'Enrolled / Cap', render: (r) => <span className="mono">{r.enrolled_count}/{r.capacity} (+{r.waitlist_count} WL)</span> },
              { key: 'pct', header: 'Utilization', render: (r) => <span className="mono tabular">{r.utilization_pct}%</span> }
            ]}
            rows={data.roomUtilization || []}
          />
        </div>

        <div className="panel">
          <h3>Faculty Teaching Workload</h3>
          <ResponsiveTable
            caption="Instructor Assigned Credit Load"
            getRowKey={(r) => `${r.instructor_id}-${r.term_id}`}
            columns={[
              { key: 'inst', header: 'Faculty', render: (r) => r.instructor_name },
              { key: 'term', header: 'Term', render: (r) => r.term_name },
              { key: 'cr', header: 'Credits / Max', render: (r) => <span className="mono">{r.assigned_credits} / {r.max_credit_load}</span> },
              { key: 'ov', header: 'Status', render: (r) => r.is_overloaded ? <StatusBadge status="suspended" label="Overload" /> : 'Normal' }
            ]}
            rows={(data.instructorWorkload || []).filter((w) => w.offering_count > 0)}
          />
        </div>
      </div>
    </div>
  );
}
