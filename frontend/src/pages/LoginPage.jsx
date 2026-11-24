import { useEffect, useRef, useState } from 'react';
import { apiRequest, setAccessToken } from '../api/client.js';
import { VerifyCredentialModal } from '../components/VerifyCredentialModal.jsx';
import { attachAccessibleFormValidation } from '../utils/a11y.js';

const DEMO_ACCOUNTS = [
  { label: 'Student (Nadia Mansour)', email: 'nadia.mansour@galala.edu.eg', pass: 'Student123!' },
  { label: 'Chair & Instructor (Prof. Amina Darwish)', email: 'amina.darwish@galala.edu.eg', pass: 'Instructor123!' },
  { label: 'Admin (Registrar)', email: 'admin@galala.edu.eg', pass: 'AdminPass123!' }
];

export function LoginPage({ onSuccess }) {
  const formRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    return attachAccessibleFormValidation(formRef.current);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!formRef.current.checkValidity()) {
      formRef.current.querySelector(':invalid')?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const payload = { email, password };
      if (totpCode.trim()) payload.totpCode = totpCode.trim();
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: payload
      });
      setAccessToken(res.data.accessToken);
      onSuccess(res.data.user);
    } catch (err) {
      if (err.code === 'TOTP_REQUIRED') {
        setNeedsTotp(true);
        setServerError('Two-factor authentication is enabled on this account. Enter your 6-digit authenticator code.');
      } else {
        setServerError(err.message || 'Sign in failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-layout">
      <section className="login-card" aria-labelledby="login-heading">
        <div className="page-kicker">Galala University ICT</div>
        <h1 id="login-heading">Academic Registry Sign In</h1>
        <p className="muted">
          Access course registration, gradebook, official transcripts, finance ledger, and degree verification.
        </p>

        {serverError ? (
          <div className="banner banner--error" role="alert">
            <span>
              <span aria-hidden="true">! </span>
              {serverError}
            </span>
          </div>
        ) : null}

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">University Email</label>
            <span id="email-hint" className="hint">
              Format: name@galala.edu.eg
            </span>
            <input
              type="email"
              id="email"
              name="email"
              required
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              aria-describedby="email-hint"
              data-error="email-error"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div id="email-error" className="error-msg">
              <span role="img" aria-label="Error">!</span> Enter a valid university email address.
            </div>
          </div>

          <div className="field">
            <label htmlFor="current-password">Password</label>
            <div className="password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="current-password"
                name="password"
                required
                minLength={8}
                autoComplete="current-password"
                enterKeyHint={needsTotp ? 'next' : 'done'}
                data-error="password-error"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div id="password-error" className="error-msg">
              <span role="img" aria-label="Error">!</span> Enter your password (minimum 8 characters).
            </div>
          </div>

          {needsTotp ? (
            <div className="field">
              <label htmlFor="login-totp">Authenticator Code (6 digits)</label>
              <input
                id="login-totp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                required
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            </div>
          ) : null}

          <button type="submit" className="primary" style={{ inlineSize: '100%' }} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '0.85rem' }}>
          <button type="button" style={{ inlineSize: '100%' }} onClick={() => setShowVerify(true)}>
            Verify Official Credential
          </button>
        </div>

        <details className="demo-drawer">
          <summary>Demo accounts for evaluation</summary>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(acc.pass);
                  setNeedsTotp(false);
                  setTotpCode('');
                  setServerError('');
                }}
              >
                Use {acc.label}
              </button>
            ))}
          </div>
        </details>
      </section>

      <VerifyCredentialModal open={showVerify} onClose={() => setShowVerify(false)} />
    </main>
  );
}
