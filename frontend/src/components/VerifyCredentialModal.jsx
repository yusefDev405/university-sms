import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { ModalDialog } from './ModalDialog.jsx';
import { StatusBadge } from './StatusBadge.jsx';

export function VerifyCredentialModal({ open, onClose }) {
  const [code, setCode] = useState('GAL-2027-CS-2024003');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await apiRequest(`/verify/${encodeURIComponent(code.trim())}`);
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Public Official Credential Verification" onClose={onClose}>
      <p className="muted" style={{ fontSize: '0.88rem' }}>
        Employers and institutions can verify conferred Galala University degrees without signing in.
      </p>
      <form onSubmit={handleVerify}>
        <div className="field">
          <label htmlFor="verify-code-input">Credential Verification Code</label>
          <input
            id="verify-code-input"
            type="text"
            required
            placeholder="e.g. GAL-2027-CS-2024003"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div className="dialog-actions" style={{ marginBlockStart: '0.5rem' }}>
          <button type="button" onClick={onClose}>Close</button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify Credential'}
          </button>
        </div>
      </form>

      {error ? (
        <div className="banner banner--error" role="alert" style={{ marginTop: '0.9rem' }}>
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="verification-seal" role="status" style={{ marginTop: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <strong>Official Registrar Record</strong>
            <StatusBadge status={result.status} />
          </div>
          <div className="mono" style={{ fontSize: '0.86rem' }}>
            Code: {result.verification_code}
          </div>
          <p style={{ margin: '0.35rem 0 0' }}>
            <strong>{result.first_name} {result.last_name}</strong> ({result.student_number})<br />
            Program: {result.department_name} ({result.department_code})<br />
            Term: {result.target_term} • Credits Verified: <span className="tabular">{result.credits_verified}</span>
            {result.gpa_verified !== null ? ` • Verified GPA: ${Number(result.gpa_verified).toFixed(2)}` : ''}
          </p>
          {result.decision_note ? (
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>{result.decision_note}</p>
          ) : null}
        </div>
      ) : null}
    </ModalDialog>
  );
}
