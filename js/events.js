import { SITE_CONFIG } from "./config.js";
import { parseCSV, rowToObj } from "./lib/csv.js";
import { escapeHtml } from "./lib/html.js";
import { timeSortKey, timeEndSortKey } from "./lib/event-time.js";
import { fillProgramTimeline } from "./timeline-ui.js";

export function initEventsSection() {
  const permanentHost = document.getElementById("ev-permanent-list");
  const listHost = document.getElementById("ev-list");
  const timelineRoot = document.getElementById("about-timeline-root");
  const sectionRoot = document.querySelector("#event .ev-section");
  if (!permanentHost || !listHost) return;
  if (document.body.dataset.signage === "screening") {
    if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
    return;
  }

  const CSV_URL = SITE_CONFIG.eventsCsvUrl;
  const DETAIL_PLACEHOLDER =
    "詳細テキストは準備中です。開催にあわせて内容を更新します。最新情報はInstagram（@mediastudies_kwu）もご確認ください。";

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

  function detailBlocks(ev) {
    const tags = tagsFromCell(ev.tagsRaw);
    const parts = [];
    if (ev.desc) {
      parts.push(`<p class="ev-desc">${escapeHtml(ev.desc)}</p>`);
    } else {
      parts.push(
        `<p class="ev-desc ev-desc--placeholder">${escapeHtml(DETAIL_PLACEHOLDER)}</p>`,
      );
    }
    if (tags.length) {
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

    return `<div class="ev-card ev-card--${escapeHtml(ev.cat)}" id="${escapeHtml(ev.id)}">
    <div class="ev-time">
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

  async function load() {
    let records;
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const text = (await res.text()).replace(/^\uFEFF/, "");
      const matrix = parseCSV(text);
      if (!matrix.length) throw new Error("empty");
      const headers = matrix[0].map((h) => h.trim());
      records = matrix.slice(1).map((cells) => rowToObj(headers, cells));
    } catch {
      listHost.innerHTML =
        '<p class="ev-load-error" role="alert">イベントデータを読み込めませんでした。しばらくしてから再度お試しください。</p>';
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
      return {
        id: r["ID"] || "",
        cat: (r["カテゴリ"] || "").trim().toLowerCase(),
        name: (r["イベント名"] || "").replace(/\s+/g, " ").trim(),
        domain: r["担当分野"] || "",
        venue: (r["会場"] || "").replace(/\s+/g, " ").trim(),
        speakers,
        dateLine: r["日付1行目"] || "",
        timeLine,
        tagsRaw: r["タグ"] || "",
        desc: (r[DESC_KEY] || "").trim(),
        apply: parseBool(r["申込要否"] || ""),
        applyUrl: (r["申込URL"] || "").trim(),
        sort: Number((r["表示順"] || "999").trim()) || 999,
        day: dayKeyFromDateStr(r["日付1行目"] || ""),
      };
    });

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
      html += evs.map(cardHTML).join("");
    });

    fillProgramTimeline(timelineRoot, events);

    listHost.innerHTML =
      html ||
      '<p class="ev-empty">タイムテーブルに表示できるイベントがありません。</p>';

    if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
  }

  load();
}
