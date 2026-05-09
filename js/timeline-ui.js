import { PROGRAM_TIMELINE } from "./config.js";
import { escapeHtml } from "./lib/html.js";
import { timeSortKey, timeEndSortKey } from "./lib/event-time.js";
import { intersectAxisRange, parseHmToMinutes, eventTimedRangeMinutes } from "./lib/timeline.js";

function tagLabelForMod(mod) {
  if (mod === "exhibition") return "展示";
  if (mod === "screening") return "上映プログラム";
  if (mod === "workshop") return "ワークショップ";
  return "トークイベント";
}

function barBodyFromParts(timeHtml, nameHtml, mod) {
  const tag = escapeHtml(tagLabelForMod(mod));
  return `<span class="program-timeline-bar-meta"><span class="program-timeline-bar-time">${timeHtml}</span><span class="program-timeline-bar-tag">${tag}</span></span><span class="program-timeline-bar-name">${nameHtml}</span>`;
}

/** `day === "both"` のイベントはタイムライン上のみ土日の両方に複製して表示する（一覧側は対象外のまま） */
export function fillProgramTimeline(root, allEvents) {
  if (!root) return;
  if (document.body.dataset.signage) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }

  const axisLo = PROGRAM_TIMELINE.axisStartMin;
  const axisHi = PROGRAM_TIMELINE.axisEndMin;

  function barChipHtml(attrs) {
    const { mod, title, ariaLabel, href, inner } = attrs;
    const t = escapeHtml(title);
    const aVal = escapeHtml(ariaLabel);
    const cls = mod ? ` program-timeline-bar--${escapeHtml(mod)}` : "";
    const body = `<span class="program-timeline-bar-label">${inner}</span>`;
    const clsAttr = `class="program-timeline-bar${cls}" title="${t}"`;
    if (href) {
      return `<a ${clsAttr} href="${escapeHtml(href)}" aria-label="${aVal}">${body}</a>`;
    }
    return `<span ${clsAttr} role="img" aria-label="${aVal}">${body}</span>`;
  }

  function timedLikeFor(dayKey) {
    return allEvents
      .filter((e) => e.cat !== "permanent" && e.day && (e.day === dayKey || e.day === "both"))
      .sort((a, b) => {
        const ta = timeSortKey(a.timeLine || "");
        const tb = timeSortKey(b.timeLine || "");
        if (ta !== tb) return ta - tb;
        const ea = timeEndSortKey(a.timeLine || "");
        const eb = timeEndSortKey(b.timeLine || "");
        if (ea !== eb) return ea - eb;
        return (a.sort || 999) - (b.sort || 999);
      });
  }

  function exhibitionBarsHtml() {
    const exh = PROGRAM_TIMELINE.exhibition;
    const exhS = parseHmToMinutes(exh.start);
    const exhE = parseHmToMinutes(exh.end);
    if (exhS == null || exhE == null) return "";
    const exhR = intersectAxisRange(exhS, exhE, axisLo, axisHi);
    if (!exhR) return "";
    const timeLine = escapeHtml(`${exh.start}–${exh.end}`);
    const nameLine = escapeHtml(exh.label);
    return barChipHtml({
      mod: "exhibition",
      title: `${exh.label} ${exh.start}～${exh.end}／${exh.venue}`,
      ariaLabel: `${exh.label}、${exh.start}から${exh.end}まで。${exh.venue}`,
      href: "#exhibition",
      inner: barBodyFromParts(timeLine, nameLine, "exhibition"),
    });
  }

  function eventsLayerBarsHtml(dayKey) {
    const queued = [];

    const mv = PROGRAM_TIMELINE.screening;
    const mvLabelInline = mv.label.replace(/\s*\n\s*/g, "");
    const mStart = parseHmToMinutes(mv.start);
    const mEnd = parseHmToMinutes(mv.end);
    if (mStart != null && mEnd != null) {
      const rng = intersectAxisRange(mStart, mEnd, axisLo, axisHi);
      if (rng) {
        const timeLine = escapeHtml(mv.timeDisplay);
        const nameLine = escapeHtml(mv.label);
        queued.push({
          sort: timeSortKey(mv.timeDisplay || mv.start || ""),
          ord: 0,
          args: {
            mod: "screening",
            title: `${mvLabelInline} ${mv.timeDisplay}／${mv.venue}`,
            ariaLabel: `${mvLabelInline}、${mv.timeDisplay}、${mv.venue}`,
            href: "#screening",
            inner: barBodyFromParts(timeLine, nameLine, "screening"),
          },
        });
      }
    }

    let ord = 1;
    for (const ev of timedLikeFor(dayKey)) {
      const raw = eventTimedRangeMinutes(ev);
      if (!raw) continue;
      const rng = intersectAxisRange(raw.start, raw.end, axisLo, axisHi);
      if (!rng) continue;
      const catMod = ["lecture", "workshop"].includes(ev.cat) ? ev.cat : "lecture";
      const timeSnippet = String(ev.timeLine || "").trim();
      const venuePart = ev.venue ? `／${ev.venue}` : "";
      const title = `${ev.name} ${timeSnippet}${venuePart}`;
      const ariaLabel = `${ev.name}、${timeSnippet}${venuePart}`;
      let hrefFrag = "#event";
      if (ev.id && /^[\w\-]+$/.test(ev.id)) hrefFrag = `#${ev.id}`;
      const timeLine = escapeHtml(timeSnippet);
      const nameLine = escapeHtml(ev.name);
      queued.push({
        sort: timeSortKey(ev.timeLine || ""),
        ord: ord++,
        args: {
          mod: catMod,
          title,
          ariaLabel,
          href: hrefFrag,
          inner: barBodyFromParts(timeLine, nameLine, catMod),
        },
      });
    }

    queued.sort((a, b) => {
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.ord - b.ord;
    });

    return queued.map((q) => barChipHtml(q.args)).join("");
  }

  function dayPaneHtml(key, label, aria) {
    const exhBars = exhibitionBarsHtml();
    const evBars = eventsLayerBarsHtml(key);
    return `<div class="program-timeline-day-block" data-timeline-day="${escapeHtml(key)}" aria-label="${escapeHtml(aria)}">
              <p class="program-timeline-day-heading">${escapeHtml(label)}</p>
              <div class="program-timeline-day-tracks">
                <div class="program-timeline-sheet program-timeline-sheet--exh"><div class="program-timeline-bars">${exhBars}</div></div>
                <div class="program-timeline-sheet program-timeline-sheet--ev"><div class="program-timeline-bars">${evBars}</div></div>
              </div>
            </div>`;
  }

  const panesHtml =
    dayPaneHtml(
      "sat",
      "7/18（土）",
      "2026年7月18日土曜日、展示・イベント・上映の時間帯の見取り図",
    ) +
    dayPaneHtml(
      "sun",
      "7/19（日）",
      "2026年7月19日日曜日、展示・イベント・上映の時間帯の見取り図",
    );

  root.innerHTML = `<div class="program-timeline-inner">
              <div class="program-timeline-scroll-host">
                <div class="program-timeline-compact">${panesHtml}</div>
              </div>
            </div>`;
  root.hidden = false;
  root.classList.add("show");
}
