import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client.js';
import { attachAccessibleFormValidation } from '../utils/a11y.js';
import { ModalDialog } from './ModalDialog.jsx';

export function ChangePasswordDialog({ open, onClose, notify, onPasswordChanged }) {
  const formRef = useRef(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !formRef.current) return undefined;
    return attachAccessibleFormValidation(formRef.current);
  }, [open]);

  const handleSubmit = async (e) => {
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
      notify('Password updated. Please sign in again with your new password.', 'success');
      onClose();
      onPasswordChanged?.();
    } catch (err) {
      setError(err.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog open={open} title="Change Account Password" onClose={onClose}>
      {error ? (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
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
          <div id="cp-current-err" className="error-msg">
            <span role="img" aria-label="Error">!</span> Enter your current password.
          </div>
        </div>

        <div className="field">
          <label htmlFor="cp-new">New Password</label>
          <ul id="cp-rules" className="rules-list">
            <li>At least 8 characters</li>
            <li>One uppercase letter and one lowercase letter</li>
            <li>One number and one special character</li>
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
          <div id="cp-new-err" className="error-msg">
            <span role="img" aria-label="Error">!</span> Password must meet all listed complexity requirements.
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
