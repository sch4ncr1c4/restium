import { OPEN_MODAL_CLASS, CLOSED_MODAL_CLASS } from "../config.js";

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

function setupModalA11y(modal, options = {}) {
  if (!modal || modal.dataset.modalA11yReady === "true") return;
  const panel = options.panel || modal.querySelector(":scope > div");
  const title = options.title || (panel ? panel.querySelector("h1, h2, h3, h4") : null);
  if (title && !title.id) title.id = `${modal.id || "modal"}Title`;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  if (title && title.id) modal.setAttribute("aria-labelledby", title.id);
  modal.__modalPanel = panel || null;
  modal.dataset.modalA11yReady = "true";
}

function trapFocusInModal(modal, event) {
  if (event.key !== "Tab") return;
  const container = modal.__modalPanel || modal;
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  const activeInside = active instanceof HTMLElement && container.contains(active);
  if (!activeInside) {
    event.preventDefault();
    if (event.shiftKey) {
      last.focus();
    } else {
      first.focus();
    }
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initModalCore(state) {
  document.addEventListener(
    "keydown",
    (event) => {
      if (state.modalStack.length === 0) return;
      const activeModal = state.modalStack[state.modalStack.length - 1];
      if (!activeModal || activeModal.classList.contains("hidden")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (activeModal.id === "orderModal") {
          const now = Date.now();
          const armedUntil = Number(activeModal.__escArmedUntil || 0);
          if (!armedUntil || now > armedUntil) {
            activeModal.__escArmedUntil = now + 1200;
            return;
          }
          activeModal.__escArmedUntil = 0;
        }
        if (document.activeElement && typeof document.activeElement.blur === "function") {
          document.activeElement.blur();
        }
        closeModal(state, activeModal, { restoreFocus: false });
        return;
      }
      trapFocusInModal(activeModal, event);
    },
    true,
  );
}

export function openModal(state, modal, options = {}) {
  if (!modal) return;
  setupModalA11y(modal, options);
  const timer = state.modalCloseTimers.get(modal);
  if (timer) {
    clearTimeout(timer);
    state.modalCloseTimers.delete(modal);
  }
  if (!state.modalStack.includes(modal)) {
    modal.__restoreFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.modalStack.push(modal);
  }
  modal.__escArmedUntil = 0;

  const panel = options.panel || modal.__modalPanel;
  if (panel) {
    panel.classList.add("transition-all", "duration-200", "opacity-0", "scale-95", "translate-y-2");
    panel.classList.remove("opacity-100", "scale-100", "translate-y-0");
  }
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add(CLOSED_MODAL_CLASS);
  modal.classList.remove(OPEN_MODAL_CLASS);
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  requestAnimationFrame(() => {
    modal.classList.add(OPEN_MODAL_CLASS);
    modal.classList.remove(CLOSED_MODAL_CLASS);
    if (panel) {
      panel.classList.remove("opacity-0", "scale-95", "translate-y-2");
      panel.classList.add("opacity-100", "scale-100", "translate-y-0");
    }
    const focusables = getFocusableElements(panel || modal);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      (panel || modal).setAttribute("tabindex", "-1");
      (panel || modal).focus();
    }
  });
}

export function closeModal(state, modal, options = {}) {
  if (!modal) return;
  const panel = options.panel || modal.__modalPanel;
  const restoreFocus = options.restoreFocus !== false;

  const activeEl = document.activeElement;
  if (activeEl instanceof HTMLElement && modal.contains(activeEl)) {
    activeEl.blur();
  }

  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove(OPEN_MODAL_CLASS);
  modal.classList.add(CLOSED_MODAL_CLASS);
  if (panel) {
    panel.classList.remove("opacity-100", "scale-100", "translate-y-0");
    panel.classList.add("opacity-0", "scale-95", "translate-y-2");
  }

  const idx = state.modalStack.lastIndexOf(modal);
  if (idx !== -1) state.modalStack.splice(idx, 1);

  const timer = setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (typeof modal.__onClose === "function") modal.__onClose();
    if (restoreFocus && modal.__restoreFocusTarget && typeof modal.__restoreFocusTarget.focus === "function") {
      modal.__restoreFocusTarget.focus();
    }
  }, 200);

  state.modalCloseTimers.set(modal, timer);
}
