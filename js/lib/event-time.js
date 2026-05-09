/** 並び替えの第1キー */
export function timeSortKey(timeLine) {
  const m = String(timeLine).match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 終了時刻（範囲の2つ目）。並び替えの第2キー用 */
export function timeEndSortKey(timeLine) {
  const t = String(timeLine || "").trim();
  const sep = /[–\-〜～]/;
  const parts = t.split(sep);
  const endPart = (parts.length > 1 ? parts[1] : parts[0] || "").trim();
  const m = endPart.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return Number(m[1]) * 60 + Number(m[2]);
}
