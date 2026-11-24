const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatMeetings(meetings = []) {
  if (!Array.isArray(meetings) || meetings.length === 0) return 'TBA';
  return meetings
    .map((m) => `${DAY_NAMES[m.day_of_week] ?? 'Day'} ${m.start_time}–${m.end_time}`)
    .join(', ');
}

export { DAY_NAMES };
