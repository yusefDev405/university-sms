import { useEffect, useId, useRef } from 'react';
import { attachLightDismissFallback } from '../utils/a11y.js';

export function ModalDialog({ open, title, onClose, children }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const detachDismiss = attachLightDismissFallback(dialog);
    const handleClose = () => {
      dialog.returnValue = '';
      onClose?.();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      detachDismiss();
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  return (
    <dialog ref={dialogRef} closedby="any" aria-labelledby={titleId}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBlockEnd: '0.75rem' }}>
        <h1 id={titleId} style={{ margin: 0 }}>{title}</h1>
        <button type="button" className="ghost" aria-label="Close dialog" onClick={() => dialogRef.current?.close()}>
          ×
        </button>
      </div>
      {open ? children : null}
    </dialog>
  );
}
