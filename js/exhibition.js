import { SITE_CONFIG, PROGRAM_TIMELINE, EXHIBITION_UI } from "./config.js";
import { parseCSV, rowToObj } from "./lib/csv.js";
import { escapeHtml } from "./lib/html.js";
import { getQueryParam, removeQueryParam, setQueryParam } from "./lib/url-params.js";
import {
  pictureHTMLFromPath,
  resolveImageStem,
  applyResponsiveImageToImg,
  inferProfileFromStem,
} from "./lib/responsive-image.js";
import { withViewTransition, tagViewTransitionPair } from "./lib/view-transition.js";

const EXHIBITION_QUERY_PARAM = "exhibition_id";

/** @returns {"simple"|"full"} */
export function resolveExhibitionUiMode() {
  const mode = EXHIBITION_UI.mode;
  if (mode === "simple") return "simple";
  if (mode === "full") return "full";
  const from = String(EXHIBITION_UI.fullDetailFrom || "").trim();
  if (!from) return "full";
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayYmd = `${y}-${m}-${d}`;
  return todayYmd >= from ? "full" : "simple";
}

/** @param {string} raw */
function resolveExhibitionImagePath(raw) {
  const p = String(raw || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("./") || p.startsWith("../") || p.startsWith("images/")) return p;
  return `images/${p.replace(/^\.?\//, "")}`;
}

/** @param {Record<string, string>} r */
function exhibitionRowToRecord(r) {
  const id = String(r["ID"] || "").trim();
  const title = String(r["タイトル"] || "").trim();
  const author = String(r["作者"] || "").trim();
  const domain = String(r["領域"] || "").trim();
  const authorType = String(r["作者区分"] || "").trim();
  const year = String(r["制作年"] || "").trim();
  const media = String(r["メディア種別"] || "").trim();
  const displayMethod = String(r["展示方法"] || "").trim();
  const description = String(r["作品説明"] || "").trim();
  const exhibitionDate = String(r["展示日"] || "").trim();
  const imagePath = resolveExhibitionImagePath(r["画像ファイル名"] || "");
  const relatedUrl = String(r["関連URL（任意）"] || r["関連URL"] || "").trim();
  const notes = String(r["備考"] || r["メモ"] || "").trim();

  const displayTitle = title || domain;
  const sortNum = (() => {
    const m = /^exhi-(\d+)$/i.exec(id);
    return m ? parseInt(m[1], 10) : 999;
  })();

  return {
    id,
    title,
    author,
    domain,
    authorType,
    year,
    media,
    displayMethod,
    description,
    exhibitionDate,
    imagePath,
    relatedUrl,
    notes,
    displayTitle,
    sort: sortNum,
  };
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function isPublishableExhibition(item) {
  if (!/^exhi-\d+$/i.test(item.id)) return false;
  if (!item.displayTitle) return false;
  return true;
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function hasExhibitionImage(item) {
  if (resolveImageStem(item.imagePath)) return true;
  return /^https?:\/\//i.test(String(item.imagePath || ""));
}

/** ページ上のカルーセル／グリッドに載せる作品（画像ありのみ） */
/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function isListedExhibition(item) {
  return isPublishableExhibition(item) && hasExhibitionImage(item);
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function cardCaptionHtml(item) {
  const title = escapeHtml(item.displayTitle);
  const authorLine = item.author || item.authorType;
  const subParts = [authorLine, item.media].filter(Boolean);
  const sub = subParts.length ? `<span class="exh-card-sub">${escapeHtml(subParts.join(" · "))}</span>` : "";
  return `<span class="exh-card-title">${title}</span>${sub}`;
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function cardPictureHtml(item) {
  const stem = resolveImageStem(item.imagePath);
  if (!stem) {
    return `<div class="exh-card-placeholder" aria-hidden="true"></div>`;
  }
  const profile = inferProfileFromStem(stem);
  const alt = item.title
    ? `${item.title}の展示イメージ`
    : item.domain
      ? `${item.domain}の展示イメージ`
      : "展示作品のイメージ";
  return pictureHTMLFromPath(item.imagePath, {
    profile,
    alt,
    width: 640,
    height: 480,
    loading: "eager",
  });
}

/** シンプル表示: 画像あり */
/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function isConfirmedExhibitionForSimple(item) {
  return hasExhibitionImage(item);
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function exhibitionSimpleImageHtml(item) {
  const stem = resolveImageStem(item.imagePath);
  if (!stem) return "";
  const profile = inferProfileFromStem(stem);
  return `<li class="exh-simple-cell">${pictureHTMLFromPath(item.imagePath, {
    profile,
    alt: "展示作品",
    width: 640,
    height: 480,
    loading: "lazy",
  })}</li>`;
}

/** シンプル3列グリッド: 1行目と2行目の並びを入れ替える */
const EXH_SIMPLE_GRID_COLS = 3;

/** @param {ReturnType<typeof exhibitionRowToRecord>[]} items */
function reorderSimpleGridSwapFirstTwoRows(items) {
  const n = items.length;
  if (n <= EXH_SIMPLE_GRID_COLS) return items;
  const row1 = items.slice(0, EXH_SIMPLE_GRID_COLS);
  const row2 = items.slice(EXH_SIMPLE_GRID_COLS, EXH_SIMPLE_GRID_COLS * 2);
  const rest = items.slice(EXH_SIMPLE_GRID_COLS * 2);
  return [...row2, ...row1, ...rest];
}

/** @param {ReturnType<typeof exhibitionRowToRecord>[]} items */
function exhibitionSimpleGridHtml(items) {
  const confirmed = reorderSimpleGridSwapFirstTwoRows(items.filter(isConfirmedExhibitionForSimple));
  if (!confirmed.length) {
    return `<p class="exh-empty">展示作品の情報を読み込めませんでした。</p>`;
  }
  return `<ul class="exh-simple-grid">${confirmed.map(exhibitionSimpleImageHtml).join("")}</ul>`;
}

/**
 * @param {HTMLElement} sectionRoot
 * @param {HTMLElement} track
 */
function applyExhibitionSimpleChrome(sectionRoot, track) {
  document.getElementById("exh-preview-note")?.remove();
  if (sectionRoot) sectionRoot.dataset.exhUi = "simple";
  const carousel = track.closest(".exh-carousel");
  if (carousel) carousel.setAttribute("aria-label", "展示作品一覧");
  const stage = track.closest(".exh-carousel-stage");
  stage?.querySelector(".exh-prev")?.setAttribute("hidden", "");
  stage?.querySelector(".exh-next")?.setAttribute("hidden", "");
}

/**
 * @param {HTMLElement} sectionRoot
 * @param {HTMLElement} track
 */
function applyExhibitionFullChrome(sectionRoot, track) {
  if (sectionRoot) sectionRoot.dataset.exhUi = "full";
  const carousel = track.closest(".exh-carousel");
  if (carousel) carousel.setAttribute("aria-label", "展示作品");
  const stage = track.closest(".exh-carousel-stage");
  stage?.querySelector(".exh-prev")?.removeAttribute("hidden");
  stage?.querySelector(".exh-next")?.removeAttribute("hidden");
}

/**
 * @param {HTMLElement} track
 * @param {HTMLElement | null} sectionRoot
 * @param {ReturnType<typeof exhibitionRowToRecord>[]} items
 */
function renderExhibitionSimple(track, sectionRoot, items) {
  applyExhibitionSimpleChrome(sectionRoot, track);
  track.innerHTML = exhibitionSimpleGridHtml(items);
}

/**
 * @param {HTMLElement} track
 * @param {HTMLElement | null} sectionRoot
 * @param {ReturnType<typeof exhibitionRowToRecord>[]} items
 * @param {{ bindCards: () => void, openDeepLink: () => void }} hooks
 */
function renderExhibitionFull(track, sectionRoot, items, hooks) {
  applyExhibitionFullChrome(sectionRoot, track);
  const visibleItems = items.filter(isListedExhibition);
  track.innerHTML = visibleItems.map(exhibitionCardHtml).join("");
  initExhibitionCarousel();
  hooks.bindCards();
  hooks.openDeepLink();
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function exhibitionCardHtml(item) {
  const aria = `${item.displayTitle}の詳細を開く`;
  return `<figure class="exh-card exh-card--interactive" tabindex="0" role="button" data-exhibition-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(aria)}">
  ${cardPictureHtml(item)}
  <figcaption>${cardCaptionHtml(item)}</figcaption>
</figure>`;
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function exhibitionCreditsLine(item) {
  return [item.domain, item.year, item.media]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function initExhibitionCarousel() {
  const track = document.getElementById("exhTrack");
  const stage = track?.closest(".exh-carousel-stage");
  const prev = stage?.querySelector(".exh-prev");
  const next = stage?.querySelector(".exh-next");
  if (!track || !prev || !next) return;

  const cards = Array.from(track.querySelectorAll(".exh-card"));
  const n = cards.length;
  if (!n) return;

  const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollBehavior = () => (reducedMq.matches ? "auto" : "smooth");
  let activeIndex = 0;
  let isProgrammaticScroll = false;
  let scrollEndTimer = null;

  function captionAt(idx) {
    const card = cards[idx];
    const titleEl = card?.querySelector(".exh-card-title");
    const cap = titleEl?.textContent?.trim() || card?.querySelector("figcaption")?.textContent?.trim();
    return cap || `作品 ${idx + 1}`;
  }

  function scrollLeftForIndex(idx) {
    return cards[idx]?.offsetLeft ?? 0;
  }

  function indexFromScroll() {
    const sl = track.scrollLeft;
    let best = 0;
    let minD = Infinity;
    cards.forEach((card, i) => {
      const d = Math.abs(card.offsetLeft - sl);
      if (d < minD) {
        minD = d;
        best = i;
      }
    });
    return best;
  }

  function scrollToIndex(idx) {
    if (idx < 0 || idx >= n) return;
    activeIndex = idx;
    isProgrammaticScroll = true;
    track.scrollTo({ left: scrollLeftForIndex(idx), behavior: scrollBehavior() });
    updateButtons();
  }

  function updateButtons() {
    const single = n <= 1;
    prev.disabled = single || activeIndex <= 0;
    next.disabled = single || activeIndex >= n - 1;
    prev.setAttribute("aria-label", activeIndex > 0 ? `前へ: ${captionAt(activeIndex - 1)}` : "前の作品へ");
    next.setAttribute(
      "aria-label",
      activeIndex < n - 1 ? `次へ: ${captionAt(activeIndex + 1)}` : "次の作品へ",
    );
  }

  function stepCarousel(delta) {
    scrollToIndex(activeIndex + delta);
  }

  function onScrollSettled() {
    if (!isProgrammaticScroll) {
      activeIndex = indexFromScroll();
    }
    isProgrammaticScroll = false;
    updateButtons();
  }

  function scheduleScrollSettled() {
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(onScrollSettled, 120);
  }

  prev.addEventListener("click", () => stepCarousel(-1));
  next.addEventListener("click", () => stepCarousel(1));

  if ("onscrollend" in window) {
    track.addEventListener("scrollend", onScrollSettled);
  } else {
    track.addEventListener("scroll", scheduleScrollSettled, { passive: true });
  }

  reducedMq.addEventListener("change", updateButtons);

  const ro = new ResizeObserver(() => {
    track.scrollLeft = scrollLeftForIndex(activeIndex);
    updateButtons();
  });
  ro.observe(track);

  function bootLayout() {
    activeIndex = 0;
    track.scrollLeft = 0;
    updateButtons();
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(bootLayout);
  });
}

export function initExhibitionSection() {
  const track = document.getElementById("exhTrack");
  const sectionRoot = document.querySelector("#exhibition .exh-section");
  const dialog = document.getElementById("exhibition-detail-dialog");
  if (!track || !dialog) return;
  if (document.body.dataset.signage) return;

  const panelEl = dialog.querySelector(".event-dialog-panel");
  const titleEl = dialog.querySelector("#exhibition-dialog-title");
  const introEl = dialog.querySelector(".exhibition-dialog-intro");
  const authorEl = dialog.querySelector("#exhibition-dialog-author");
  const creditsEl = dialog.querySelector("#exhibition-dialog-credits");
  const programLabelEl = dialog.querySelector("#exhibition-dialog-program-label");
  const bodyEl = dialog.querySelector("#exhibition-dialog-body");
  const mediaWrap = dialog.querySelector(".exhibition-dialog-media");
  const thumbEl = dialog.querySelector(".exhibition-dialog-thumb");
  const closeBtn = dialog.querySelector(".exhibition-dialog-close");
  const navPrev = dialog.querySelector("[data-exhibition-dialog-prev]");
  const navNext = dialog.querySelector("[data-exhibition-dialog-next]");

  /** @type {Record<string, ReturnType<typeof exhibitionRowToRecord>>} */
  let byId = {};
  /** @type {string[]} */
  let exhibitionListedNavIds = [];
  /** @type {string[]} */
  let exhibitionAllNavIds = [];
  /** @type {"listed"|"all"} */
  let exhibitionNavScope = "listed";
  /** @type {string | null} */
  let exhibitionDialogCurrentId = null;

  if (sectionRoot) sectionRoot.setAttribute("aria-busy", "true");

  function getExhibitionNavState(id) {
    const ids =
      exhibitionNavScope === "all"
        ? exhibitionAllNavIds.length
          ? exhibitionAllNavIds
          : [id]
        : exhibitionListedNavIds.length
          ? exhibitionListedNavIds
          : [id];
    if (ids.length <= 1) return { ids, index: 0 };
    const index = ids.indexOf(id);
    if (index < 0) return { ids: [id], index: 0 };
    return { ids, index };
  }

  function updateExhibitionDialogNav(id) {
    if (!navPrev || !navNext) return;
    const item = byId[id];
    const { ids, index } = getExhibitionNavState(id);
    const multi = ids.length > 1 && item && ids.includes(id);
    if (!multi || !hasExhibitionImage(item)) {
      navPrev.hidden = true;
      navNext.hidden = true;
      return;
    }
    navPrev.hidden = false;
    navNext.hidden = false;
    const pos = `${index + 1} / ${ids.length}`;
    const prevId = ids[(index - 1 + ids.length) % ids.length];
    const nextId = ids[(index + 1) % ids.length];
    const prevTitle = byId[prevId]?.displayTitle || "";
    const nextTitle = byId[nextId]?.displayTitle || "";
    navPrev.setAttribute("aria-label", prevTitle ? `前の作品: ${prevTitle}（${pos}）` : `前の作品へ（${pos}）`);
    navNext.setAttribute("aria-label", nextTitle ? `次の作品: ${nextTitle}（${pos}）` : `次の作品へ（${pos}）`);
  }

  fetch(SITE_CONFIG.exhibitionsCsvUrl, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((text) => {
      const matrix = parseCSV(text.replace(/^\uFEFF/, ""));
      if (!matrix.length) throw new Error("empty");
      const headers = matrix[0].map((h) => h.trim());
      const allItems = matrix
        .slice(1)
        .map((row) => exhibitionRowToRecord(rowToObj(headers, row)))
        .filter(isPublishableExhibition)
        .sort((a, b) => a.sort - b.sort);

      const listedItems = allItems.filter(isListedExhibition);

      byId = Object.fromEntries(allItems.map((item) => [item.id, item]));
      exhibitionListedNavIds = listedItems.map((item) => item.id);
      exhibitionAllNavIds = allItems.map((item) => item.id);

      const openDeepLink = () => {
        const deepId = getQueryParam(EXHIBITION_QUERY_PARAM);
        if (deepId && byId[deepId]) {
          openForId(deepId, { fromUrl: true, navScope: "all" });
        }
      };

      if (!allItems.length) {
        track.innerHTML = `<p class="exh-empty">展示作品の情報を読み込めませんでした。</p>`;
        return;
      }

      const uiMode = resolveExhibitionUiMode();
      if (uiMode === "simple") {
        renderExhibitionSimple(track, sectionRoot, listedItems);
        openDeepLink();
      } else if (!listedItems.length) {
        track.innerHTML = `<p class="exh-empty">展示作品の情報を読み込めませんでした。</p>`;
        openDeepLink();
      } else {
        renderExhibitionFull(track, sectionRoot, listedItems, {
          bindCards,
          openDeepLink,
        });
      }
    })
    .catch(() => {
      track.innerHTML = `<p class="exh-empty">展示作品の情報を読み込めませんでした。</p>`;
    })
    .finally(() => {
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
    });

  function fillDialog(item) {
    if (!titleEl || !bodyEl || !mediaWrap || !thumbEl || !programLabelEl) return;

    programLabelEl.textContent = PROGRAM_TIMELINE.exhibition.label.replace(/\s*\n\s*/g, "");
    titleEl.textContent = String(item.title || item.displayTitle || "").trim();

    const author = String(item.author || "").trim();
    const credits = exhibitionCreditsLine(item);
    if (authorEl) {
      authorEl.textContent = author;
      authorEl.hidden = !author;
    }
    if (creditsEl) {
      creditsEl.textContent = credits;
      creditsEl.hidden = !credits;
    }
    if (introEl) {
      introEl.hidden = !author && !credits;
    }

    const desc = item.description.trim();
    bodyEl.innerHTML = desc
      ? `<p class="exhibition-dialog-desc">${escapeHtml(desc).replace(/\n/g, "<br>")}</p>`
      : `<p class="exhibition-dialog-desc exhibition-dialog-desc--muted">詳細は会場にてご覧ください。</p>`;

    const stem = resolveImageStem(item.imagePath);
    if (stem) {
      applyResponsiveImageToImg(thumbEl, stem, inferProfileFromStem(stem));
      thumbEl.alt = `${item.displayTitle}の展示イメージ`;
      mediaWrap.hidden = false;
    } else if (item.imagePath && /^https?:\/\//i.test(item.imagePath)) {
      thumbEl.src = item.imagePath;
      thumbEl.removeAttribute("srcset");
      thumbEl.alt = `${item.displayTitle}の展示イメージ`;
      mediaWrap.hidden = false;
    } else {
      thumbEl.removeAttribute("src");
      thumbEl.removeAttribute("srcset");
      thumbEl.alt = "";
      mediaWrap.hidden = true;
    }

    panelEl?.scrollTo({ top: 0, behavior: "auto" });
  }

  function openForId(id, opts = {}) {
    const item = byId[id];
    if (!item) return;
    const fromUrl = Boolean(opts.fromUrl);
    const sourceEl = opts.sourceEl || null;

    const show = () => {
      if (opts.navScope) exhibitionNavScope = opts.navScope;
      exhibitionDialogCurrentId = id;
      fillDialog(item);
      updateExhibitionDialogNav(id);
      if (typeof dialog.showModal === "function") dialog.showModal();
      if (!fromUrl) setQueryParam(EXHIBITION_QUERY_PARAM, id);
    };

    if (sourceEl && typeof document.startViewTransition === "function") {
      const cleanup = tagViewTransitionPair(sourceEl, dialog);
      withViewTransition(() => {
        show();
        requestAnimationFrame(() => cleanup());
      });
    } else {
      show();
    }
  }

  function stepExhibitionDialog(delta) {
    const id = exhibitionDialogCurrentId;
    if (!id) return;
    const { ids, index } = getExhibitionNavState(id);
    if (ids.length <= 1) return;
    const nextIndex = (index + delta + ids.length) % ids.length;
    openForId(ids[nextIndex]);
  }

  function bindCards() {
    track.querySelectorAll(".exh-card[data-exhibition-id]").forEach((el) => {
      const openFromCard = () =>
        openForId(el.getAttribute("data-exhibition-id"), {
          sourceEl: el instanceof HTMLElement ? el : null,
          navScope: "listed",
        });
      el.addEventListener("click", openFromCard);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFromCard();
        }
      });
    });
  }

  if (dialog.dataset.mxmExhDlgBound !== "1") {
    dialog.dataset.mxmExhDlgBound = "1";
    closeBtn?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      removeQueryParam(EXHIBITION_QUERY_PARAM);
      exhibitionDialogCurrentId = null;
    });
    navPrev?.addEventListener("click", () => stepExhibitionDialog(-1));
    navNext?.addEventListener("click", () => stepExhibitionDialog(1));
    dialog.addEventListener("keydown", (e) => {
      if (!dialog.open) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const id = exhibitionDialogCurrentId;
      if (!id) return;
      const item = byId[id];
      if (!item || !hasExhibitionImage(item)) return;
      const { ids } = getExhibitionNavState(id);
      if (ids.length <= 1) return;
      e.preventDefault();
      stepExhibitionDialog(e.key === "ArrowLeft" ? -1 : 1);
    });
  }
}