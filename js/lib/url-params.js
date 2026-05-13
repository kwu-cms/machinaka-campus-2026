/**
 * 現在の URL のクエリを読み書き（history.replaceState、ページ再読込なし）。
 */

export function getQueryParam(key) {
  try {
    return new URLSearchParams(window.location.search).get(key) || "";
  } catch {
    return "";
  }
}

export function setQueryParam(key, value) {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set(key, String(value));
    const qs = u.searchParams.toString();
    window.history.replaceState(null, "", `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`);
  } catch {
    /* ignore */
  }
}

export function removeQueryParam(key) {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has(key)) return;
    u.searchParams.delete(key);
    const qs = u.searchParams.toString();
    window.history.replaceState(null, "", `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`);
  } catch {
    /* ignore */
  }
}
