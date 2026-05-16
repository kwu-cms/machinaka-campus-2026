import {
  SITE_CONFIG,
  FEATURED_EVENT_IDS,
  FEATURED_IMAGE_BY_ID,
  FEATURED_IMAGE_FALLBACK,
  FEATURED_PICKUP_CAROUSEL_INTERVAL_MS,
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
} from "./speaker-blocks.js";

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
  if (document.body.dataset.signage === "screening") return;

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

export function initEventsSection() {
  const permanentHost = document.getElementById("ev-permanent-list");
  const listHost = document.getElementById("ev-list");
  const pickupHost = document.getElementById("ev-pickup");
  const timelineRoot = document.getElementById("about-timeline-root");
  const sectionRoot = document.querySelector("#event .ev-section");
  const eventDialog = document.getElementById("event-detail-dialog");
  const eventDlgTitle = eventDialog?.querySelector("#event-dialog-title");
  const eventDlgProgramLabel = eventDialog?.querySelector("#event-dialog-program-label");
  const eventDlgMeta = eventDialog?.querySelector(".event-dialog-meta");
  const eventDlgBody = eventDialog?.querySelector("#event-dialog-body");
  const eventDlgMedia = eventDialog?.querySelector(".event-dialog-media");
  const eventDlgThumb = eventDialog?.querySelector(".event-dialog-thumb");

  /** @type {Record<string, object>} */
  let byId = {};

  if (!permanentHost || !listHost) return;
  if (document.body.dataset.signage === "screening") {
    if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
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
    if (cat === "workshop") return "Workshop";
    if (cat === "lecture") return "Lecture";
    if (cat === "permanent") return "常設";
    return cat;
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

  function timeColumnHtml(ev) {
    const { start, end } = splitTimeDisplay(ev);
    if (ev.cat === "permanent" || start === "常設") {
      return `<div class="ev-time-inner ev-time-inner--empty" aria-hidden="true"></div>`;
    }
    const hasDistinctRange = Boolean(end && end !== start);
    if (hasDistinctRange) {
      return `<div class="ev-time-inner" aria-label="${escapeHtml(start)}から${escapeHtml(end)}まで">
      <span class="ev-time-part">${escapeHtml(start)}</span><span class="ev-time-sep" aria-hidden="true">–</span><span class="ev-time-part">${escapeHtml(end)}</span>
    </div>`;
    }
    return `<div class="ev-time-inner"><span class="ev-time-part">${escapeHtml(start)}</span></div>`;
  }

  function cardHTML(ev) {
    const detailInner = detailBlocks(ev);
    const domainHtml = ev.domain
      ? `<span class="ev-domain">${escapeHtml(ev.domain)}</span>`
      : "";
    const speakersHtml = ev.speakers
      ? `<p class="ev-speakers" role="group" aria-label="登壇者"><img class="ev-speakers-icon" src="./images/fa-users.svg" alt="" width="15" height="15" decoding="async" /><span class="ev-speakers-body">${escapeHtml(ev.speakers)}</span></p>`
      : "";
    const ariaOpen = escapeHtml(`${ev.name}の詳細を開く`);

    const timeBg = `../images/${ev.id}.png`;
    const timeColCls = timeBg ? " ev-time--visual" : "";
    const timeColStyle = timeBg ? ` style="--ev-time-bg: url('${timeBg}')"` : "";

    return `<div class="ev-card ev-card--${escapeHtml(ev.cat)}" id="${escapeHtml(ev.id)}" tabindex="0" role="button" data-event-id="${escapeHtml(ev.id)}" aria-label="${ariaOpen}">
    <div class="ev-time${timeColCls}"${timeColStyle}>
      ${timeColumnHtml(ev)}
    </div>
    <div class="ev-body">
      <div class="ev-meta">
        <span class="ev-cat ev-cat-${escapeHtml(ev.cat)}">${escapeHtml(catLabel(ev.cat))}</span>
        ${domainHtml}
        ${ev.apply ? '<span class="ev-apply-inline">要申込</span>' : ""}
      </div>
      <div class="ev-title">${escapeHtml(ev.name)}</div>
      ${speakersHtml}
      <div class="ev-detail">${detailInner}</div>
    </div>
  </div>`;
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
      if (src) {
        hasImage = true;
        eventDlgThumb.src = src;
        eventDlgThumb.alt = `${ev.name}のイメージ`;
        eventDlgMedia.hidden = false;
      } else {
        eventDlgThumb.removeAttribute("src");
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
    const ev = byId[id];
    if (!ev || !eventDialog) return;
    fillEventDialog(ev);
    if (typeof eventDialog.showModal === "function") eventDialog.showModal();
    if (!fromUrl) setQueryParam("event_id", id);
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
        openEventDialog(id);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEventDialog(id);
        }
      });
    });
  }

  function pickupImageSrc(ev) {
    const raw = String(ev.thumbUrl ?? "").trim();
    if (raw && !/^false$/i.test(raw)) return raw;
    const byIdDefault = `./images/${ev.id}.png`;
    return FEATURED_IMAGE_BY_ID[ev.id] || byIdDefault || FEATURED_IMAGE_FALLBACK;
  }

  function pickupHeroSlideHTML(ev, idx) {
    const imgSrc = escapeHtml(pickupImageSrc(ev));
    const { start, end } = splitTimeDisplay(ev);
    const timeStr =
      start === "常設"
        ? "常設"
        : end && end !== start
          ? `${start} – ${end}`
          : start;
    const domainHtml = ev.domain
      ? `<span class="ev-domain">${escapeHtml(ev.domain)}</span>`
      : "";
    const speakersHtml = ev.speakers
      ? `<p class="ev-pickup-speakers" role="group" aria-label="登壇者"><img class="ev-speakers-icon" src="./images/fa-users.svg" alt="" width="15" height="15" decoding="async" /><span class="ev-pickup-speakers-body">${escapeHtml(ev.speakers)}</span></p>`
      : "";

    const dateLineHtml = ev.dateLine
      ? `<p class="ev-pickup-date-line">${escapeHtml(ev.dateLine)}</p>`
      : "";
    const timeLineHtml =
      timeStr && timeStr !== "—"
        ? `<p class="ev-pickup-time-line">${escapeHtml(timeStr)}</p>`
        : "";

    const ariaOpen = escapeHtml(`${ev.name}の詳細を開く`);
    const activeCls = idx === 0 ? " is-active" : "";
    const ariaHidden = idx === 0 ? "false" : "true";
    const tabIdx = idx === 0 ? "0" : "-1";

    return `<article class="ev-pickup-slide ev-pickup-slide--${escapeHtml(ev.cat)}${activeCls}" id="ev-pickup-slide-${idx}" aria-roledescription="スライド" tabindex="${tabIdx}" role="button" data-event-id="${escapeHtml(ev.id)}" aria-label="${ariaOpen}" aria-hidden="${ariaHidden}">
      <div class="ev-pickup-slide-inner">
        <div class="ev-pickup-media">
          <img class="ev-pickup-media-img" src="${imgSrc}" alt="" width="960" height="540" decoding="async" loading="${idx === 0 ? "eager" : "lazy"}" />
        </div>
        <div class="ev-pickup-panel">
          <div class="ev-meta ev-pickup-meta">
            <span class="ev-cat ev-cat-${escapeHtml(ev.cat)}">${escapeHtml(catLabel(ev.cat))}</span>
            ${domainHtml}
            <span class="ev-pickup-badge">注目</span>
          </div>
          <h3 class="ev-pickup-title" id="${escapeHtml(ev.id)}-pickup-title">${escapeHtml(ev.name)}</h3>
          ${dateLineHtml}
          ${timeLineHtml}
          ${speakersHtml}
        </div>
      </div>
    </article>`;
  }

  function featuredPickupMarkup(featuredTimed) {
    const slides = featuredTimed.map((ev, idx) => pickupHeroSlideHTML(ev, idx)).join("");
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
        thumbUrl: String(r["サムネURL"] ?? "").trim(),
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
