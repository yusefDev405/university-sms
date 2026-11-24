const LABELS = {
  enrolled: { symbol: '✓', cls: 'badge--enrolled', text: 'Enrolled' },
  completed: { symbol: '■', cls: 'badge--completed', text: 'Completed' },
  waitlisted: { symbol: '◷', cls: 'badge--waitlisted', text: 'Waitlisted' },
  dropped: { symbol: '×', cls: 'badge--dropped', text: 'Dropped' },
  open: { symbol: '●', cls: 'badge--open', text: 'Open' },
  closed: { symbol: '○', cls: 'badge--closed', text: 'Closed' },
  active: { symbol: '●', cls: 'badge--open', text: 'Active' },
  suspended: { symbol: '▲', cls: 'badge--suspended', text: 'Suspended' },
  graduated: { symbol: '■', cls: 'badge--neutral', text: 'Graduated' },
  inactive: { symbol: '○', cls: 'badge--closed', text: 'Inactive' }
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
