export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function create(tag, className = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (char) => HTML_ESCAPE_MAP[char]);
}

export function normalizeHexColor(value, fallback = "#FFFFFF") {
  const candidate = String(value ?? "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate)) return candidate.toUpperCase();
  return fallback;
}

export function escapeCssAttrValue(value) {
  const text = String(value ?? "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(text);
  }
  return text.replace(/["\\]/g, "\\$&");
}
