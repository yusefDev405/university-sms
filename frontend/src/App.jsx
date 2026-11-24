import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, refreshSession, setAccessToken, setOnUnauthorized } from './api/client.js';
import { ChangePasswordDialog } from './components/ChangePasswordDialog.jsx';
import { Navbar } from './components/Navbar.jsx';
import { ToastRegion } from './components/ToastRegion.jsx';
import { AdminPage } from './pages/admin/AdminPage.jsx';
import { InstructorOfferingsPage } from './pages/instructor/InstructorOfferingsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { CataloguePage } from './pages/student/CataloguePage.jsx';
import { SchedulePage } from './pages/student/SchedulePage.jsx';
import { TranscriptPage } from './pages/student/TranscriptPage.jsx';

const NAV_BY_ROLE = {
  student: [
    { id: 'catalogue', label: 'Course Catalogue' },
    { id: 'schedule', label: 'My Schedule' },
    { id: 'transcript', label: 'Transcript & GPA' }
  ],
  instructor: [
    { id: 'instructor-offerings', label: 'My Offerings & Grading' }
  ],
  admin: [
    { id: 'admin-console', label: 'Operations Console' }
  ]
};

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [activePage, setActivePage] = useState('');
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('usms-theme') || 'auto');

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiRequest('/me/notifications');
      setNotifications(res.data || []);
    } catch {
      // ignore if session closed
    }
  }, []);

  useEffect(() => {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('usms-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('usms-theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'auto' ? 'dark' : prev === 'dark' ? 'light' : 'auto'));
  };

  const notify = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      setAccessToken(null);
    });

    (async () => {
      try {
        const refreshed = await refreshSession();
        if (refreshed?.user) {
          setUser(refreshed.user);
          setActivePage(NAV_BY_ROLE[refreshed.user.role]?.[0]?.id || '');
          await loadNotifications();
        }
      } finally {
        setBooting(false);
      }
    })();
  }, [loadNotifications]);

  const navItems = useMemo(() => (user ? NAV_BY_ROLE[user.role] || [] : []), [user]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActivePage(NAV_BY_ROLE[loggedInUser.role]?.[0]?.id || '');
    loadNotifications();
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await apiRequest(`/me/notifications/${id}/read`, { method: 'PATCH' });
      await loadNotifications();
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // clear local state even if cookie already expired
    }
    setAccessToken(null);
    setUser(null);
    setActivePage('');
  };

  if (booting) {
    return (
      <main className="login-layout">
        <p className="muted" role="status">Restoring academic session…</p>
      </main>
    );
  }

  if (!user) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        navItems={navItems}
        activePage={activePage}
        onNavigate={setActivePage}
        onOpenPassword={() => setShowPasswordDialog(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
      />

      <main className="container main-content" id="top">
        {user.role === 'student' && activePage === 'catalogue' ? <CataloguePage notify={notify} /> : null}
        {user.role === 'student' && activePage === 'schedule' ? <SchedulePage notify={notify} /> : null}
        {user.role === 'student' && activePage === 'transcript' ? <TranscriptPage notify={notify} /> : null}
        {user.role === 'instructor' ? <InstructorOfferingsPage notify={notify} /> : null}
        {user.role === 'admin' ? <AdminPage notify={notify} /> : null}
      </main>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        notify={notify}
        onPasswordChanged={handleLogout}
      />

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
