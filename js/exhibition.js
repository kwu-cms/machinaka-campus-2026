import { SITE_CONFIG, PROGRAM_TIMELINE } from "./config.js";
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
  const description = String(r["作品説明"] || "").trim();
  const exhibitionDate = String(r["展示日"] || "").trim();
  const imagePath = resolveExhibitionImagePath(r["画像ファイル名"] || "");
  const relatedUrl = String(r["関連URL（任意）"] || r["関連URL"] || "").trim();

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
    description,
    exhibitionDate,
    imagePath,
    relatedUrl,
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

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function exhibitionCardHtml(item) {
  const aria = `${item.displayTitle}の詳細を開く`;
  return `<figure class="exh-card exh-card--interactive" tabindex="0" role="button" data-exhibition-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(aria)}">
  ${cardPictureHtml(item)}
  <figcaption>${cardCaptionHtml(item)}</figcaption>
</figure>`;
}

/** @param {ReturnType<typeof exhibitionRowToRecord>} item */
function exhibitionMetaHtml(item) {
  const author = String(item.author || "").trim();
  const tags = [item.domain, item.authorType, item.year, item.media]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!author && !tags.length) return "";

  const parts = [];
  if (author) {
    parts.push(`<p class="exhibition-dialog-author">${escapeHtml(author)}</p>`);
  }
  if (tags.length) {
    parts.push(
      `<div class="exhibition-dialog-tags-bar">
        <ul class="exhibition-dialog-tags" aria-label="作品属性">
          ${tags.map((t) => `<li class="exhibition-dialog-tag">${escapeHtml(t)}</li>`).join("")}
        </ul>
      </div>`,
    );
  }
  return `<div class="exhibition-dialog-meta-inner">${parts.join("")}</div>`;
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
  const programLabelEl = dialog.querySelector("#exhibition-dialog-program-label");
  const metaEl = dialog.querySelector(".exhibition-dialog-meta");
  const bodyEl = dialog.querySelector("#exhibition-dialog-body");
  const mediaWrap = dialog.querySelector(".exhibition-dialog-media");
  const thumbEl = dialog.querySelector(".exhibition-dialog-thumb");
  const closeBtn = dialog.querySelector(".exhibition-dialog-close");
  const navPrev = dialog.querySelector("[data-exhibition-dialog-prev]");
  const navNext = dialog.querySelector("[data-exhibition-dialog-next]");

  /** @type {Record<string, ReturnType<typeof exhibitionRowToRecord>>} */
  let byId = {};
  /** @type {string[]} */
  let exhibitionNavIds = [];
  /** @type {string | null} */
  let exhibitionDialogCurrentId = null;

  if (sectionRoot) sectionRoot.setAttribute("aria-busy", "true");

  function getExhibitionNavState(id) {
    const ids = exhibitionNavIds.length ? exhibitionNavIds : [id];
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
    if (!multi) {
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
      const items = matrix
        .slice(1)
        .map((row) => exhibitionRowToRecord(rowToObj(headers, row)))
        .filter(isPublishableExhibition)
        .sort((a, b) => a.sort - b.sort);

      byId = Object.fromEntries(items.map((item) => [item.id, item]));
      exhibitionNavIds = items.map((item) => item.id);

      if (!items.length) {
        track.innerHTML = `<p class="exh-empty">展示作品の情報を読み込めませんでした。</p>`;
        return;
      }

      track.innerHTML = items.map(exhibitionCardHtml).join("");
      initExhibitionCarousel();
      bindCards();

      const deepId = getQueryParam(EXHIBITION_QUERY_PARAM);
      if (deepId && byId[deepId]) {
        openForId(deepId, { fromUrl: true });
      }
    })
    .catch(() => {
      track.innerHTML = `<p class="exh-empty">展示作品の情報を読み込めませんでした。</p>`;
    })
    .finally(() => {
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
    });

  function fillDialog(item) {
    if (!titleEl || !bodyEl || !metaEl || !mediaWrap || !thumbEl || !programLabelEl) return;

    programLabelEl.textContent = PROGRAM_TIMELINE.exhibition.label.replace(/\s*\n\s*/g, "");
    titleEl.textContent = item.displayTitle;

    const desc = item.description.trim();
    const url = item.relatedUrl.trim();
    let bodyHtml = "";
    if (desc) {
      bodyHtml += `<p class="exhibition-dialog-desc">${escapeHtml(desc).replace(/\n/g, "<br>")}</p>`;
    }
    if (url) {
      bodyHtml += `<p class="exhibition-dialog-link"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">関連リンク</a></p>`;
    }
    if (!bodyHtml) {
      bodyHtml = `<p class="exhibition-dialog-desc exhibition-dialog-desc--muted">詳細は会場にてご覧ください。</p>`;
    }
    bodyEl.innerHTML = bodyHtml;

    const metaHtml = exhibitionMetaHtml(item);
    if (metaEl) {
      metaEl.innerHTML = metaHtml;
      metaEl.hidden = !metaHtml;
    }

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
      const { ids } = getExhibitionNavState(id);
      if (ids.length <= 1) return;
      e.preventDefault();
      stepExhibitionDialog(e.key === "ArrowLeft" ? -1 : 1);
    });
  }
}