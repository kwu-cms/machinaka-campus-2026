/** @typedef {"screening"|"event"} SignageHeroMode */

const STORAGE_KEY = "mxm-signage-hero-index";

/** @param {SignageHeroMode} mode */
export function getStoredSignageHeroIndex(mode) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    const n = Number(data?.[mode]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** @param {SignageHeroMode} mode @param {number} index */
export function storeSignageHeroIndex(mode, index) {
  if (!Number.isFinite(index) || index < 0) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[mode] = Math.floor(index);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* sessionStorage 不可時は無視 */
  }
}

/** @param {SignageHeroMode} mode */
export function readActiveSignageHeroIndex(mode) {
  const selector =
    mode === "event"
      ? "#ev-signage-hero .signage-mv-page-slideshow, #event .signage-mv-page-slideshow"
      : "#mv-signage-hero .signage-mv-page-slideshow, #screening .signage-mv-page-slideshow";
  const root = document.querySelector(selector);
  if (!root) return 0;
  const slides = root.querySelectorAll(".signage-mv-page-slide");
  for (let i = 0; i < slides.length; i += 1) {
    if (slides[i].classList.contains("is-active")) return i;
  }
  return 0;
}

/** @param {number} slideCount @param {SignageHeroMode} mode */
export function resolveSignageHeroStartIndex(slideCount, mode) {
  if (!slideCount) return 0;
  return getStoredSignageHeroIndex(mode) % slideCount;
}
