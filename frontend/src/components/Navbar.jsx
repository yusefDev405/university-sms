import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n.js';

export function Navbar({
  user,
  navItems,
  activePage,
  onNavigate,
  onOpenSecurity,
  onLogout,
  theme,
  onToggleTheme,
  lang = 'en',
  onToggleLang,
  notifications = [],
  onMarkNotificationRead
}) {
  const headerRef = useRef(null);
  const innerRef = useRef(null);
  const menuRef = useRef(null);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const header = headerRef.current;
    const inner = innerRef.current;
    const menu = menuRef.current;
    if (!header || !inner || !menu) return;

    let lastMeasuredWidth = 0;

    const measure = () => {
      const wasOpen = menu.matches(':popover-open');
      header.classList.add('is-measuring');
      header.classList.add('is-wide');
      menu.removeAttribute('popover');

      const fits = inner.scrollWidth <= inner.clientWidth;
      setIsWide(fits);

      if (fits) {
        header.classList.add('is-wide');
        menu.removeAttribute('popover');
      } else {
        header.classList.remove('is-wide');
        menu.setAttribute('popover', 'auto');
        if (wasOpen && typeof menu.showPopover === 'function') {
          try {
            menu.showPopover();
          } catch {
            // ignore
          }
        }
      }

      lastMeasuredWidth = header.clientWidth;
      requestAnimationFrame(() => header.classList.remove('is-measuring'));
    };

    measure();

    const ro = new ResizeObserver(() => {
      const currentWidth = header.clientWidth;
      if (header.classList.contains('is-wide') || currentWidth > lastMeasuredWidth) {
        measure();
      }
    });
    ro.observe(header);
    ro.observe(menu);

    return () => ro.disconnect();
  }, [navItems.length, lang]);

  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.supports?.('container-type', 'scroll-state')) {
      return undefined;
    }
    const bar = headerRef.current;
    if (!bar) return undefined;
    let lastY = window.scrollY;
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const y = Math.max(0, Math.min(window.scrollY, maxScroll));
      if (y === lastY) return;
      bar.classList.toggle('is-hidden', y > lastY && y > bar.offsetHeight);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLinkClick = (id) => {
    onNavigate(id);
    if (!isWide && menuRef.current?.matches(':popover-open')) {
      menuRef.current.hidePopover?.();
    }
  };

  return (
    <header ref={headerRef} className="site-header no-print">
      <div ref={innerRef} className="container header-inner">
        <a
          href="#top"
          className="site-brand"
          onClick={(e) => {
            e.preventDefault();
            onNavigate(navItems[0]?.id);
          }}
        >
          <span className="brand-crest" aria-hidden="true">G</span>
          <span className="brand-text">
            <span className="brand-title">{t(lang, 'brandTitle')}</span>
            <span className="brand-sub">{t(lang, 'brandSub')}</span>
          </span>
        </a>

        <nav className="site-nav" aria-label="Primary">
          <button
            className="menu-button"
            type="button"
            popoverTarget="site-menu"
            popoverTargetAction="toggle"
            aria-controls="site-menu"
          >
            <span aria-hidden="true">☰</span>
            <span>{t(lang, 'menu')}</span>
          </button>

          <ul ref={menuRef} id="site-menu" className="site-menu">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="nav-link"
                  aria-current={activePage === item.id ? 'page' : undefined}
                  onClick={() => handleLinkClick(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <span className="role-pill" title={user.email}>
            {user.role === 'instructor' && user.profile?.is_chair ? 'chair' : user.role}
          </span>
          <button
            type="button"
            className="ghost notif-trigger"
            popoverTarget="notif-popover"
            popoverTargetAction="toggle"
            aria-label={`Notifications (${notifications.filter((n) => !n.read_at).length} unread)`}
          >
            {t(lang, 'inbox')} ({notifications.filter((n) => !n.read_at).length})
          </button>
          <div id="notif-popover" popover="auto" className="notif-popover" aria-label="Notification inbox">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: '0.5rem' }}>
              <strong>Notifications</strong>
              <button type="button" className="ghost" popoverTarget="notif-popover" popoverTargetAction="hide">
                Close
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="notif-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '0.86rem' }}>{n.title}</strong>
                    {!n.read_at ? (
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '0.1rem 0.35rem', minBlockSize: 'auto', fontSize: '0.76rem' }}
                        onClick={() => onMarkNotificationRead?.(n.id)}
                      >
                        Mark read
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: '0.75rem' }}>Read</span>
                    )}
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>{n.message}</p>
                </div>
              ))
            )}
          </div>
          <button type="button" className="ghost" onClick={onOpenSecurity}>
            {t(lang, 'security')}
          </button>
          {onToggleLang ? (
            <button
              type="button"
              className="ghost"
              onClick={onToggleLang}
              aria-label="Toggle language and layout direction"
            >
              {lang === 'ar' ? 'EN' : 'العربية'}
            </button>
          ) : null}
          <button
            type="button"
            className="ghost"
            onClick={onToggleTheme}
            aria-label={`Switch theme (current: ${theme})`}
            title={`Theme: ${theme}`}
          >
            {theme === 'dark' ? 'Light' : theme === 'light' ? 'Auto' : 'Dark'}
          </button>
          <button type="button" onClick={onLogout}>
            {t(lang, 'signOut')}
          </button>
        </div>
      </div>
    </header>
  );
}
