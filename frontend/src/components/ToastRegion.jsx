import { useEffect, useRef } from 'react';
import { announcePolite } from '../utils/a11y.js';

function ToastItem({ toast, onDismiss }) {
  const elRef = useRef(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;
    // Suppress toast in background if a modal dialog is currently open
    if (document.querySelector('dialog:modal')) return undefined;

    el.setAttribute('popover', 'manual');
    if (typeof el.showPopover === 'function') {
      try {
        el.showPopover();
      } catch {
        el.classList.add(':popover-open');
      }
    } else {
      el.classList.add(':popover-open');
    }

    announcePolite(toast.message);

    const timer = setTimeout(() => {
      if (el && !el.contains(document.activeElement)) {
        onDismiss(toast.id);
      }
    }, 5500);

    return () => {
      clearTimeout(timer);
      if (typeof el.hidePopover === 'function') {
        try {
          el.hidePopover();
        } catch {
          // ignore
        }
      }
    };
  }, [toast.id, toast.message, onDismiss]);

  return (
    <div
      ref={elRef}
      id={`toast-${toast.id}`}
      className={`toast-item toast-item--${toast.tone || 'info'}`}
      role="status"
    >
      <div>
        <strong>{toast.tone === 'error' ? 'Notice: ' : toast.tone === 'success' ? 'Done: ' : ''}</strong>
        <span>{toast.message}</span>
      </div>
      <button
        type="button"
        className="ghost"
        aria-label="Close notification"
        popoverTarget={`toast-${toast.id}`}
        popoverTargetAction="hide"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

export function ToastRegion({ toasts, onDismiss }) {
  return (
    <div role="region" aria-label="Notifications" className="toast-region no-print">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
