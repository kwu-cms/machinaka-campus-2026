import {
  SITE_CONFIG,
  FEATURED_EVENT_IDS,
  FEATURED_IMAGE_BY_ID,
  FEATURED_IMAGE_FALLBACK,
  FEATURED_PICKUP_CAROUSEL_INTERVAL_MS,
  SCREENING_SLIDESHOW_INTERVAL_MS,
  EVENT_CATEGORY_LABELS,
  dialogProgramLabelMod,
  dialogProgramLabelText,
} from "./config.js";
import { parseCSV, rowToObj } from "./lib/csv.js";
import { escapeHtml } from "./lib/html.js";
import { getQueryParam, removeQueryParam, setQueryParam } from "./lib/url-params.js";
import { timeSortKey, timeEndSortKey } from "./lib/event-time.js";
import { fillProgramTimeline } from "./timeline-ui.js";
import {
  parseSpeakersCsvText,
  resolveEventSpeakers,
  renderEventSpeakersSectionHtml,
  eventSpeakersInlineText,
  resolveSpeakerImageUrl,
} from "./speaker-blocks.js";
import {
  pictureHTMLFromPath,
  cssBackgroundImageSet,
  resolveImageStem,
  inferProfileFromStem,
  applyResponsiveImageToImg,
} from "./lib/responsive-image.js";
import { withViewTransition, tagViewTransitionPair } from "./lib/view-transition.js";
import { resolveSignageHeroStartIndex } from "./signage-hero-state.js";

let mxmEvPickupCarouselTimer = null;

function clearEvPickupCarouselTimer() {
  if (mxmEvPickupCarouselTimer != null) {
    window.clearInterval(mxmEvPickupCarouselTimer);
    mxmEvPickupCarouselTimer = null;
  }
}

/** `#ev-pickup .ev-pickup-hero` 生成後に描画完了コールバックへ渡す用 */
function initEvPickupCarousel(root) {
  clearEvPickupCarouselTimer();
  if (!root) return;
  if (document.body.dataset.signage) return;

  const slides = Array.from(root.querySelectorAll(".ev-pickup-slide"));
  const dotsHost = root.querySelector(".ev-pickup-dots");
  const liveEl = root.querySelector(".ev-pickup-carousel-live");
  const controls = root.querySelector(".ev-pickup-carousel-controls");

  if (!slides.length || !dotsHost) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;

  const announce = (slideEl) => {
    if (!liveEl) return;
    const titleEl = slideEl.querySelector(".ev-pickup-title");
    const t = titleEl?.textContent?.trim() || "";
    liveEl.textContent = t ? `注目スライド: ${t}` : "";
  };

  const setActive = (nextIndex) => {
    const i = (nextIndex + slides.length) % slides.length;
    index = i;
    slides.forEach((s, j) => {
      const on = j === i;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
      s.setAttribute("tabindex", on ? "0" : "-1");
    });
    dotsHost.querySelectorAll("button").forEach((d, j) => {
      d.classList.toggle("is-active", j === i);
      d.setAttribute("aria-current", j === i ? "true" : "false");
    });
    announce(slides[i]);
  };

  const restartAuto = () => {
    clearEvPickupCarouselTimer();
    if (reduced || slides.length < 2) return;
    mxmEvPickupCarouselTimer = window.setInterval(
      () => setActive(index + 1),
      FEATURED_PICKUP_CAROUSEL_INTERVAL_MS,
    );
  };

  dotsHost.textContent = "";

  slides.forEach((slideEl, j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ev-pickup-dot";
    const titleEl = slideEl.querySelector(".ev-pickup-title");
    const label = titleEl?.textContent?.trim()
      ? `${titleEl.textContent.trim()} に移動`
      : `スライド ${j + 1}`;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", () => {
      setActive(j);
      restartAuto();
    });
    dotsHost.appendChild(b);
  });

  if (controls) controls.hidden = slides.length < 2;

  setActive(0);
  restartAuto();
}

const SIGNAGE_EVENT_VENUE = "こうべまちづくり会館 3F多目的室";

function signageEventChromeHTML() {
  return `<div class="signage-event-chrome">
    <header class="signage-event-chrome__head">
      <p class="signage-event-chrome__kicker">イベントプログラム</p>
      <h1 class="signage-event-chrome__title">イベント</h1>
      <p class="signage-event-chrome__tagline">レクチャー・ワークショップ・常設企画</p>
    </header>
    <p class="signage-event-chrome__meta">
      <span class="signage-event-chrome__venue">${escapeHtml(SIGNAGE_EVENT_VENUE)}</span>
      <span class="signage-event-chrome__dates">7/18（土）・7/19（日）</span>
      <span class="signage-event-chrome__note">入場無料（ワークショップは要申込）</span>
    </p>
  </div>`;
}

export function initEventsSection() {
  let permanentHost = document.getElementById("ev-permanent-list");
  let listHost = document.getElementById("ev-list");
  let pickupHost = document.getElementById("ev-pickup");
  const timelineRoot = document.getElementById("about-timeline-root");
  const sectionRoot = document.querySelector("#event .ev-section");
  const isSignageEvent = document.body.dataset.signage === "event";
  const eventDialog = document.getElementById("event-detail-dialog");
  const eventDlgTitle = eventDialog?.querySelector("#event-dialog-title");
  const eventDlgProgramLabel = eventDialog?.querySelector("#event-dialog-program-label");
  const eventDlgMeta = eventDialog?.querySelector(".event-dialog-meta");
  const eventDlgBody = eventDialog?.querySelector("#event-dialog-body");
  const eventDlgMedia = eventDialog?.querySelector(".event-dialog-media");
  const eventDlgThumb = eventDialog?.querySelector(".event-dialog-thumb");

  /** @type {Record<string, object>} */
  let byId = {};

  if (document.body.dataset.signage === "screening") {
    if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
    return;
  }

  if (isSignageEvent && sectionRoot) {
    sectionRoot.classList.add("ev-section--signage");
    sectionRoot.innerHTML = `<div id="ev-list" class="ev-signage-schedule" aria-label="イベントスケジュール"></div>`;
    listHost = document.getElementById("ev-list");
    permanentHost = null;
    const programBody = document.querySelector("#event .program-body");
    if (programBody && !programBody.querySelector(".signage-event-chrome")) {
      programBody.insertAdjacentHTML("afterbegin", signageEventChromeHTML());
    }
    pickupHost = document.getElementById("ev-signage-hero");
    if (!pickupHost && programBody && sectionRoot.parentElement) {
      const heroEl = document.createElement("div");
      heroEl.id = "ev-signage-hero";
      heroEl.className = "ev-signage-hero";
      heroEl.setAttribute("role", "region");
      heroEl.setAttribute("aria-label", "イベントビジュアル");
      heroEl.hidden = true;
      sectionRoot.parentElement.insertBefore(heroEl, sectionRoot);
      pickupHost = heroEl;
    }
  } else if (!permanentHost || !listHost) {
    return;
  }

  if (eventDialog && eventDialog.dataset.mxmEvDlgBound !== "1") {
    eventDialog.dataset.mxmEvDlgBound = "1";
    eventDialog.querySelector(".event-dialog-close")?.addEventListener("click", () => eventDialog.close());
    eventDialog.addEventListener("click", (e) => {
      if (e.target === eventDialog) eventDialog.close();
    });
    eventDialog.addEventListener("close", () => removeQueryParam("event_id"));
  }

  const CSV_URL = SITE_CONFIG.eventsCsvUrl;
  /** @type {Record<string, object>} */
  let speakersById = {};
  const DETAIL_PLACEHOLDER =
    "詳細テキストは準備中です。開催にあわせて内容を更新します。最新情報はInstagram（@mediastudies_kwu）もご確認ください。";
  /** 詳細モーダルに表示する会場。CSV「会場」が空のときに使う（P02 イベントの既定） */
  const DEFAULT_EVENT_MODAL_VENUE = "こうべまちづくり会館 3F多目的室";

  function hashLabel(s) {
    const t = String(s).trim();
    if (!t) return "";
    return t.startsWith("#") ? t : `#${t}`;
  }

  function parseBool(v) {
    const t = String(v).trim().toUpperCase();
    return t === "TRUE" || t === "1" || t === "YES";
  }

  function dayKeyFromDateStr(dateStr) {
    const s = String(dateStr).trim();
    if (!s) return null;
    if (s.includes("7/18") && s.includes("7/19")) return "both";
    if (s.includes("7/18")) return "sat";
    if (s.includes("7/19")) return "sun";
    return null;
  }

  function splitTimeDisplay(ev) {
    const t = String(ev.timeLine || "").trim();
    if (ev.cat === "permanent" || t === "常設") {
      return { start: "常設", end: "" };
    }
    if (!t) return { start: "—", end: "—" };
    const sep = /[–\-〜～]/;
    const parts = t.split(sep);
    const start = (parts[0] || "").trim();
    let end = (parts[1] || "").trim();
    if (!end) end = start;
    return { start, end };
  }

  function catLabel(cat) {
    return EVENT_CATEGORY_LABELS[cat] ?? cat;
  }

  /** @param {object} ev */
  function signageEventTimeLine(ev) {
    const { start, end } = splitTimeDisplay(ev);
    if (start === "常設") return "常設";
    if (!start || start === "—") return "";
    return end && end !== start ? `${start} – ${end}` : start;
  }

  /** @param {object} ev */
  function signageEventListMeta(ev) {
    const parts = [
      catLabel(ev.cat),
      signageEventTimeLine(ev),
      String(ev.dateLine || "").trim(),
      ev.apply ? "要申込" : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }

  /** @param {object} ev @param {string} uniqueKey */
  function signageEventFloatPanelInnerHTML(ev, uniqueKey) {
    const dateLine = String(ev.dateLine || "").trim();
    const timeStr = signageEventTimeLine(ev);
    const titleId = `ev-float-title-${escapeHtml(ev.id)}-${escapeHtml(uniqueKey)}`;
    const metaParts = [catLabel(ev.cat), timeStr, ev.apply ? "要申込" : ""].filter(Boolean);
    const metaJoined = metaParts.join("／");
    const synopsisRaw = String(ev.desc || "").trim() || DETAIL_PLACEHOLDER;
    const synopsis =
      synopsisRaw.length > 140 ? `${synopsisRaw.slice(0, 139).trim()}…` : synopsisRaw;
    const metaHtml = metaJoined
      ? `<p class="mv-float-panel-meta-line">${escapeHtml(metaJoined)}</p>`
      : "";

    return `<div class="mv-float-panel-head">
  ${dateLine ? `<p class="mv-float-panel-date"><span class="mv-float-panel-date-badge">${escapeHtml(dateLine)}</span></p>` : ""}
  <h3 class="mv-float-panel-title" id="${titleId}">${escapeHtml(ev.name)}</h3>
  ${metaHtml}
</div>
<div class="mv-float-panel-body">
  <p class="mv-float-panel-lead">概要</p>
  <p class="mv-float-panel-synopsis">${escapeHtml(synopsis)}</p>
</div>`;
  }

  /** @param {object} ev @param {string} uniqueKey */
  function signageEventInfoFloatHTML(ev, uniqueKey) {
    const titleId = `ev-float-title-${escapeHtml(ev.id)}-${escapeHtml(uniqueKey)}`;
    return `<aside class="signage-mv-page-synopsis-float mv-float-panel" aria-labelledby="${titleId}" aria-label="${escapeHtml(ev.name)}">${signageEventFloatPanelInnerHTML(ev, uniqueKey)}</aside>`;
  }

  function tagsFromCell(tagCell) {
    if (!tagCell || /^false$/i.test(String(tagCell).trim())) return [];
    return String(tagCell)
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function detailBlocks(ev, opts = {}) {
    const tags = tagsFromCell(ev.tagsRaw);
    const parts = [];
    if (ev.desc) {
      parts.push(`<p class="ev-desc">${escapeHtml(ev.desc)}</p>`);
    } else {
      parts.push(
        `<p class="ev-desc ev-desc--placeholder">${escapeHtml(DETAIL_PLACEHOLDER)}</p>`,
      );
    }
    if (!opts.skipTags && tags.length) {
      const tagTone = ["lecture", "workshop", "permanent"].includes(ev.cat) ? ev.cat : "lecture";
      parts.push(
        `<div class="ev-tags ev-tags--${tagTone}">${tags
          .map((t) => `<span class="ev-tag">${escapeHtml(hashLabel(t))}</span>`)
          .join("")}</div>`,
      );
    }
    if (ev.apply && ev.applyUrl) {
      parts.push(
        `<a class="ev-apply-btn" href="${escapeHtml(ev.applyUrl)}" target="_blank" rel="noopener noreferrer">参加申し込み</a>`,
      );
    }
    return parts.join("");
  }

  function bodyScheduleTimeHtml(ev) {
    const { start, end } = splitTimeDisplay(ev);
    if (ev.cat === "permanent" || start === "常設") return "";
    const hasDistinctRange = Boolean(end && end !== start);
    const ariaLabel = hasDistinctRange ? `${start}から${end}まで` : start;
    const body = hasDistinctRange
      ? `<span class="ev-schedule-part">${escapeHtml(start)}</span><span class="ev-schedule-sep" aria-hidden="true">–</span><span class="ev-schedule-part">${escapeHtml(end)}</span>`
      : `<span class="ev-schedule-part">${escapeHtml(start)}</span>`;
    return `<p class="ev-schedule" role="group" aria-label="${escapeHtml(ariaLabel)}"><img class="ev-schedule-icon" src="./images/icon-calendar-days.svg" alt="" width="15" height="15" decoding="async" /><span class="ev-schedule-body">${body}</span></p>`;
  }

  function cardHTML(ev) {
    const detailInner = detailBlocks(ev);
    const domainHtml = ev.domain
      ? `<span class="ev-domain">${escapeHtml(ev.domain)}</span>`
      : "";
    const scheduleHtml = bodyScheduleTimeHtml(ev);
    const speakersHtml = ev.speakers
      ? `<p class="ev-speakers" role="group" aria-label="登壇者"><img class="ev-speakers-icon" src="./images/fa-users.svg" alt="" width="15" height="15" decoding="async" /><span class="ev-speakers-body">${escapeHtml(ev.speakers)}</span></p>`
      : "";
    const ariaOpen = escapeHtml(`${ev.name}の詳細を開く`);

    const thumbSrc = pickupImageSrc(ev);
    const thumbStem = resolveImageStem(thumbSrc);
    const timeColStyle = thumbStem
      ? ` style="--ev-time-bg: ${cssBackgroundImageSet(thumbStem, inferProfileFromStem(thumbStem), { cssRelative: true, width: 640 })}"`
      : "";
    const thumbCol = thumbStem
      ? `<div class="ev-time ev-time--visual"${timeColStyle} aria-hidden="true"><div class="ev-time-inner ev-time-inner--empty"></div></div>`
      : "";
    const noThumbCls = thumbStem ? "" : " ev-card--no-thumb";

    return `<div class="ev-card ev-card--${escapeHtml(ev.cat)}${noThumbCls}" id="${escapeHtml(ev.id)}" tabindex="0" role="button" data-event-id="${escapeHtml(ev.id)}" aria-label="${ariaOpen}">
    ${thumbCol}
    <div class="ev-body">
      <div class="ev-title">${escapeHtml(ev.name)}</div>
      ${scheduleHtml}
      <div class="ev-meta">
        <span class="ev-cat ev-cat-${escapeHtml(ev.cat)}">${escapeHtml(catLabel(ev.cat))}</span>
        ${domainHtml}
        ${ev.apply ? '<span class="ev-apply-inline">要申込</span>' : ""}
      </div>
      ${speakersHtml}
      <div class="ev-detail">${detailInner}</div>
    </div>
  </div>`;
  }

  /** 縦型サイネージ：日別リスト（上映サイネージの mv-card--signage-list に相当） */
  function cardSignageListHTML(ev) {
    const meta = signageEventListMeta(ev);
    const metaBlock = meta ? `<p class="ev-signage-list-meta">${escapeHtml(meta)}</p>` : "";
    return `<article class="ev-card ev-card--signage-list ev-card--${escapeHtml(ev.cat)}" role="presentation">
        <p class="ev-signage-list-title">${escapeHtml(ev.name)}</p>
        ${metaBlock}
      </article>`;
  }

  function sortSignageEvents(a, b) {
    const ta = timeSortKey(a.timeLine || "");
    const tb = timeSortKey(b.timeLine || "");
    if (ta !== tb) return ta - tb;
    const ea = timeEndSortKey(a.timeLine || "");
    const eb = timeEndSortKey(b.timeLine || "");
    if (ea !== eb) return ea - eb;
    return a.sort - b.sort;
  }

  function signageScheduleGridHTML(scheduleTimed, permanents) {
    const days = [
      { key: "sat", label: "7/18（土）" },
      { key: "sun", label: "7/19（日）" },
    ];
    const cols = days
      .map(({ key, label }) => {
        const dayEvs = scheduleTimed
          .filter((e) => e.day === key || e.day === "both")
          .sort(sortSignageEvents);
        const rows = dayEvs.map((ev) => cardSignageListHTML(ev)).join("");
        const permanentRows =
          key === "sat" && permanents.length
            ? permanents.map((ev) => cardSignageListHTML(ev)).join("")
            : "";
        return `<section class="ev-signage-day" aria-labelledby="ev-signage-day-${escapeHtml(key)}">
          <h3 class="ev-signage-day-title ev-program-col-title--signage" id="ev-signage-day-${escapeHtml(key)}"><span class="ev-program-col-date">${escapeHtml(label)}</span></h3>
          <div class="ev-signage-day-rows ev-program-col-list">${rows}${permanentRows || ""}${!rows && !permanentRows ? '<p class="ev-signage-day-empty">—</p>' : ""}</div>
        </section>`;
      })
      .join("");
    return `<div class="ev-signage-schedule-grid ev-program-cols" role="region" aria-label="イベント日別スケジュール">${cols}</div>`;
  }

  const EVENT_DIALOG_FLOAT_ICONS = {
    schedule: "./images/icon-calendar-days.svg",
    venue: "./images/fa-location-pin.svg",
    speakers: "./images/fa-users.svg",
  };

  function eventDialogFloatLine(kind, bodyHtml) {
    if (!bodyHtml) return "";
    const iconSrc = EVENT_DIALOG_FLOAT_ICONS[kind];
    return `<p class="event-dialog-float-line event-dialog-float-line--${kind}">
  <img class="event-dialog-float-icon" src="${iconSrc}" alt="" width="14" height="14" decoding="async" aria-hidden="true" />
  <span class="event-dialog-float-line-body">${bodyHtml}</span>
</p>`;
  }

  function eventDialogScheduleBodyHtml(ev) {
    const dateLine = String(ev.dateLine || "").trim();
    const { start, end } = splitTimeDisplay(ev);
    const timeStr =
      start === "常設"
        ? "常設"
        : end && end !== start
          ? `${start} – ${end}`
          : start;
    const parts = [];
    if (dateLine) parts.push(`<span class="event-dialog-float-date">${escapeHtml(dateLine)}</span>`);
    if (timeStr && timeStr !== "—") {
      parts.push(`<span class="event-dialog-float-time">${escapeHtml(timeStr)}</span>`);
    }
    return parts.join("");
  }

  function eventDialogMetaHtml(ev, speakersText) {
    const venue = String(ev.venue || "").trim() || DEFAULT_EVENT_MODAL_VENUE;
    const scheduleBody = eventDialogScheduleBodyHtml(ev);
    const lines = [];
    if (scheduleBody) lines.push(eventDialogFloatLine("schedule", scheduleBody));
    if (speakersText) lines.push(eventDialogFloatLine("speakers", escapeHtml(speakersText)));
    if (venue) lines.push(eventDialogFloatLine("venue", escapeHtml(venue)));
    if (!lines.length) return "";
    return `<div class="event-dialog-float-summary">${lines.join("")}</div>`;
  }

  /** @param {boolean} onImage */
  function placeEventDialogMeta(onImage) {
    if (!eventDlgMeta || !eventDlgTitle) return;
    if (onImage && eventDlgMedia) {
      eventDlgMeta.classList.remove("event-dialog-meta--below");
      if (!eventDlgMedia.contains(eventDlgMeta)) {
        eventDlgMedia.appendChild(eventDlgMeta);
      }
    } else {
      eventDlgMeta.classList.add("event-dialog-meta--below");
      if (eventDlgTitle.nextElementSibling !== eventDlgMeta) {
        eventDlgTitle.insertAdjacentElement("afterend", eventDlgMeta);
      }
    }
  }

  function applyEventDialogProgramLabel(ev) {
    if (!eventDlgProgramLabel) return;
    const cat = ["lecture", "workshop", "permanent"].includes(ev.cat) ? ev.cat : "lecture";
    const mod = dialogProgramLabelMod(cat);
    eventDlgProgramLabel.textContent = dialogProgramLabelText(cat);
    eventDlgProgramLabel.className = `dialog-program-label dialog-program-label--${mod}`;
  }

  function fillEventDialog(ev) {
    if (!eventDialog || !eventDlgTitle || !eventDlgMeta || !eventDlgBody) return;
    eventDlgTitle.textContent = ev.name || "";
    applyEventDialogProgramLabel(ev);
    const catCls = ["lecture", "workshop", "permanent"].includes(ev.cat) ? ev.cat : "lecture";
    const speakerCfg = {
      eventSpeakerIds: SITE_CONFIG.eventSpeakerIds,
      eventFeaturedSpeakerIds: SITE_CONFIG.eventFeaturedSpeakerIds,
      eventWideSubSpeakerIds: SITE_CONFIG.eventWideSubSpeakerIds,
    };
    const speakersText = eventSpeakersInlineText(ev, speakersById, speakerCfg);
    eventDlgMeta.className = `event-dialog-meta event-dialog-float event-dialog-meta--${catCls}`;
    eventDlgMeta.setAttribute("aria-label", `${ev.name || "イベント"}の開催概要`);
    eventDlgMeta.removeAttribute("aria-labelledby");
    eventDlgMeta.innerHTML = eventDialogMetaHtml(ev, speakersText);
    let hasImage = false;
    if (eventDlgMedia && eventDlgThumb) {
      const src = pickupImageSrc(ev);
      const stem = resolveImageStem(src);
      if (stem) {
        hasImage = true;
        applyResponsiveImageToImg(eventDlgThumb, stem, inferProfileFromStem(stem));
        eventDlgThumb.alt = `${ev.name}のイメージ`;
        eventDlgMedia.hidden = false;
      } else {
        eventDlgThumb.removeAttribute("src");
        eventDlgThumb.removeAttribute("srcset");
        eventDlgThumb.alt = "";
        eventDlgMedia.hidden = true;
      }
    }
    placeEventDialogMeta(hasImage);
    const { featured, compact, wideSub } = resolveEventSpeakers(ev, speakersById, speakerCfg);
    eventDlgBody.innerHTML =
      detailBlocks(ev, { skipTags: true }) +
      renderEventSpeakersSectionHtml(ev, featured, compact, wideSub);
  }

  function openEventDialog(id, opts = {}) {
    const fromUrl = Boolean(opts.fromUrl);
    const sourceEl = opts.sourceEl || null;
    const ev = byId[id];
    if (!ev || !eventDialog) return;

    const show = () => {
      fillEventDialog(ev);
      if (typeof eventDialog.showModal === "function") eventDialog.showModal();
      if (!fromUrl) setQueryParam("event_id", id);
    };

    if (sourceEl && typeof document.startViewTransition === "function") {
      const cleanup = tagViewTransitionPair(sourceEl, eventDialog);
      withViewTransition(() => {
        show();
        requestAnimationFrame(() => cleanup());
      });
    } else {
      show();
    }
  }

  /** 開催概要スケジュール → #event へスクロール後に詳細モーダルを開く */
  function scrollToEventSectionThen(run) {
    const target = document.getElementById("event");
    if (!target) {
      run();
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const delay = reduced ? 0 : 480;
    window.setTimeout(run, delay);
  }

  function bindTimelineScheduleLinks() {
    if (!timelineRoot) return;
    timelineRoot.querySelectorAll("a.program-timeline-bar[data-event-id]").forEach((link) => {
      const id = link.getAttribute("data-event-id");
      if (!id || !byId[id]) return;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        scrollToEventSectionThen(() => openEventDialog(id));
      });
    });
  }

  function bindEventOpenTargets(scope) {
    if (!scope) return;
    scope.querySelectorAll("[data-event-id]").forEach((el) => {
      const id = el.getAttribute("data-event-id");
      if (!id) return;
      el.addEventListener("click", (e) => {
        if (e.target instanceof Element && e.target.closest("a, button")) return;
        const card = el.closest("[data-event-id]") || el;
        openEventDialog(id, { sourceEl: card instanceof HTMLElement ? card : null });
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const card = el.closest("[data-event-id]") || el;
          openEventDialog(id, { sourceEl: card instanceof HTMLElement ? card : null });
        }
      });
    });
  }

  function pickupImageSrc(ev) {
    const raw = String(ev.thumbUrl ?? "").trim();
    if (raw && !/^false$/i.test(raw)) {
      const resolved = resolveSpeakerImageUrl(raw);
      if (resolved) return resolved;
    }
    const byIdDefault = `./images/${ev.id}.png`;
    return FEATURED_IMAGE_BY_ID[ev.id] || byIdDefault || FEATURED_IMAGE_FALLBACK;
  }

  /** @param {object[]} events */
  function sortSignageCarouselEvents(events) {
    const dayOrder = { sat: 0, sun: 1, both: 2 };
    return [...events].sort((a, b) => {
      const da = dayOrder[a.day] ?? 99;
      const db = dayOrder[b.day] ?? 99;
      if (da !== db) return da - db;
      return sortSignageEvents(a, b);
    });
  }

  /** @param {object[]} orderedEvents */
  function signageEventPageHeroHTML(orderedEvents) {
    if (!orderedEvents.length) return "";
    const slidesHtml = orderedEvents
      .map((ev, j) => {
        const logicalSrc = pickupImageSrc(ev);
        const active = j === 0 ? " is-active" : "";
        const loading = j === 0 ? "eager" : "lazy";
        const media = logicalSrc
          ? pictureHTMLFromPath(logicalSrc, {
              loading,
              alt: `${ev.name}のキービジュアル`,
              sizes: "100vw",
              width: 1080,
              height: 608,
              ...(j === 0 ? { fetchpriority: "high" } : {}),
            })
          : `<div class="signage-mv-page-slide-placeholder" aria-hidden="true"></div>`;
        return `<figure class="signage-mv-page-slide${active}">${media}${signageEventInfoFloatHTML(ev, `ev-${j}`)}</figure>`;
      })
      .join("");
    return `<div class="signage-mv-page-hero">
    <div class="signage-mv-page-slideshow" role="region" aria-roledescription="カルーセル" aria-label="イベントビジュアル">
      <div class="signage-mv-page-slides-inner">${slidesHtml}</div>
      <div class="signage-mv-page-dots" aria-hidden="false"></div>
    </div>
  </div>`;
  }

  /** @param {ParentNode} host */
  function wireSignageEventPageHero(host) {
    const root = host.querySelector(".signage-mv-page-slideshow");
    if (!root) return;
    const slides = Array.from(root.querySelectorAll(".signage-mv-page-slide"));
    const dotsHost = root.querySelector(".signage-mv-page-dots");
    if (!slides.length || !dotsHost) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = 0;
    let timer = null;

    const setActive = (nextIndex) => {
      const i = (nextIndex + slides.length) % slides.length;
      index = i;
      slides.forEach((s, j) => s.classList.toggle("is-active", j === i));
      dotsHost.querySelectorAll("button").forEach((d, j) => {
        d.classList.toggle("is-active", j === i);
      });
    };

    dotsHost.textContent = "";
    slides.forEach((slideEl, j) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "signage-mv-page-dot";
      const panel = slideEl.querySelector(".mv-float-panel-title");
      b.setAttribute(
        "aria-label",
        panel?.textContent?.trim() ? panel.textContent.trim() : `スライド ${j + 1}`,
      );
      b.addEventListener("click", () => {
        setActive(j);
        if (timer) window.clearInterval(timer);
        if (!reduced) {
          timer = window.setInterval(() => setActive(index + 1), SCREENING_SLIDESHOW_INTERVAL_MS);
        }
      });
      dotsHost.appendChild(b);
    });

    setActive(resolveSignageHeroStartIndex(slides.length, "event"));
    if (reduced) return;
    timer = window.setInterval(() => setActive(index + 1), SCREENING_SLIDESHOW_INTERVAL_MS);
  }

  /** イベント CSV の「画像」「画像ファイル名」（旧「サムネURL」）→ thumbUrl 用文字列 */
  function thumbUrlFromRow(r) {
    const hasImageCol = r["画像"] !== undefined && String(r["画像"]).trim() !== "";
    if (hasImageCol && !parseBool(r["画像"])) {
      return String(r["サムネURL"] ?? "").trim();
    }
    const imageFile = String(r["画像ファイル名"] ?? "").trim();
    if (imageFile && !/^false$/i.test(imageFile)) return imageFile;
    return String(r["サムネURL"] ?? "").trim();
  }

  function pickupHeroSlideHTML(ev, idx, signage = false) {
    const logicalSrc = pickupImageSrc(ev);
    const mediaHtml = pictureHTMLFromPath(logicalSrc, {
      class: "ev-pickup-media-img",
      loading: idx === 0 ? "eager" : "lazy",
      alt: "",
      sizes: signage ? "100vw" : "(max-width: 900px) 100vw, 44vw",
      width: 640,
      height: 360,
    });
    const { start, end } = splitTimeDisplay(ev);
    const timeStr =
      start === "常設"
        ? "常設"
        : end && end !== start
          ? `${start} – ${end}`
          : start;
    const domainHtml =
      !signage && ev.domain
        ? `<span class="ev-domain">${escapeHtml(ev.domain)}</span>`
        : "";
    const speakersHtml =
      !signage && ev.speakers
        ? `<p class="ev-pickup-speakers" role="group" aria-label="登壇者"><img class="ev-speakers-icon" src="./images/fa-users.svg" alt="" width="15" height="15" decoding="async" /><span class="ev-pickup-speakers-body">${escapeHtml(ev.speakers)}</span></p>`
        : "";

    const dateLineHtml =
      !signage && ev.dateLine
        ? `<p class="ev-pickup-date-line">${escapeHtml(ev.dateLine)}</p>`
        : "";
    const timeLineHtml =
      timeStr && timeStr !== "—"
        ? `<p class="ev-pickup-time-line">${escapeHtml(timeStr)}</p>`
        : "";

    const activeCls = idx === 0 ? " is-active" : "";
    const ariaHidden = idx === 0 ? "false" : "true";
    const badgeHtml = signage ? "" : '<span class="ev-pickup-badge">注目</span>';

    if (signage) {
      return `<article class="ev-signage-hero-slide ev-pickup-slide ev-pickup-slide--${escapeHtml(ev.cat)}${activeCls}" id="ev-pickup-slide-${idx}" aria-roledescription="スライド" aria-hidden="${ariaHidden}">
      <div class="ev-signage-hero-slide-inner">
        <div class="ev-signage-hero-media">${mediaHtml}</div>
        <div class="ev-signage-hero-caption">
          <span class="ev-cat ev-cat-${escapeHtml(ev.cat)}">${escapeHtml(catLabel(ev.cat))}</span>
          <h3 class="ev-signage-hero-title ev-pickup-title">${escapeHtml(ev.name)}</h3>
          ${timeLineHtml}
        </div>
      </div>
    </article>`;
    }

    const ariaOpen = escapeHtml(`${ev.name}の詳細を開く`);
    const tabIdx = idx === 0 ? "0" : "-1";

    return `<article class="ev-pickup-slide ev-pickup-slide--${escapeHtml(ev.cat)}${activeCls}" id="ev-pickup-slide-${idx}" aria-roledescription="スライド" tabindex="${tabIdx}" role="button" data-event-id="${escapeHtml(ev.id)}" aria-label="${ariaOpen}" aria-hidden="${ariaHidden}">
      <div class="ev-pickup-slide-inner">
        <div class="ev-pickup-media">
          ${mediaHtml}
        </div>
        <div class="ev-pickup-panel">
          <div class="ev-meta ev-pickup-meta">
            <span class="ev-cat ev-cat-${escapeHtml(ev.cat)}">${escapeHtml(catLabel(ev.cat))}</span>
            ${domainHtml}
            ${badgeHtml}
          </div>
          <h3 class="ev-pickup-title" id="${escapeHtml(ev.id)}-pickup-title">${escapeHtml(ev.name)}</h3>
          ${dateLineHtml}
          ${timeLineHtml}
          ${speakersHtml}
        </div>
      </div>
    </article>`;
  }

  function featuredPickupMarkup(featuredTimed, signage = false) {
    const slides = featuredTimed.map((ev, idx) => pickupHeroSlideHTML(ev, idx, signage)).join("");
    if (signage) {
      return `<div class="ev-signage-hero-carousel ev-pickup-hero" id="ev-pickup-carousel-root" role="region" aria-roledescription="カルーセル" aria-label="注目プログラム">
        <span class="ev-pickup-carousel-live" aria-live="polite"></span>
        <div class="ev-signage-hero-track ev-pickup-slides-track" id="ev-pickup-slides-track">
          ${slides}
        </div>
        <div class="ev-signage-hero-controls ev-pickup-carousel-controls">
          <div class="ev-pickup-dots" aria-label="注目スライドの選択"></div>
        </div>
      </div>`;
    }
    return `<h4 id="ev-pickup-heading" class="ev-pickup-heading">注目プログラム</h4>
      <div class="ev-pickup-hero" id="ev-pickup-carousel-root" role="region" aria-roledescription="カルーセル" aria-label="注目プログラム" aria-labelledby="ev-pickup-heading">
        <span class="ev-pickup-carousel-live" aria-live="polite"></span>
        <div class="ev-pickup-slides-track" id="ev-pickup-slides-track">
          ${slides}
        </div>
        <div class="ev-pickup-carousel-controls">
          <div class="ev-pickup-dots" aria-label="注目スライドの選択"></div>
        </div>
      </div>`;
  }

  async function load() {
    let records;
    let hasMainColumn = false;
    try {
      const evPromise = fetch(CSV_URL, { cache: "no-store" });
      const spPromise = fetch(SITE_CONFIG.speakersCsvUrl, { cache: "no-store" }).catch(() => null);
      const res = await evPromise;
      if (!res.ok) throw new Error(String(res.status));
      const text = (await res.text()).replace(/^\uFEFF/, "");
      const matrix = parseCSV(text);
      if (!matrix.length) throw new Error("empty");
      const headers = matrix[0].map((h) => h.trim());
      hasMainColumn = headers.includes("メイン");
      records = matrix.slice(1).map((cells) => rowToObj(headers, cells));

      const spRes = await spPromise;
      if (spRes?.ok) {
        try {
          speakersById = parseSpeakersCsvText(await spRes.text());
        } catch {
          speakersById = {};
        }
      } else {
        speakersById = {};
      }
      if (!Object.keys(speakersById).length) {
        const fb = await fetch("./data/speakers.csv", { cache: "no-store" }).catch(() => null);
        if (fb?.ok) {
          try {
            speakersById = parseSpeakersCsvText(await fb.text());
          } catch {
            speakersById = {};
          }
        }
      }
    } catch {
      listHost.innerHTML =
        '<p class="ev-load-error" role="alert">イベントデータを読み込めませんでした。しばらくしてから再度お試しください。</p>';
      if (pickupHost) {
        pickupHost.innerHTML = "";
        pickupHost.hidden = true;
      }
      permanentHost.innerHTML = "";
      permanentHost.hidden = true;
      if (timelineRoot) {
        timelineRoot.hidden = true;
        timelineRoot.innerHTML = "";
      }
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
      return;
    }

    const DESC_KEY = "説明（200文字程度）";

    /** HH:MM を含むか（時間列の検証・列ずれ救済用） */
    function cellLooksLikeTimeRange(s) {
      return /\d{1,2}:\d{2}/.test(String(s || ""));
    }

    /**
     * 書き出しCSVで列がずれたとき、時間列に登壇者名だけが入るケースを救済する。
     * ・時間セルに時刻がなく文字だけ → 登壇者へ移す（登壇者が空のとき）
     * ・時間に文字・登壇者に時刻 → 入れ替え
     */
    function normalizeTimeAndSpeakers(r) {
      let timeLine = String(r["時間2行目"] ?? "").trim();
      let speakers = String(r["登壇者"] ?? "").trim();

      if (!timeLine || timeLine === "常設" || cellLooksLikeTimeRange(timeLine)) {
        return { timeLine, speakers };
      }
      if (/^(時間未定|未定|TBD|調整中)$/i.test(timeLine)) {
        return { timeLine, speakers };
      }
      if (cellLooksLikeTimeRange(speakers)) {
        return { timeLine: speakers, speakers: timeLine };
      }
      const merged = [speakers, timeLine].filter(Boolean).join(" ").trim();
      return { timeLine: "", speakers: merged };
    }

    const events = records.map((r) => {
      const { timeLine, speakers } = normalizeTimeAndSpeakers(r);
      const id = String(r["ID"] || "").trim();
      const featured = hasMainColumn
        ? parseBool(r["メイン"] ?? "")
        : FEATURED_EVENT_IDS.includes(id);
      return {
        id,
        cat: (r["カテゴリ"] || "").trim().toLowerCase(),
        name: (r["イベント名"] || "").replace(/\s+/g, " ").trim(),
        domain: r["担当分野"] || "",
        venue: (r["会場"] || "").replace(/\s+/g, " ").trim(),
        speakers,
        dateLine: r["日付1行目"] || "",
        timeLine,
        tagsRaw: r["タグ"] || "",
        desc: (r[DESC_KEY] || "").trim(),
        thumbUrl: thumbUrlFromRow(r),
        apply: parseBool(r["申込要否"] || ""),
        applyUrl: (r["申込URL"] || "").trim(),
        sort: Number((r["表示順"] || "999").trim()) || 999,
        day: dayKeyFromDateStr(r["日付1行目"] || ""),
        featured,
      };
    });

    byId = Object.fromEntries(events.filter((e) => e.id).map((e) => [e.id, e]));

    const permanents = events
      .filter((e) => e.cat === "permanent")
      .sort((a, b) => {
        const ta = timeSortKey(a.timeLine || "");
        const tb = timeSortKey(b.timeLine || "");
        if (ta !== tb) return ta - tb;
        const ea = timeEndSortKey(a.timeLine || "");
        const eb = timeEndSortKey(b.timeLine || "");
        if (ea !== eb) return ea - eb;
        return a.sort - b.sort;
      });

    const timed = events.filter((e) => e.cat !== "permanent" && e.day && e.day !== "both");

    const dayOrder = { sat: 0, sun: 1 };
    function sortFeaturedPick(a, b) {
      const da = dayOrder[a.day] ?? 99;
      const db = dayOrder[b.day] ?? 99;
      if (da !== db) return da - db;
      const ta = timeSortKey(a.timeLine || "");
      const tb = timeSortKey(b.timeLine || "");
      if (ta !== tb) return ta - tb;
      const ea = timeEndSortKey(a.timeLine || "");
      const eb = timeEndSortKey(b.timeLine || "");
      if (ea !== eb) return ea - eb;
      return a.sort - b.sort;
    }

    if (isSignageEvent) {
      const scheduleTimed = events.filter((e) => e.cat !== "permanent" && e.day);
      const carouselEvents = sortSignageCarouselEvents([...scheduleTimed, ...permanents]);

      if (pickupHost) {
        if (carouselEvents.length) {
          pickupHost.hidden = false;
          pickupHost.innerHTML = signageEventPageHeroHTML(carouselEvents);
          wireSignageEventPageHero(pickupHost);
        } else {
          pickupHost.hidden = true;
          pickupHost.innerHTML = "";
        }
      }

      if (listHost) {
        listHost.innerHTML = signageScheduleGridHTML(scheduleTimed, permanents);
      }

      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
      return;
    }

    if (permanents.length) {
      permanentHost.hidden = false;
      permanentHost.innerHTML = `<div class="day-sep">
              <span class="day-sep-text">常設プログラム</span>
              <span class="day-sep-line"></span>
            </div>${permanents.map(cardHTML).join("")}`;
    } else {
      permanentHost.hidden = true;
      permanentHost.innerHTML = "";
    }

    const featuredTimed = timed.filter((e) => e.featured).sort(sortFeaturedPick);
    if (pickupHost) {
      if (featuredTimed.length) {
        pickupHost.hidden = false;
        pickupHost.innerHTML = featuredPickupMarkup(featuredTimed);
        initEvPickupCarousel(pickupHost.querySelector(".ev-pickup-hero"));
      } else {
        pickupHost.hidden = true;
        pickupHost.innerHTML = "";
      }
    }

    const days = [
      { key: "sat", label: "7/18（土）" },
      { key: "sun", label: "7/19（日）" },
    ];

    let html = "";
    days.forEach(({ key, label }) => {
      const evs = timed
        .filter((e) => e.day === key)
        .sort((a, b) => {
          const ta = timeSortKey(a.timeLine || "");
          const tb = timeSortKey(b.timeLine || "");
          if (ta !== tb) return ta - tb;
          const ea = timeEndSortKey(a.timeLine || "");
          const eb = timeEndSortKey(b.timeLine || "");
          if (ea !== eb) return ea - eb;
          return a.sort - b.sort;
        });
      if (!evs.length) return;
      html += `<div class="day-sep">
              <span class="day-sep-text">${escapeHtml(label)}</span>
              <span class="day-sep-line"></span>
            </div>`;
      html += evs.map((ev) => cardHTML(ev)).join("");
    });

    fillProgramTimeline(timelineRoot, events);
    bindTimelineScheduleLinks();

    listHost.innerHTML =
      html ||
      '<p class="ev-empty">タイムテーブルに表示できるイベントがありません。</p>';

    bindEventOpenTargets(sectionRoot);

    const deepId = getQueryParam("event_id");
    if (deepId && byId[deepId]) openEventDialog(deepId, { fromUrl: true });

    if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
  }

  load();
}
