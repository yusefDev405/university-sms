import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { attachAccessibleFormValidation } from '../utils/a11y.js';
import { ModalDialog } from './ModalDialog.jsx';

export function SecurityDialog({ open, user, onClose, notify, onPasswordChanged, onUserRefresh }) {
  const [section, setSection] = useState('password');
  const formRef = useRef(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  useEffect(() => {
    if (!open || section !== 'password' || !formRef.current) return undefined;
    return attachAccessibleFormValidation(formRef.current);
  }, [open, section]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await apiRequest('/me/sessions');
      setSessions(res.data || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (open && section === 'sessions') {
      loadSessions();
    }
  }, [open, section, loadSessions]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formRef.current.checkValidity()) {
      formRef.current.querySelector(':invalid')?.focus();
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/me/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword }
      });
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated. Please sign in again.', 'success');
      onClose();
      onPasswordChanged?.();
    } catch (err) {
      setError(err.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeOthers = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/me/sessions/revoke-others', { method: 'POST' });
      notify(`Revoked ${res.data.revokedCount} other session token(s).`, 'success');
      await loadSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStart2fa = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await apiRequest('/me/2fa/setup', { method: 'POST' });
      setTotpSetup(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEnable2fa = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/me/2fa/enable', { method: 'POST', body: { code: totpCode } });
      setTotpSetup(null);
      setTotpCode('');
      notify('Two-Factor Authentication (TOTP) enabled.', 'success');
      await onUserRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDisable2fa = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await apiRequest('/me/2fa/disable', { method: 'POST', body: { password: disablePassword } });
      setDisablePassword('');
      notify('Two-Factor Authentication disabled.', 'info');
      await onUserRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog open={open} title="Account Security & Active Sessions" onClose={onClose}>
      <div className="tablist" role="tablist" aria-label="Security settings">
        {[
          { id: 'password', label: 'Password' },
          { id: 'sessions', label: 'Active Sessions' },
          { id: '2fa', label: '2FA (TOTP)' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={section === tab.id}
            onClick={() => { setSection(tab.id); setError(''); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {section === 'password' ? (
        <form ref={formRef} onSubmit={handlePasswordSubmit} noValidate>
          <div className="field">
            <label htmlFor="cp-current">Current Password</label>
            <input
              id="cp-current"
              type="password"
              required
              autoComplete="current-password"
              data-error="cp-current-err"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div id="cp-current-err" className="error-msg">Enter your current password.</div>
          </div>

          <div className="field">
            <label htmlFor="cp-new">New Password</label>
            <ul id="cp-rules" className="rules-list">
              <li>At least 8 characters</li>
              <li>Uppercase, lowercase, number, and symbol</li>
            </ul>
            <input
              id="cp-new"
              type="password"
              required
              minLength={8}
              pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}"
              autoComplete="new-password"
              aria-describedby="cp-rules"
              data-error="cp-new-err"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div id="cp-new-err" className="error-msg">Meet all listed password rules.</div>
          </div>

          <div className="dialog-actions">
            <button type="button" onClick={onClose}>Close</button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      ) : null}

      {section === 'sessions' ? (
        <div>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Active refresh token families bound to your account:
          </p>
          {loadingSessions ? (
            <p className="muted">Loading active sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="muted">No persistent browser sessions recorded.</p>
          ) : (
            <ul className="compact-list">
              {sessions.map((s) => (
                <li key={s.family_id} className="compact-list-item">
                  <div>
                    <div className="mono" style={{ fontSize: '0.82rem' }}>
                      {s.family_id.slice(0, 8)}… {s.is_current ? ' (Current Device)' : ''}
                    </div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {s.user_agent || 'HTTP Client'} • {s.ip_address || 'local'} • Expires {String(s.expires_at).slice(0, 10)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>Close</button>
            <button type="button" className="danger" disabled={saving} onClick={handleRevokeOthers}>
              Sign out all other devices
            </button>
          </div>
        </div>
      ) : null}

      {section === '2fa' ? (
        <div>
          <p className="muted" style={{ fontSize: '0.88rem' }}>
            Two-Factor Authentication protects sign-in with an RFC 6238 authenticator app (6-digit TOTP).
          </p>
          {user?.totp_enabled ? (
            <form onSubmit={handleDisable2fa}>
              <div className="banner banner--info">2FA is currently ENABLED for {user.email}.</div>
              <div className="field">
                <label htmlFor="disable-2fa-pass">Confirm Password to Disable 2FA</label>
                <input
                  id="disable-2fa-pass"
                  type="password"
                  required
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </div>
              <div className="dialog-actions">
                <button type="button" onClick={onClose}>Close</button>
                <button type="submit" className="danger" disabled={saving}>Disable 2FA</button>
              </div>
            </form>
          ) : !totpSetup ? (
            <div>
              <p>Status: <strong>Not enabled</strong></p>
              <div className="dialog-actions">
                <button type="button" onClick={onClose}>Close</button>
                <button type="button" className="primary" disabled={saving} onClick={handleStart2fa}>
                  Generate Authenticator Secret
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEnable2fa}>
              <div className="panel" style={{ marginBlockEnd: '0.8rem' }}>
                <div className="stat-label">Secret Key (Base32)</div>
                <div className="mono" style={{ fontWeight: 600, wordBreak: 'break-all' }}>{totpSetup.secret}</div>
                <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem', wordBreak: 'break-all' }}>
                  {totpSetup.otpauthUri}
                </div>
              </div>
              <div className="field">
                <label htmlFor="totp-verify-code">Enter 6-Digit Verification Code</label>
                <input
                  id="totp-verify-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  required
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                />
              </div>
              <div className="dialog-actions">
                <button type="button" onClick={() => setTotpSetup(null)}>Cancel</button>
                <button type="submit" className="primary" disabled={saving}>Verify & Enable 2FA</button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </ModalDialog>
  );
}
