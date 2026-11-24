const LABELS = {
  enrolled: { symbol: '✓', cls: 'badge--enrolled', text: 'Enrolled' },
  completed: { symbol: '■', cls: 'badge--completed', text: 'Completed' },
  waitlisted: { symbol: '◷', cls: 'badge--waitlisted', text: 'Waitlisted' },
  dropped: { symbol: '×', cls: 'badge--dropped', text: 'Dropped' },
  withdrawn: { symbol: '−', cls: 'badge--dropped', text: 'Withdrawn (W)' },
  open: { symbol: '●', cls: 'badge--open', text: 'Open' },
  closed: { symbol: '○', cls: 'badge--closed', text: 'Closed' },
  active: { symbol: '●', cls: 'badge--open', text: 'Active' },
  suspended: { symbol: '▲', cls: 'badge--suspended', text: 'Suspended' },
  graduated: { symbol: '■', cls: 'badge--completed', text: 'Graduated' },
  inactive: { symbol: '○', cls: 'badge--closed', text: 'Inactive' },
  pending: { symbol: '◷', cls: 'badge--waitlisted', text: 'Pending' },
  submitted: { symbol: '•', cls: 'badge--neutral', text: 'Submitted' },
  under_review: { symbol: '◷', cls: 'badge--waitlisted', text: 'Under Review' },
  admitted: { symbol: '✓', cls: 'badge--open', text: 'Admitted' },
  matriculated: { symbol: '■', cls: 'badge--completed', text: 'Matriculated' },
  approved: { symbol: '✓', cls: 'badge--enrolled', text: 'Approved' },
  conferred: { symbol: '◆', cls: 'badge--completed', text: 'Conferred' },
  rejected: { symbol: '×', cls: 'badge--dropped', text: 'Rejected' },
  denied: { symbol: '×', cls: 'badge--dropped', text: 'Denied' },
  acknowledged: { symbol: '✓', cls: 'badge--neutral', text: 'Acknowledged' },
  resolved: { symbol: '■', cls: 'badge--completed', text: 'Resolved' },
  booked: { symbol: '✓', cls: 'badge--enrolled', text: 'Booked' },
  cancelled: { symbol: '×', cls: 'badge--dropped', text: 'Cancelled' },
  commendation: { symbol: '★', cls: 'badge--open', text: 'Commendation' },
  academic_risk: { symbol: '▲', cls: 'badge--danger', text: 'Academic Risk' },
  attendance: { symbol: '▲', cls: 'badge--suspended', text: 'Attendance' },
  missing_work: { symbol: '▲', cls: 'badge--waitlisted', text: 'Missing Work' }
};

export function StatusBadge({ status, label }) {
  const key = String(status || '').toLowerCase();
  const cfg = LABELS[key] || { symbol: '•', cls: 'badge--neutral', text: status || 'Unknown' };
  return (
    <span className={`badge ${cfg.cls}`}>
      <span aria-hidden="true">{cfg.symbol}</span>
      <span>{label || cfg.text}</span>
    </span>
  );
}
