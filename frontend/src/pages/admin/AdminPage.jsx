import { useCallback, useEffect, useState } from 'react';
import { apiRequest, downloadPdf } from '../../api/client.js';
import { ModalDialog } from '../../components/ModalDialog.jsx';
import { ResponsiveTable } from '../../components/ResponsiveTable.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { formatMeetings } from '../../utils/schedule.js';

const TABS = [
  { id: 'users', label: 'Users & Students' },
  { id: 'courses', label: 'Courses & Prerequisites' },
  { id: 'terms', label: 'Terms & Offerings' },
  { id: 'reports', label: 'Reports & Audit Log' },
  { id: 'import', label: 'CSV Bulk Import' }
];

export function AdminPage({ notify }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentMeta, setStudentMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [studentSearch, setStudentSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);

  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [report, setReport] = useState({ departments: [], standings: [] });
  const [holds, setHolds] = useState([]);
  const [holdStudent, setHoldStudent] = useState(null);
  const [holdReason, setHoldReason] = useState('');

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditMeta, setAuditMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [auditEntity, setAuditEntity] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog states
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentTranscript, setStudentTranscript] = useState(null);

  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [prereqCourse, setPrereqCourse] = useState(null);
  const [selectedPrereqIds, setSelectedPrereqIds] = useState([]);

  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showTermDialog, setShowTermDialog] = useState(false);
  const [showOfferingDialog, setShowOfferingDialog] = useState(false);
  const [editingOffering, setEditingOffering] = useState(null);

  // Forms
  const [userForm, setUserForm] = useState({
    email: '',
    password: 'Student123!',
    role: 'student',
    firstName: '',
    lastName: '',
    studentNumber: '',
    dateOfBirth: '2006-01-15',
    departmentId: '',
    title: 'Dr.'
  });
  const [deptForm, setDeptForm] = useState({ code: '', name: '' });
  const [courseForm, setCourseForm] = useState({ code: '', title: '', credits: 3, departmentId: '' });
  const [termForm, setTermForm] = useState({
    name: '',
    startDate: '2027-09-15',
    endDate: '2027-12-20',
    registrationOpens: '2027-08-20T08:00',
    registrationCloses: '2027-09-25T23:59'
  });
  const [offeringForm, setOfferingForm] = useState({
    courseId: '',
    termId: '',
    instructorId: '',
    section: '01',
    capacity: 25,
    room: 'Hall B-105',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:30'
  });

  const [csvInput, setCsvInput] = useState(
    'email,student_number,first_name,last_name,date_of_birth,department_code\n' +
    'farah.hany@galala.edu.eg,2026101,Farah,Hany,2006-05-12,CS\n' +
    'tamer.ali@galala.edu.eg,2026102,Tamer,Ali,2005-11-02,MATH'
  );
  const [importResult, setImportResult] = useState(null);

  const loadStudents = useCallback(async (searchQ, pageNum) => {
    const qs = new URLSearchParams({ page: String(pageNum), limit: '10' });
    if (searchQ) qs.set('search', searchQ);
    const res = await apiRequest(`/students?${qs.toString()}`);
    setStudents(res.data || []);
    setStudentMeta(res.meta || { page: pageNum, limit: 10, total: 0 });
  }, []);

  const loadAudit = useCallback(async (entity, pageNum) => {
    const qs = new URLSearchParams({ page: String(pageNum), limit: '20' });
    if (entity) qs.set('entity', entity);
    const res = await apiRequest(`/audit-log?${qs.toString()}`);
    setAuditLogs(res.data || []);
    setAuditMeta(res.meta || { page: pageNum, limit: 20, total: 0 });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [uRes, dRes, cRes, tRes, oRes, iRes, rRes, hRes] = await Promise.all([
        apiRequest('/users?limit=50'),
        apiRequest('/departments'),
        apiRequest('/courses?limit=50'),
        apiRequest('/terms'),
        apiRequest('/offerings?limit=50'),
        apiRequest('/instructors'),
        apiRequest('/reports/enrollment-by-department'),
        apiRequest('/holds'),
        loadStudents('', 1),
        loadAudit('', 1)
      ]);
      setHolds(hRes.data || []);
      setUsers(uRes.data || []);
      const depts = dRes.data || [];
      setDepartments(depts);
      const courseList = cRes.data || [];
      setCourses(courseList);
      const termList = tRes.data || [];
      setTerms(termList);
      setOfferings(oRes.data || []);
      const instrList = iRes.data || [];
      setInstructors(instrList);
      setReport(rRes.data || { departments: [], standings: [] });

      if (depts[0]) {
        setUserForm((f) => ({ ...f, departmentId: f.departmentId || String(depts[0].id) }));
        setCourseForm((f) => ({ ...f, departmentId: f.departmentId || String(depts[0].id) }));
      }
      if (courseList[0] && termList[0] && instrList[0]) {
        setOfferingForm((f) => ({
          ...f,
          courseId: f.courseId || String(courseList[0].id),
          termId: f.termId || String(termList[0].id),
          instructorId: f.instructorId || String(instrList[0].id)
        }));
      }
    } catch (err) {
      setError(err.message || 'Could not load admin data');
    } finally {
      setLoading(false);
    }
  }, [loadStudents, loadAudit]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToggleUserActive = async (u) => {
    try {
      await apiRequest(`/users/${u.id}`, {
        method: 'PATCH',
        body: { isActive: !u.is_active }
      });
      notify(`${u.email} ${u.is_active ? 'deactivated' : 'activated'}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/users/${editingUser.id}`, {
        method: 'PATCH',
        body: { role: editingUser.role, isActive: editingUser.is_active }
      });
      setEditingUser(null);
      notify('User updated.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveStudentEdit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/students/${editingStudent.id}`, {
        method: 'PATCH',
        body: {
          firstName: editingStudent.first_name,
          lastName: editingStudent.last_name,
          departmentId: Number(editingStudent.department_id),
          status: editingStudent.status
        }
      });
      setEditingStudent(null);
      notify('Student profile updated.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleViewStudentTranscript = async (studentId) => {
    try {
      const res = await apiRequest(`/students/${studentId}/transcript`);
      setStudentTranscript(res.data);
    } catch (err) {
      notify(err.message || 'Could not load student transcript', 'error');
    }
  };

  const handlePlaceHold = async (e) => {
    e.preventDefault();
    if (!holdStudent || !holdReason.trim()) return;
    try {
      await apiRequest('/holds', {
        method: 'POST',
        body: { studentId: holdStudent.id, reason: holdReason.trim() }
      });
      setHoldReason('');
      notify(`Placed registration hold on ${holdStudent.student_number}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleResolveHold = async (holdId) => {
    try {
      await apiRequest(`/holds/${holdId}/resolve`, { method: 'PATCH' });
      notify('Academic hold resolved.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleToggleTermRegistration = async (term) => {
    const now = Date.now();
    const body = term.is_registration_open
      ? { registrationCloses: new Date(now - 60000).toISOString() }
      : {
          registrationOpens: new Date(now - 60000).toISOString(),
          registrationCloses: new Date(now + 30 * 86400000).toISOString()
        };
    try {
      await apiRequest(`/terms/${term.id}`, { method: 'PATCH', body });
      notify(`Updated registration window for ${term.name}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        isActive: true
      };
      if (userForm.role === 'student') {
        payload.studentProfile = {
          studentNumber: userForm.studentNumber,
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          dateOfBirth: userForm.dateOfBirth,
          departmentId: Number(userForm.departmentId),
          status: 'active'
        };
      } else if (userForm.role === 'instructor') {
        payload.instructorProfile = {
          firstName: userForm.firstName,
          lastName: userForm.lastName,
          title: userForm.title,
          departmentId: Number(userForm.departmentId)
        };
      }
      await apiRequest('/users', { method: 'POST', body: payload });
      setShowUserDialog(false);
      notify(`Created ${userForm.role} account for ${userForm.email}.`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/departments', { method: 'POST', body: deptForm });
      setShowDeptDialog(false);
      setDeptForm({ code: '', name: '' });
      notify('Department created.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/courses', {
        method: 'POST',
        body: {
          ...courseForm,
          credits: Number(courseForm.credits),
          departmentId: Number(courseForm.departmentId)
        }
      });
      setShowCourseDialog(false);
      setCourseForm((f) => ({ ...f, code: '', title: '' }));
      notify('Course added to catalogue.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveCourseEdit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/courses/${editingCourse.id}`, {
        method: 'PATCH',
        body: {
          code: editingCourse.code,
          title: editingCourse.title,
          credits: Number(editingCourse.credits),
          departmentId: Number(editingCourse.department_id)
        }
      });
      setEditingCourse(null);
      notify('Course updated.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSavePrerequisites = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/courses/${prereqCourse.id}/prerequisites`, {
        method: 'PUT',
        body: { prerequisiteIds: selectedPrereqIds }
      });
      setPrereqCourse(null);
      notify('Course prerequisites updated.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateTerm = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/terms', {
        method: 'POST',
        body: {
          name: termForm.name,
          startDate: termForm.startDate,
          endDate: termForm.endDate,
          registrationOpens: new Date(termForm.registrationOpens).toISOString(),
          registrationCloses: new Date(termForm.registrationCloses).toISOString()
        }
      });
      setShowTermDialog(false);
      setTermForm((f) => ({ ...f, name: '' }));
      notify('Academic term created.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCreateOffering = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/offerings', {
        method: 'POST',
        body: {
          courseId: Number(offeringForm.courseId),
          termId: Number(offeringForm.termId),
          instructorId: Number(offeringForm.instructorId),
          section: offeringForm.section,
          capacity: Number(offeringForm.capacity),
          room: offeringForm.room,
          meetings: [
            {
              dayOfWeek: Number(offeringForm.dayOfWeek),
              startTime: offeringForm.startTime,
              endTime: offeringForm.endTime
            }
          ]
        }
      });
      setShowOfferingDialog(false);
      notify('Course offering published.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveOfferingEdit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/offerings/${editingOffering.offering_id}`, {
        method: 'PATCH',
        body: {
          instructorId: Number(editingOffering.instructor_id),
          section: editingOffering.section,
          capacity: Number(editingOffering.capacity),
          room: editingOffering.room
        }
      });
      setEditingOffering(null);
      notify('Offering updated.', 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleCsvImport = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/admin/import/students', {
        method: 'POST',
        body: { csv: csvInput }
      });
      setImportResult(res.data);
      notify(`Imported ${res.data.importedCount} student(s).`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleTabKeyDown = (e, idx) => {
    if (e.key === 'ArrowRight') {
      const next = TABS[(idx + 1) % TABS.length];
      setActiveTab(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
      setActiveTab(prev.id);
      document.getElementById(`tab-${prev.id}`)?.focus();
    }
  };

  const studentTotalPages = Math.max(1, Math.ceil((studentMeta.total || 0) / (studentMeta.limit || 10)));
  const auditTotalPages = Math.max(1, Math.ceil((auditMeta.total || 0) / (auditMeta.limit || 20)));

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-header">
        <div>
          <div className="page-kicker">Registrar Administration</div>
          <h1 id="admin-heading">University Operations Console</h1>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="ghost" onClick={() => setError('')}>Dismiss</button>
        </div>
      ) : null}

      <div role="tablist" aria-label="Admin sections" className="tablist">
        {TABS.map((tab, idx) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className="tab-btn"
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, idx)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel" role="status"><p className="muted" style={{ margin: 0 }}>Loading registry data…</p></div>
      ) : null}

      {!loading && activeTab === 'users' ? (
        <div role="tabpanel" aria-labelledby="tab-users" className="tabpanel-inner">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBlockEnd: '0.85rem' }}>
            <button type="button" className="primary" onClick={() => setShowUserDialog(true)}>
              + Create User &amp; Profile
            </button>
          </div>
          <div style={{ marginBlockEnd: '1.5rem' }}>
            <ResponsiveTable
              caption="University user accounts"
              columns={[
                { key: 'email', header: 'Email', render: (r) => <span className="mono">{r.email}</span> },
                { key: 'name', header: 'Name', render: (r) => (r.first_name ? `${r.first_name} ${r.last_name}` : 'System Admin') },
                { key: 'role', header: 'Role', render: (r) => <span className="role-pill">{r.role}</span> },
                { key: 'student_number', header: 'ID', render: (r) => <span className="mono">{r.student_number || '—'}</span> },
                { key: 'is_active', header: 'Status', render: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} /> },
                {
                  key: 'action',
                  header: 'Actions',
                  render: (r) => (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setEditingUser({ ...r })}>Edit Role</button>
                      <button type="button" onClick={() => handleToggleUserActive(r)}>
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )
                }
              ]}
              rows={users}
              getRowKey={(r) => r.id}
            />
          </div>

          <form
            className="panel filter-bar"
            onSubmit={(e) => {
              e.preventDefault();
              setStudentPage(1);
              loadStudents(studentSearch, 1);
            }}
          >
            <div className="field">
              <label htmlFor="admin-student-search">Search Student Directory</label>
              <input
                id="admin-student-search"
                type="search"
                placeholder="Student number, name, or email"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div>
              <button type="submit" className="primary">Filter Students</button>
            </div>
          </form>

          <ResponsiveTable
            caption="Student directory & academic records"
            columns={[
              { key: 'student_number', header: 'Student ID', render: (r) => <span className="mono">{r.student_number}</span> },
              {
                key: 'name',
                header: 'Student',
                render: (r) => (
                  <div>
                    <div>{r.first_name} {r.last_name}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{r.email}</div>
                  </div>
                )
              },
              { key: 'department_code', header: 'Dept' },
              { key: 'gpa', header: 'GPA / Credits', render: (r) => <span className="mono">{r.gpa ?? '—'} ({r.credits_earned} cr)</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.active_hold_count > 0 ? 'suspended' : r.status} label={r.active_hold_count > 0 ? `${r.status} (${r.active_hold_count} hold)` : r.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setEditingStudent({ ...r })}>Edit</button>
                    <button type="button" onClick={() => setHoldStudent(r)}>Holds</button>
                    <button type="button" className="primary" onClick={() => handleViewStudentTranscript(r.id)}>
                      Transcript
                    </button>
                  </div>
                )
              }
            ]}
            rows={students}
            getRowKey={(r) => r.id}
          />
          <div className="pagination-bar">
            <span className="muted mono" style={{ fontSize: '0.84rem' }}>
              Page {studentMeta.page} of {studentTotalPages} ({studentMeta.total} students)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={studentPage <= 1}
                onClick={() => {
                  const next = studentPage - 1;
                  setStudentPage(next);
                  loadStudents(studentSearch, next);
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={studentPage >= studentTotalPages}
                onClick={() => {
                  const next = studentPage + 1;
                  setStudentPage(next);
                  loadStudents(studentSearch, next);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && activeTab === 'courses' ? (
        <div role="tabpanel" aria-labelledby="tab-courses" className="tabpanel-inner">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'flex-end', marginBlockEnd: '0.85rem' }}>
            <button type="button" onClick={() => setShowDeptDialog(true)}>+ New Department</button>
            <button type="button" className="primary" onClick={() => setShowCourseDialog(true)}>+ New Course</button>
          </div>
          <ResponsiveTable
            caption="Course catalogue & prerequisites"
            columns={[
              { key: 'code', header: 'Code', render: (r) => <span className="mono">{r.code}</span> },
              { key: 'title', header: 'Title' },
              { key: 'department_code', header: 'Dept' },
              { key: 'credits', header: 'Credits', render: (r) => <span className="tabular">{r.credits}</span> },
              {
                key: 'prerequisites',
                header: 'Prerequisites',
                render: (r) =>
                  r.prerequisites?.length > 0
                    ? <span className="mono">{r.prerequisites.map((p) => p.code).join(', ')}</span>
                    : <span className="muted">None</span>
              },
              {
                key: 'actions',
                header: 'Manage',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setEditingCourse({ ...r })}>Edit</button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrereqCourse(r);
                        setSelectedPrereqIds((r.prerequisites || []).map((p) => p.id));
                      }}
                    >
                      Prerequisites
                    </button>
                  </div>
                )
              }
            ]}
            rows={courses}
            getRowKey={(r) => r.id}
          />
        </div>
      ) : null}

      {!loading && activeTab === 'terms' ? (
        <div role="tabpanel" aria-labelledby="tab-terms" className="tabpanel-inner">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'flex-end', marginBlockEnd: '0.85rem' }}>
            <button type="button" onClick={() => setShowTermDialog(true)}>+ New Term</button>
            <button type="button" className="primary" onClick={() => setShowOfferingDialog(true)}>+ New Offering</button>
          </div>

          <div style={{ marginBlockEnd: '1.25rem' }}>
            <ResponsiveTable
              caption="Academic terms & registration windows"
              columns={[
                { key: 'name', header: 'Term' },
                { key: 'dates', header: 'Term Dates', render: (r) => <span className="mono">{String(r.start_date).slice(0, 10)} → {String(r.end_date).slice(0, 10)}</span> },
                { key: 'is_registration_open', header: 'Registration', render: (r) => <StatusBadge status={r.is_registration_open ? 'open' : 'closed'} /> },
                {
                  key: 'action',
                  header: 'Window Control',
                  render: (r) => (
                    <button type="button" onClick={() => handleToggleTermRegistration(r)}>
                      {r.is_registration_open ? 'Close Registration' : 'Open Registration'}
                    </button>
                  )
                }
              ]}
              rows={terms}
              getRowKey={(r) => r.id}
            />
          </div>

          <ResponsiveTable
            caption="Published course offerings"
            columns={[
              { key: 'course_code', header: 'Course', render: (r) => <span className="mono">{r.course_code} · Sec {r.section}</span> },
              { key: 'term_name', header: 'Term' },
              { key: 'instructor_name', header: 'Instructor' },
              { key: 'room', header: 'Room', render: (r) => <span className="mono">{r.room}</span> },
              { key: 'meetings', header: 'Meetings', render: (r) => <span className="mono" style={{ fontSize: '0.8rem' }}>{formatMeetings(r.meetings)}</span> },
              { key: 'seats', header: 'Enrolled / Cap', render: (r) => <span className="mono">{r.enrolled_count} / {r.capacity} ({r.waitlist_count} WL)</span> },
              {
                key: 'actions',
                header: 'Edit',
                render: (r) => (
                  <button type="button" onClick={() => setEditingOffering({ ...r })}>
                    Edit
                  </button>
                )
              }
            ]}
            rows={offerings}
            getRowKey={(r) => r.offering_id}
          />
        </div>
      ) : null}

      {!loading && activeTab === 'reports' ? (
        <div role="tabpanel" aria-labelledby="tab-reports" className="tabpanel-inner">
          <div style={{ marginBlockEnd: '1.25rem' }}>
            <ResponsiveTable
              caption="Department enrollment & GPA summary"
              columns={[
                { key: 'code', header: 'Dept', render: (r) => <span className="mono">{r.code}</span> },
                { key: 'name', header: 'Department Name' },
                { key: 'student_count', header: 'Students', render: (r) => <span className="tabular">{r.student_count}</span> },
                { key: 'active_enrollments', header: 'Enrolled', render: (r) => <span className="tabular">{r.active_enrollments}</span> },
                { key: 'waitlisted_enrollments', header: 'Waitlisted', render: (r) => <span className="tabular">{r.waitlisted_enrollments}</span> },
                { key: 'avg_gpa', header: 'Avg GPA', render: (r) => <span className="mono">{r.avg_gpa ?? '—'}</span> }
              ]}
              rows={report.departments}
              getRowKey={(r) => r.id}
            />
          </div>

          <div style={{ marginBlockEnd: '1.25rem' }}>
            <ResponsiveTable
              caption="Department student GPA standings (SQL window RANK)"
              columns={[
                { key: 'department_code', header: 'Dept', render: (r) => <span className="mono">{r.department_code}</span> },
                { key: 'dept_rank', header: 'Rank', render: (r) => <span className="mono">#{r.dept_rank}</span> },
                { key: 'student_number', header: 'Student ID', render: (r) => <span className="mono">{r.student_number}</span> },
                { key: 'full_name', header: 'Student' },
                { key: 'gpa', header: 'GPA', render: (r) => <span className="mono">{Number(r.gpa).toFixed(2)}</span> },
                { key: 'credits_earned', header: 'Credits Earned', render: (r) => <span className="tabular">{r.credits_earned}</span> }
              ]}
              rows={report.standings}
              getRowKey={(r) => r.student_number}
              emptyMessage="No graded students ranked yet."
            />
          </div>

          <div className="panel filter-bar">
            <div className="field">
              <label htmlFor="audit-entity-filter">Filter Audit Entity</label>
              <select
                id="audit-entity-filter"
                value={auditEntity}
                onChange={(e) => {
                  setAuditEntity(e.target.value);
                  setAuditPage(1);
                  loadAudit(e.target.value, 1);
                }}
              >
                <option value="">All audited tables</option>
                <option value="enrollments">enrollments</option>
                <option value="terms">terms</option>
                <option value="courses">courses</option>
              </select>
            </div>
          </div>

          <ResponsiveTable
            caption="Immutable database audit trail"
            columns={[
              { key: 'created_at', header: 'Timestamp', render: (r) => <span className="mono" style={{ fontSize: '0.78rem' }}>{new Date(r.created_at).toLocaleString()}</span> },
              { key: 'actor_email', header: 'Actor', render: (r) => <span className="mono">{r.actor_email || 'system'}</span> },
              { key: 'action', header: 'Action', render: (r) => <span className="badge badge--neutral">{r.action}</span> },
              { key: 'entity', header: 'Entity', render: (r) => <span className="mono">{r.entity} #{r.entity_id}</span> },
              {
                key: 'diff',
                header: 'Row Snapshot',
                render: (r) => (
                  <details>
                    <summary style={{ cursor: 'pointer' }}>Inspect JSON</summary>
                    <pre className="mono" style={{ fontSize: '0.74rem', whiteSpace: 'pre-wrap', margin: '0.4rem 0 0' }}>
                      {JSON.stringify({ old: r.old_data, new: r.new_data }, null, 2)}
                    </pre>
                  </details>
                )
              }
            ]}
            rows={auditLogs}
            getRowKey={(r) => r.id}
          />

          <div className="pagination-bar">
            <span className="muted mono" style={{ fontSize: '0.84rem' }}>
              Page {auditMeta.page} of {auditTotalPages} ({auditMeta.total} events)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={auditPage <= 1}
                onClick={() => {
                  const next = auditPage - 1;
                  setAuditPage(next);
                  loadAudit(auditEntity, next);
                }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={auditPage >= auditTotalPages}
                onClick={() => {
                  const next = auditPage + 1;
                  setAuditPage(next);
                  loadAudit(auditEntity, next);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && activeTab === 'import' ? (
        <div role="tabpanel" aria-labelledby="tab-import" className="tabpanel-inner">
          <form className="panel" onSubmit={handleCsvImport}>
            <h2>Bulk Student CSV Import</h2>
            <p className="muted">
              Validates every row, rejects malformed rows with line-level diagnostics, and loads valid students in one transaction.
            </p>
            <div className="field">
              <label htmlFor="csv-textarea">CSV Input (email,student_number,first_name,last_name,date_of_birth,department_code)</label>
              <textarea
                id="csv-textarea"
                rows={6}
                className="mono"
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
              />
            </div>
            <button type="submit" className="primary">Validate &amp; Import Students</button>
          </form>

          {importResult ? (
            <div className="panel">
              <h3>Import Summary</h3>
              <p>
                Imported: <strong>{importResult.importedCount}</strong> · Rejected: <strong>{importResult.rejectedCount}</strong>
              </p>
              {importResult.errors?.length > 0 ? (
                <ul>
                  {importResult.errors.map((err) => (
                    <li key={err.line} className="mono" style={{ color: 'var(--danger)', fontSize: '0.84rem' }}>
                      Line {err.line}: {err.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Modal Dialogs */}
      <ModalDialog open={showUserDialog} title="Create User & Profile" onClose={() => setShowUserDialog(false)}>
        <form onSubmit={handleCreateUser}>
          <div className="field">
            <label htmlFor="u-email">Email</label>
            <input id="u-email" type="email" required value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="u-pass">Initial Password</label>
            <input id="u-pass" type="text" required minLength={8} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="u-role">Role</label>
            <select id="u-role" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {userForm.role !== 'admin' ? (
            <>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="u-first">First Name</label>
                  <input id="u-first" required value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="u-last">Last Name</label>
                  <input id="u-last" required value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="u-dept">Department</label>
                <select id="u-dept" value={userForm.departmentId} onChange={(e) => setUserForm({ ...userForm, departmentId: e.target.value })}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
            </>
          ) : null}
          {userForm.role === 'student' ? (
            <div className="grid-2">
              <div className="field">
                <label htmlFor="u-num">Student Number</label>
                <input id="u-num" required value={userForm.studentNumber} onChange={(e) => setUserForm({ ...userForm, studentNumber: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="u-dob">Date of Birth</label>
                <input id="u-dob" type="date" required value={userForm.dateOfBirth} onChange={(e) => setUserForm({ ...userForm, dateOfBirth: e.target.value })} />
              </div>
            </div>
          ) : null}
          {userForm.role === 'instructor' ? (
            <div className="field">
              <label htmlFor="u-title">Academic Title</label>
              <input id="u-title" required value={userForm.title} onChange={(e) => setUserForm({ ...userForm, title: e.target.value })} />
            </div>
          ) : null}
          <div className="dialog-actions">
            <button type="button" onClick={() => setShowUserDialog(false)}>Cancel</button>
            <button type="submit" className="primary">Create User</button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog open={Boolean(editingUser)} title="Edit User Role & Status" onClose={() => setEditingUser(null)}>
        {editingUser ? (
          <form onSubmit={handleSaveUserEdit}>
            <p className="mono">{editingUser.email}</p>
            <div className="field">
              <label htmlFor="eu-role">Role</label>
              <select id="eu-role" value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}>
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="eu-active">Account Status</label>
              <select
                id="eu-active"
                value={editingUser.is_active ? 'true' : 'false'}
                onChange={(e) => setEditingUser({ ...editingUser, is_active: e.target.value === 'true' })}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditingUser(null)}>Cancel</button>
              <button type="submit" className="primary">Save Changes</button>
            </div>
          </form>
        ) : null}
      </ModalDialog>

      <ModalDialog open={Boolean(editingStudent)} title="Edit Student Profile" onClose={() => setEditingStudent(null)}>
        {editingStudent ? (
          <form onSubmit={handleSaveStudentEdit}>
            <p className="mono">Student Number: {editingStudent.student_number}</p>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="es-first">First Name</label>
                <input id="es-first" required value={editingStudent.first_name} onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="es-last">Last Name</label>
                <input id="es-last" required value={editingStudent.last_name} onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="es-dept">Department</label>
                <select id="es-dept" value={editingStudent.department_id} onChange={(e) => setEditingStudent({ ...editingStudent, department_id: e.target.value })}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="es-status">Academic Status</label>
                <select id="es-status" value={editingStudent.status} onChange={(e) => setEditingStudent({ ...editingStudent, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="graduated">graduated</option>
                </select>
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditingStudent(null)}>Cancel</button>
              <button type="submit" className="primary">Save Student</button>
            </div>
          </form>
        ) : null}
      </ModalDialog>

      <ModalDialog open={Boolean(studentTranscript)} title="Student Official Transcript" onClose={() => setStudentTranscript(null)}>
        {studentTranscript ? (
          <div>
            <p className="mono" style={{ marginBlockEnd: '0.35rem' }}>
              {studentTranscript.student.first_name} {studentTranscript.student.last_name} ({studentTranscript.student.student_number})
            </p>
            <p className="muted">
              GPA: <strong className="mono">{studentTranscript.summary.gpa ?? 'N/A'}</strong> ·{' '}
              {studentTranscript.summary.standing} · Credits Earned: {studentTranscript.summary.creditsEarned}
            </p>
            <ResponsiveTable
              caption="Completed courses"
              columns={[
                { key: 'course_code', header: 'Code', render: (r) => <span className="mono">{r.course_code}</span> },
                { key: 'term_name', header: 'Term' },
                { key: 'grade_letter', header: 'Grade', render: (r) => <span className="mono">{r.grade_letter} ({Number(r.grade_points).toFixed(2)})</span> }
              ]}
              rows={studentTranscript.courses}
              getRowKey={(r) => r.enrollment_id}
              emptyMessage="No completed courses yet."
            />
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() =>
                  downloadPdf(
                    `/students/${studentTranscript.student.id}/transcript/pdf`,
                    `transcript_${studentTranscript.student.student_number}.pdf`
                  )
                }
              >
                Download PDF
              </button>
              <button type="button" className="primary" onClick={() => setStudentTranscript(null)}>Close</button>
            </div>
          </div>
        ) : null}
      </ModalDialog>

      <ModalDialog open={showDeptDialog} title="Create Department" onClose={() => setShowDeptDialog(false)}>
        <form onSubmit={handleCreateDept}>
          <div className="field">
            <label htmlFor="d-code">Code (e.g. BIO)</label>
            <input id="d-code" required value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="d-name">Department Name</label>
            <input id="d-name" required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          </div>
          <div className="dialog-actions">
            <button type="button" onClick={() => setShowDeptDialog(false)}>Cancel</button>
            <button type="submit" className="primary">Save Department</button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog open={showCourseDialog} title="Create Course" onClose={() => setShowCourseDialog(false)}>
        <form onSubmit={handleCreateCourse}>
          <div className="field">
            <label htmlFor="c-code">Course Code</label>
            <input id="c-code" required placeholder="CS410" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="c-title">Course Title</label>
            <input id="c-title" required value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="c-credits">Credits (1–6)</label>
              <input id="c-credits" type="number" min={1} max={6} required value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="c-dept">Department</label>
              <select id="c-dept" value={courseForm.departmentId} onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" onClick={() => setShowCourseDialog(false)}>Cancel</button>
            <button type="submit" className="primary">Save Course</button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog open={Boolean(editingCourse)} title="Edit Course" onClose={() => setEditingCourse(null)}>
        {editingCourse ? (
          <form onSubmit={handleSaveCourseEdit}>
            <div className="field">
              <label htmlFor="ec-code">Course Code</label>
              <input id="ec-code" required value={editingCourse.code} onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="ec-title">Title</label>
              <input id="ec-title" required value={editingCourse.title} onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="ec-credits">Credits</label>
                <input id="ec-credits" type="number" min={1} max={6} required value={editingCourse.credits} onChange={(e) => setEditingCourse({ ...editingCourse, credits: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="ec-dept">Department</label>
                <select id="ec-dept" value={editingCourse.department_id} onChange={(e) => setEditingCourse({ ...editingCourse, department_id: e.target.value })}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                </select>
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditingCourse(null)}>Cancel</button>
              <button type="submit" className="primary">Save Course</button>
            </div>
          </form>
        ) : null}
      </ModalDialog>

      <ModalDialog
        open={Boolean(prereqCourse)}
        title={prereqCourse ? `Prerequisites for ${prereqCourse.code}` : 'Prerequisites'}
        onClose={() => setPrereqCourse(null)}
      >
        {prereqCourse ? (
          <form onSubmit={handleSavePrerequisites}>
            <p className="muted">Select every required prerequisite course:</p>
            <div style={{ display: 'grid', gap: '0.45rem', maxBlockSize: '18rem', overflow: 'auto' }}>
              {courses
                .filter((c) => c.id !== prereqCourse.id)
                .map((c) => {
                  const checked = selectedPrereqIds.includes(c.id);
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        style={{ inlineSize: 'auto', minBlockSize: 'auto' }}
                        checked={checked}
                        onChange={(e) =>
                          setSelectedPrereqIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          )
                        }
                      />
                      <span className="mono">{c.code}</span> — {c.title}
                    </label>
                  );
                })}
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPrereqCourse(null)}>Cancel</button>
              <button type="submit" className="primary">Save Prerequisites</button>
            </div>
          </form>
        ) : null}
      </ModalDialog>

      <ModalDialog open={showTermDialog} title="Create Academic Term" onClose={() => setShowTermDialog(false)}>
        <form onSubmit={handleCreateTerm}>
          <div className="field">
            <label htmlFor="t-name">Term Name</label>
            <input id="t-name" required placeholder="Fall 2027" value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="t-start">Start Date</label>
              <input id="t-start" type="date" required value={termForm.startDate} onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="t-end">End Date</label>
              <input id="t-end" type="date" required value={termForm.endDate} onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="t-open">Registration Opens</label>
              <input id="t-open" type="datetime-local" required value={termForm.registrationOpens} onChange={(e) => setTermForm({ ...termForm, registrationOpens: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="t-close">Registration Closes</label>
              <input id="t-close" type="datetime-local" required value={termForm.registrationCloses} onChange={(e) => setTermForm({ ...termForm, registrationCloses: e.target.value })} />
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" onClick={() => setShowTermDialog(false)}>Cancel</button>
            <button type="submit" className="primary">Save Term</button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog open={showOfferingDialog} title="Create Course Offering" onClose={() => setShowOfferingDialog(false)}>
        <form onSubmit={handleCreateOffering}>
          <div className="field">
            <label htmlFor="o-course">Course</label>
            <select id="o-course" value={offeringForm.courseId} onChange={(e) => setOfferingForm({ ...offeringForm, courseId: e.target.value })}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="o-term">Term</label>
              <select id="o-term" value={offeringForm.termId} onChange={(e) => setOfferingForm({ ...offeringForm, termId: e.target.value })}>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="o-instr">Instructor</label>
              <select id="o-instr" value={offeringForm.instructorId} onChange={(e) => setOfferingForm({ ...offeringForm, instructorId: e.target.value })}>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.title} {i.first_name} {i.last_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="o-sec">Section</label>
              <input id="o-sec" required value={offeringForm.section} onChange={(e) => setOfferingForm({ ...offeringForm, section: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="o-cap">Capacity</label>
              <input id="o-cap" type="number" min={1} required value={offeringForm.capacity} onChange={(e) => setOfferingForm({ ...offeringForm, capacity: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="o-room">Room</label>
              <input id="o-room" required value={offeringForm.room} onChange={(e) => setOfferingForm({ ...offeringForm, room: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="o-day">Meeting Day</label>
              <select id="o-day" value={offeringForm.dayOfWeek} onChange={(e) => setOfferingForm({ ...offeringForm, dayOfWeek: e.target.value })}>
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="o-start">Start Time</label>
              <input id="o-start" type="time" required value={offeringForm.startTime} onChange={(e) => setOfferingForm({ ...offeringForm, startTime: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="o-end">End Time</label>
              <input id="o-end" type="time" required value={offeringForm.endTime} onChange={(e) => setOfferingForm({ ...offeringForm, endTime: e.target.value })} />
            </div>
          </div>
          <div className="dialog-actions">
            <button type="button" onClick={() => setShowOfferingDialog(false)}>Cancel</button>
            <button type="submit" className="primary">Publish Offering</button>
          </div>
        </form>
      </ModalDialog>

      <ModalDialog open={Boolean(editingOffering)} title="Edit Course Offering" onClose={() => setEditingOffering(null)}>
        {editingOffering ? (
          <form onSubmit={handleSaveOfferingEdit}>
            <p className="mono">{editingOffering.course_code} ({editingOffering.term_name})</p>
            <div className="field">
              <label htmlFor="eo-instr">Instructor</label>
              <select id="eo-instr" value={editingOffering.instructor_id} onChange={(e) => setEditingOffering({ ...editingOffering, instructor_id: e.target.value })}>
                {instructors.map((i) => <option key={i.id} value={i.id}>{i.title} {i.first_name} {i.last_name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="eo-sec">Section</label>
                <input id="eo-sec" required value={editingOffering.section} onChange={(e) => setEditingOffering({ ...editingOffering, section: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="eo-cap">Capacity</label>
                <input id="eo-cap" type="number" min={1} required value={editingOffering.capacity} onChange={(e) => setEditingOffering({ ...editingOffering, capacity: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="eo-room">Room</label>
              <input id="eo-room" required value={editingOffering.room} onChange={(e) => setEditingOffering({ ...editingOffering, room: e.target.value })} />
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setEditingOffering(null)}>Cancel</button>
              <button type="submit" className="primary">Update Offering</button>
            </div>
          </form>
        ) : null}
      </ModalDialog>

      <ModalDialog
        open={Boolean(holdStudent)}
        title={holdStudent ? `Registration Holds — ${holdStudent.student_number}` : 'Academic Holds'}
        onClose={() => {
          setHoldStudent(null);
          setHoldReason('');
        }}
      >
        {holdStudent ? (
          <div>
            <p>
              <strong>{holdStudent.first_name} {holdStudent.last_name}</strong> ({holdStudent.email})
            </p>
            <form onSubmit={handlePlaceHold} style={{ marginBlockEnd: '1rem' }}>
              <div className="field">
                <label htmlFor="hold-reason">Place New Hold Reason</label>
                <input
                  id="hold-reason"
                  required
                  minLength={3}
                  placeholder="e.g. Mandatory academic advising review"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                />
              </div>
              <button type="submit" className="danger">Place Registration Hold</button>
            </form>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {holds.filter((h) => Number(h.student_id) === Number(holdStudent.id)).length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>No holds recorded for this student.</p>
              ) : (
                holds
                  .filter((h) => Number(h.student_id) === Number(holdStudent.id))
                  .map((h) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border)', padding: '0.5rem 0.65rem', borderRadius: '4px' }}>
                      <div>
                        <div>{h.reason}</div>
                        <small className="muted mono">
                          {h.resolved_at ? `Resolved ${new Date(h.resolved_at).toLocaleDateString()}` : 'Active Hold'}
                        </small>
                      </div>
                      {!h.resolved_at ? (
                        <button type="button" className="primary" onClick={() => handleResolveHold(h.id)}>
                          Resolve
                        </button>
                      ) : (
                        <StatusBadge status="completed" label="Resolved" />
                      )}
                    </div>
                  ))
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setHoldStudent(null)}>Close</button>
            </div>
          </div>
        ) : null}
      </ModalDialog>
    </section>
  );
}
