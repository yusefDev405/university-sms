/**
 * Accessibility & progressive enhancement helpers from modern-web-guidance:
 * - accessible-error-announcement / validate-input-after-interaction
 * - persistent-toast-notifications (ariaNotify with live-region fallback)
 * - dialog (closedby="any" Safari pointer fallback)
 */

let announcerEl = null;
let announceTimer = null;
let announcedField = null;
const flagged = new WeakSet();
const announced = new WeakSet();

function getAnnouncer() {
  if (!announcerEl && typeof document !== 'undefined') {
    announcerEl = document.createElement('div');
    announcerEl.setAttribute('aria-live', 'polite');
    announcerEl.className = 'visually-hidden';
    document.body.append(announcerEl);
  }
  return announcerEl;
}

export function announcePolite(message) {
  if (typeof navigator !== 'undefined' && typeof document !== 'undefined' && typeof document.ariaNotify === 'function') {
    document.ariaNotify(message);
    return;
  }
  const region = getAnnouncer();
  if (!region) return;
  clearTimeout(announceTimer);
  region.textContent = '';
  announceTimer = setTimeout(() => {
    region.textContent = message;
  }, 60);
}

function linkError(el, shown) {
  const errorId = el.dataset?.error;
  if (!errorId) return;
  const ids = (el.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}

function spokenText(node) {
  const copy = node.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
    n.replaceWith(`${n.getAttribute('aria-label')}: `);
  });
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

export function attachAccessibleFormValidation(formEl) {
  if (!formEl) return () => {};

  const supportsUserInvalid = typeof CSS !== 'undefined' && CSS.supports?.('selector(:user-invalid)');
  const dirtyState = new WeakMap();

  const syncAria = (el, announce = false) => {
    if (!el?.matches?.('input, select, textarea')) return;
    const isInvalid = supportsUserInvalid
      ? el.matches(':user-invalid')
      : Boolean(dirtyState.get(el)?.hasBlurred && !el.validity.valid);

    if (!supportsUserInvalid && dirtyState.get(el)?.hasBlurred) {
      el.classList.toggle('user-invalid-fallback', !el.validity.valid);
      el.classList.toggle('user-valid-fallback', el.validity.valid);
    }

    if (isInvalid) {
      if (announce && !announced.has(el)) {
        const errNode = document.getElementById(el.dataset.error);
        if (errNode) {
          const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
          const region = getAnnouncer();
          clearTimeout(announceTimer);
          region.textContent = '';
          announcedField = el;
          announceTimer = setTimeout(() => {
            region.textContent = label + spokenText(errNode);
          }, 500);
        }
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el && announcerEl) {
        clearTimeout(announceTimer);
        announcerEl.textContent = '';
      }
    }
  };

  formEl.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.hasAttribute('aria-invalid')) el.setAttribute('aria-invalid', 'false');
  });

  const onBlur = (e) => {
    const state = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
    state.hasBlurred = true;
    dirtyState.set(e.target, state);
    syncAria(e.target, true);
  };

  const onInput = (e) => {
    const state = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
    state.hasInteracted = true;
    dirtyState.set(e.target, state);
    if (e.target.hasAttribute('aria-invalid')) syncAria(e.target, false);
  };

  const onChange = (e) => syncAria(e.target, true);

  const onInvalid = (e) => {
    dirtyState.set(e.target, { hasInteracted: true, hasBlurred: true });
    announced.add(e.target);
    syncAria(e.target, false);
  };

  formEl.addEventListener('blur', onBlur, true);
  formEl.addEventListener('input', onInput);
  formEl.addEventListener('change', onChange, true);
  formEl.addEventListener('invalid', onInvalid, true);

  return () => {
    formEl.removeEventListener('blur', onBlur, true);
    formEl.removeEventListener('input', onInput);
    formEl.removeEventListener('change', onChange, true);
    formEl.removeEventListener('invalid', onInvalid, true);
  };
}

export function attachLightDismissFallback(dialogEl) {
  if (!dialogEl || 'closedBy' in HTMLDialogElement.prototype) return () => {};
  const outside = (e) => {
    const r = dialogEl.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  const onDown = (e) => {
    pressedOutside = outside(e);
  };
  const onUp = (e) => {
    if (pressedOutside && outside(e)) dialogEl.close();
  };
  dialogEl.addEventListener('pointerdown', onDown);
  dialogEl.addEventListener('pointerup', onUp);
  return () => {
    dialogEl.removeEventListener('pointerdown', onDown);
    dialogEl.removeEventListener('pointerup', onUp);
  };
}
