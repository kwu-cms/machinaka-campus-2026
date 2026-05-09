/** タイムライン軸との交差 `[lo, hi)`（分）。交差なしなら null */
export function intersectAxisRange(startMin, endMin, axisLo, axisHi) {
  const a = Math.max(startMin, axisLo);
  const b = Math.min(endMin, axisHi);
  if (b <= a) return null;
  return { start: a, end: b };
}

/**
 * 実時刻（分）→ タイムライン上の横位置（0〜100%）。
 */
export function minuteToDisplayPct(m, axisLo, axisHi) {
  const H10 = 10 * 60;
  const H12 = 12 * 60;
  const H13 = 13 * 60;
  const H18 = 18 * 60;

  const W_EDGE = 6;
  const W_TAIL = 12;
  const W_BAND_MAIN = 1;
  const W_BAND_LUNCH = 0.38;

  function clipLen(lo, hi) {
    const a = Math.max(lo, axisLo);
    const b = Math.min(hi, axisHi);
    return Math.max(0, b - a);
  }

  const edgeHi = Math.min(H10, axisHi);
  const L1 = clipLen(axisLo, edgeHi);
  const d1 = L1 > 0 ? W_EDGE * (L1 / 60) : 0;

  const lo1012 = Math.max(H10, axisLo);
  const hi1012 = Math.min(H12, axisHi);
  const lo1213 = Math.max(H12, axisLo);
  const hi1213 = Math.min(H13, axisHi);
  const lo1318 = Math.max(H13, axisLo);
  const hi1318 = Math.min(H18, axisHi);

  const len1012 = clipLen(H10, H12);
  const len1213 = clipLen(H12, H13);
  const len1318 = clipLen(H13, H18);
  const d2a = len1012 * W_BAND_MAIN;
  const d2b = len1213 * W_BAND_LUNCH;
  const d2c = len1318 * W_BAND_MAIN;

  const tailLo = Math.max(H18, axisLo);
  const L3 = clipLen(tailLo, axisHi);
  const d3 = L3 > 0 ? W_TAIL * (L3 / 120) : 0;

  const wSum = d1 + d2a + d2b + d2c + d3;
  if (wSum <= 0) {
    return ((m - axisLo) / (axisHi - axisLo)) * 100;
  }

  const sc = 100 / wSum;
  const endEdge = sc * d1;
  const end1012 = endEdge + sc * d2a;
  const end1213 = end1012 + sc * d2b;
  const end1318 = end1213 + sc * d2c;

  if (m <= axisLo) return 0;
  if (m >= axisHi) return 100;

  if (L1 > 0 && m < edgeHi) {
    return ((m - axisLo) / L1) * endEdge;
  }
  if (len1012 > 0 && m >= lo1012 && m < hi1012) {
    return endEdge + ((m - lo1012) / len1012) * (end1012 - endEdge);
  }
  if (len1213 > 0 && m >= lo1213 && m < hi1213) {
    return end1012 + ((m - lo1213) / len1213) * (end1213 - end1012);
  }
  if (len1318 > 0 && m >= lo1318 && m < hi1318) {
    return end1213 + ((m - lo1318) / len1318) * (end1318 - end1213);
  }
  if (L3 > 0 && m >= tailLo) {
    return end1318 + ((m - tailLo) / L3) * (100 - end1318);
  }

  return end1318;
}

export function rangeToDisplayPct(r, axisLo, axisHi) {
  const left = minuteToDisplayPct(r.start, axisLo, axisHi);
  const right = minuteToDisplayPct(r.end, axisLo, axisHi);
  return {
    left,
    width: Math.max(right - left, 0.35),
  };
}

/** `HH:MM` を分に変換。取れなければ null */
export function parseHmToMinutes(cell) {
  const m = String(cell || "").match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

/** イベントの `時間2行目` から開始・終了の分値 */
export function eventTimedRangeMinutes(ev) {
  if (ev.cat === "permanent") return null;
  const t = String(ev.timeLine || "").trim();
  if (!t || t === "常設") return null;
  if (/^(時間未定|未定|TBD|調整中)$/i.test(t)) return null;
  const sep = /[–\-〜～]/;
  const parts = t.split(sep);
  const mStart = String(parts[0] || "").match(/(\d{1,2}):(\d{2})/);
  if (!mStart) return null;
  let startRaw = Number(mStart[1]) * 60 + Number(mStart[2]);
  const endPart = (parts[1] || "").trim();
  let endRaw = null;
  if (endPart) {
    const mEnd = endPart.match(/(\d{1,2}):(\d{2})/);
    if (mEnd) endRaw = Number(mEnd[1]) * 60 + Number(mEnd[2]);
  }
  const MIN_WIDTH = 30;
  if (endRaw == null) endRaw = startRaw + MIN_WIDTH;
  else if (endRaw <= startRaw) endRaw = startRaw + MIN_WIDTH;
  return { start: startRaw, end: endRaw };
}
