import { useEffect, useId, useRef } from 'react';
import { attachLightDismissFallback } from '../utils/a11y.js';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const detachDismiss = attachLightDismissFallback(dialog);

    const onClose = () => {
      const value = dialog.returnValue;
      dialog.returnValue = '';
      if (value === 'confirm') {
        onConfirm?.();
      } else {
        onCancel?.();
      }
    };

    dialog.addEventListener('close', onClose);
    return () => {
      detachDismiss();
      dialog.removeEventListener('close', onClose);
    };
  }, [onConfirm, onCancel]);

  return (
    <dialog ref={dialogRef} closedby="any" aria-labelledby={titleId}>
      <h1 id={titleId}>{title}</h1>
      <p>{message}</p>
      <form method="dialog" className="dialog-actions">
        <button type="submit" value="cancel" autoFocus={destructive}>
          {cancelLabel}
        </button>
        <button
          type="submit"
          value="confirm"
          className={destructive ? 'danger' : 'primary'}
          autoFocus={!destructive}
        >
          {confirmLabel}
        </button>
      </form>
    </dialog>
  );
}
