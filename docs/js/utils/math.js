export function clamp(value, min, max) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : safeMin;
  const safeValue = Number.isFinite(value) ? value : safeMin;
  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

export function normalizePosition(value, min, max) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : safeMin;
  const safeValue = Number.isFinite(value) ? value : safeMin;
  if (safeMax <= safeMin) return 0;
  return (safeValue - safeMin) / (safeMax - safeMin);
}

export function denormalizePosition(ratio, min, max) {
  const safeRatio = Number.isFinite(ratio) ? ratio : 0;
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : safeMin;
  if (safeMax <= safeMin) return safeMin;
  return safeMin + safeRatio * (safeMax - safeMin);
}
