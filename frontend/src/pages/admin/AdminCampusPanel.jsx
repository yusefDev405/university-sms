import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';

export function AdminCampusPanel({ offerings, terms, notify }) {
  const [rooms, setRooms] = useState([]);
  const [exams, setExams] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [roomForm, setRoomForm] = useState({ building: 'Building E', roomNumber: 'Hall E-201', capacity: 40, roomType: 'lecture' });
  const [examForm, setExamForm] = useState({ offeringId: '', examDate: '2027-05-18', startTime: '09:00', endTime: '11:00', room: 'Hall B-101' });
  const [calForm, setCalForm] = useState({ termId: '', title: '', eventType: 'exams', eventDate: '2027-05-10' });

  const loadCampus = useCallback(async () => {
    try {
      const [rRes, eRes, cRes] = await Promise.all([
        apiRequest('/rooms'),
        apiRequest('/exams'),
        apiRequest('/calendar')
      ]);
      setRooms(rRes.data || []);
      setExams(eRes.data || []);
      setCalendar(cRes.data || []);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [notify]);

  useEffect(() => {
    loadCampus();
  }, [loadCampus]);

  useEffect(() => {
    if (!examForm.offeringId && offerings.length > 0) {
      setExamForm((f) => ({ ...f, offeringId: String(offerings[0].offering_id) }));
    }
  }, [offerings, examForm.offeringId]);

  useEffect(() => {
    if (!calForm.termId && terms.length > 0) {
      setCalForm((f) => ({ ...f, termId: String(terms[0].id) }));
    }
  }, [terms, calForm.termId]);

  const handleAddRoom = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/rooms', {
        method: 'POST',
        body: { ...roomForm, capacity: Number(roomForm.capacity) }
      });
      notify('Room added to campus inventory.', 'success');
      await loadCampus();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleAddExam = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/exams', {
        method: 'POST',
        body: { ...examForm, offeringId: Number(examForm.offeringId) }
      });
      notify('Final exam scheduled with zero conflicts.', 'success');
      await loadCampus();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleAddCal = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/calendar', {
        method: 'POST',
        body: { ...calForm, termId: calForm.termId ? Number(calForm.termId) : null }
      });
      setCalForm((f) => ({ ...f, title: '' }));
      notify('Calendar milestone published.', 'success');
      await loadCampus();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="grid-2">
        <div className="panel">
          <h3>Campus Rooms Inventory</h3>
          <form onSubmit={handleAddRoom} className="filter-bar">
            <div className="field">
              <label htmlFor="rm-bld">Building</label>
              <input id="rm-bld" required value={roomForm.building} onChange={(e) => setRoomForm((f) => ({ ...f, building: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="rm-num">Room Name</label>
              <input id="rm-num" required value={roomForm.roomNumber} onChange={(e) => setRoomForm((f) => ({ ...f, roomNumber: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="rm-cap">Capacity</label>
              <input id="rm-cap" type="number" min="1" required value={roomForm.capacity} onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="rm-type">Type</label>
              <select id="rm-type" value={roomForm.roomType} onChange={(e) => setRoomForm((f) => ({ ...f, roomType: e.target.value }))}>
                {['lecture', 'lab', 'seminar', 'auditorium'].map((rt) => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>
            <button type="submit" className="primary">Add Room</button>
          </form>
          <ResponsiveTable
            caption="Campus Rooms"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'room', header: 'Room', render: (r) => `${r.building} · ${r.room_number}` },
              { key: 'type', header: 'Type', render: (r) => <span className="mono">{r.room_type}</span> },
              { key: 'cap', header: 'Capacity', render: (r) => <span className="tabular">{r.capacity}</span> }
            ]}
            rows={rooms}
          />
        </div>

        <div className="panel">
          <h3>Final Exam Scheduler (Conflict-Checked)</h3>
          <form onSubmit={handleAddExam} className="filter-bar">
            <div className="field">
              <label htmlFor="ex-off">Course Offering</label>
              <select id="ex-off" value={examForm.offeringId} onChange={(e) => setExamForm((f) => ({ ...f, offeringId: e.target.value }))}>
                {offerings.map((o) => (
                  <option key={o.offering_id} value={o.offering_id}>
                    {o.course_code} Sec {o.section} ({o.term_name})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ex-date">Exam Date</label>
              <input id="ex-date" type="date" required value={examForm.examDate} onChange={(e) => setExamForm((f) => ({ ...f, examDate: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="ex-start">Start</label>
              <input id="ex-start" type="time" required value={examForm.startTime} onChange={(e) => setExamForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="ex-end">End</label>
              <input id="ex-end" type="time" required value={examForm.endTime} onChange={(e) => setExamForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="ex-room">Exam Room</label>
              <input id="ex-room" required value={examForm.room} onChange={(e) => setExamForm((f) => ({ ...f, room: e.target.value }))} />
            </div>
            <button type="submit" className="primary">Schedule Exam</button>
          </form>
          <ResponsiveTable
            caption="Scheduled Exams"
            getRowKey={(r) => r.id}
            columns={[
              { key: 'course', header: 'Course', render: (r) => <span className="mono">{r.course_code} Sec {r.section}</span> },
              { key: 'date', header: 'Date & Time', render: (r) => `${String(r.exam_date).slice(0, 10)} (${r.start_time}–${r.end_time})` },
              { key: 'room', header: 'Room', render: (r) => r.room }
            ]}
            rows={exams}
          />
        </div>
      </div>

      <div className="panel">
        <h3>Academic Calendar Milestones</h3>
        <form onSubmit={handleAddCal} className="filter-bar">
          <div className="field">
            <label htmlFor="cal-term">Term</label>
            <select id="cal-term" value={calForm.termId} onChange={(e) => setCalForm((f) => ({ ...f, termId: e.target.value }))}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cal-title">Title</label>
            <input id="cal-title" required value={calForm.title} onChange={(e) => setCalForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="cal-type">Type</label>
            <select id="cal-type" value={calForm.eventType} onChange={(e) => setCalForm((f) => ({ ...f, eventType: e.target.value }))}>
              {['registration', 'add_drop', 'withdrawal', 'exams', 'holiday', 'commencement'].map((et) => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cal-date">Date</label>
            <input id="cal-date" type="date" required value={calForm.eventDate} onChange={(e) => setCalForm((f) => ({ ...f, eventDate: e.target.value }))} />
          </div>
          <button type="submit" className="primary">Publish Milestone</button>
        </form>
        <ResponsiveTable
          caption="Academic Calendar"
          getRowKey={(r) => r.id}
          columns={[
            { key: 'date', header: 'Date', render: (r) => <span className="mono">{String(r.event_date).slice(0, 10)}</span> },
            { key: 'title', header: 'Milestone', render: (r) => r.title },
            { key: 'term', header: 'Term', render: (r) => r.term_name || 'All' },
            { key: 'type', header: 'Category', render: (r) => <span className="mono">{r.event_type}</span> }
          ]}
          rows={calendar}
        />
      </div>
    </div>
  );
}
