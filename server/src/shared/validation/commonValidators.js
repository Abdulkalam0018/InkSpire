export function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

export function normalizeLobbyId(value) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

export function normalizeNonEmptyString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}
