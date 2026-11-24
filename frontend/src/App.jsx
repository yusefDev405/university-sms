import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, refreshSession, setAccessToken, setOnUnauthorized } from './api/client.js';
import { Navbar } from './components/Navbar.jsx';
import { SecurityDialog } from './components/SecurityDialog.jsx';
import { ToastRegion } from './components/ToastRegion.jsx';
import { t } from './i18n.js';
import { AdminPage } from './pages/admin/AdminPage.jsx';
import { AdvisingPage } from './pages/instructor/AdvisingPage.jsx';
import { InstructorOfferingsPage } from './pages/instructor/InstructorOfferingsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { CataloguePage } from './pages/student/CataloguePage.jsx';
import { CourseworkPage } from './pages/student/CourseworkPage.jsx';
import { PetitionsFinancePage } from './pages/student/PetitionsFinancePage.jsx';
import { SchedulePage } from './pages/student/SchedulePage.jsx';
import { TranscriptPage } from './pages/student/TranscriptPage.jsx';

function buildNavItems(role, lang) {
  if (role === 'student') {
    return [
      { id: 'catalogue', label: t(lang, 'navCatalogue') },
      { id: 'schedule', label: t(lang, 'navSchedule') },
      { id: 'coursework', label: t(lang, 'navCoursework') },
      { id: 'transcript', label: t(lang, 'navTranscript') },
      { id: 'petitions-finance', label: t(lang, 'navPetitionsFinance') }
    ];
  }
  if (role === 'instructor') {
    return [
      { id: 'instructor-offerings', label: t(lang, 'navInstructorOfferings') },
      { id: 'advising', label: t(lang, 'navAdvising') }
    ];
  }
  if (role === 'admin') {
    return [{ id: 'admin-console', label: t(lang, 'navAdminConsole') }];
  }
  return [];
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [activePage, setActivePage] = useState('');
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('usms-theme') || 'auto');
  const [lang, setLang] = useState(() => localStorage.getItem('usms-lang') || 'en');

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiRequest('/me/notifications');
      setNotifications(res.data || []);
    } catch {
      // ignore if session closed
    }
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await apiRequest('/me');
      if (res.data) setUser(res.data);
    } catch {
      // ignore
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

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('usms-lang', lang);
  }, [lang]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'auto' ? 'dark' : prev === 'dark' ? 'light' : 'auto'));
  };

  const toggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const notify = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((tItem) => tItem.id !== id));
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
          setActivePage(buildNavItems(refreshed.user.role, lang)[0]?.id || '');
          await loadNotifications();
        }
      } finally {
        setBooting(false);
      }
    })();
  }, [loadNotifications]);

  const navItems = useMemo(() => (user ? buildNavItems(user.role, lang) : []), [user, lang]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActivePage(buildNavItems(loggedInUser.role, lang)[0]?.id || '');
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
      // ignore
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
        onOpenSecurity={() => setShowSecurityDialog(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        lang={lang}
        onToggleLang={toggleLang}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
      />

      <main className="container main-content" id="top">
        {user.role === 'student' && activePage === 'catalogue' ? <CataloguePage notify={notify} /> : null}
        {user.role === 'student' && activePage === 'schedule' ? <SchedulePage notify={notify} /> : null}
        {user.role === 'student' && activePage === 'coursework' ? <CourseworkPage notify={notify} /> : null}
        {user.role === 'student' && activePage === 'transcript' ? <TranscriptPage notify={notify} /> : null}
        {user.role === 'student' && activePage === 'petitions-finance' ? <PetitionsFinancePage notify={notify} /> : null}
        {user.role === 'instructor' && activePage !== 'advising' ? <InstructorOfferingsPage notify={notify} /> : null}
        {user.role === 'instructor' && activePage === 'advising' ? <AdvisingPage user={user} notify={notify} /> : null}
        {user.role === 'admin' ? <AdminPage notify={notify} /> : null}
      </main>

      <SecurityDialog
        open={showSecurityDialog}
        user={user}
        onClose={() => setShowSecurityDialog(false)}
        notify={notify}
        onPasswordChanged={handleLogout}
        onUserRefresh={refreshMe}
      />

      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
