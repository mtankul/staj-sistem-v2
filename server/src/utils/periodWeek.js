// server/src/utils/periodWeek.js
export function toInt(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function examInfo(period, weekNo) {
  const w = toInt(weekNo, null);
  if (!w) return null;

  const mid = toInt(period?.midtermWeek, null);
  const f1 = toInt(period?.finalWeek1, null);
  const f2 = toInt(period?.finalWeek2, null);

  if (mid != null && w === mid) return { code: "MIDTERM", label: "Vize haftası" };
  if (f1 != null && w === f1) return { code: "FINAL", label: "Final haftası" };
  if (f2 != null && w === f2) return { code: "FINAL2", label: "Final haftası" };

  return null;
}

/** Sadece period ayarlarına göre rotasyon (sınav haftası => null) */
export function rotationByWeek(period, weekNo) {
  const w = toInt(weekNo, null);
  if (!w) return null;
  if (examInfo(period, w)) return null;

  const r1s = toInt(period?.rot1StartWeek, null);
  const r1e = toInt(period?.rot1EndWeek, null);
  const r2s = toInt(period?.rot2StartWeek, null);
  const r2e = toInt(period?.rot2EndWeek, null);

  if (r1s != null && r1e != null && w >= r1s && w <= r1e) return 1;
  if (r2s != null && r2e != null && w >= r2s && w <= r2e) return 2;

  return null;
}

/** Uygulama açık mı? (sınav değil + ilgili rotasyon aralığında) */
export function isPracticeOpen(period, rotationNo, weekNo) {
  const w = toInt(weekNo, null);
  const rot = toInt(rotationNo, null);
  if (!w || !rot) return false;
  if (examInfo(period, w)) return false;

  const s = rot === 1 ? toInt(period?.rot1StartWeek, null) : toInt(period?.rot2StartWeek, null);
  const e = rot === 1 ? toInt(period?.rot1EndWeek, null) : toInt(period?.rot2EndWeek, null);
  if (s == null || e == null) return false;

  return w >= s && w <= e;
}