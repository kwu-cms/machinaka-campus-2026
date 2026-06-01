import { escapeHtml } from "./lib/html.js";
import { parseCSV, rowToObj } from "./lib/csv.js";
import { pictureHTMLFromPath, resolveImageStem, inferProfileFromStem } from "./lib/responsive-image.js";

const H = {
  id: "speaker_id",
  display: "表示名",
  legal: "氏名",
  kind: "種別",
  title: "肩書",
  imageFile: "画像ファイル名",
  photo: "プロフィール画像の共有（外部ゲストのみ）",
  profile: "プロフィール（200文字程度）",
  notes: "備考",
};

function looksLikeUrl(s) {
  const t = String(s || "").trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t) || t.startsWith("./") || t.startsWith("/");
}

const PROFILE_EXTERNAL_URL_RE = /https?:\/\/[^\s<>"']+/gi;

/** プロフィール文の改行と http(s) URL を外部リンク化（エスケープ済み HTML を返す） */
function formatSpeakerProfileHtml(raw) {
  const text = String(raw || "");
  if (!text) return "";
  const escaped = escapeHtml(text);
  const withBreaks = escaped.replace(/\r\n|\r|\n/g, "<br>");
  return withBreaks.replace(PROFILE_EXTERNAL_URL_RE, (match) => {
    let href = match;
    let suffix = "";
    const punct = href.match(/[.,;:!?、。]+$/);
    if (punct) {
      suffix = punct[0];
      href = href.slice(0, -suffix.length);
    }
    if (!href) return match;
    return `<a href="${href}" class="event-speaker-profile-link" target="_blank" rel="noopener noreferrer">${href}</a>${suffix}`;
  });
}

/** 画像ファイル名（images/ 配下）または共有 URL → 表示用 src */
export function resolveSpeakerImageUrl(raw) {
  const t = String(raw || "").trim();
  if (!t || /^(true|false)$/i.test(t)) return "";
  if (looksLikeUrl(t)) return t;
  if (t.startsWith("images/")) return t.startsWith("./") ? t : `./${t}`;
  if (t.startsWith("./") || t.startsWith("../")) return t;
  return `./images/${t.replace(/^\.?\//, "")}`;
}

export function speakerFromRow(r) {
  const id = String(r[H.id] ?? "").trim();
  if (!id) return null;
  const imageFile = String(r[H.imageFile] ?? "").trim();
  const photoRaw = String(r[H.photo] ?? "").trim();
  const profileCell = String(r[H.profile] ?? "").trim();
  let profile = profileCell;
  if (!profile && photoRaw && !looksLikeUrl(photoRaw) && photoRaw.length > 12) {
    profile = photoRaw;
  }
  const titleRaw = String(r[H.title] ?? "").trim();
  const kind = String(r[H.kind] ?? "").trim();
  let title = titleRaw;
  if (!profile && title.length > 45 && kind.includes("学生")) {
    profile = title;
    title = "";
  }
  const photoUrl =
    resolveSpeakerImageUrl(imageFile) || (looksLikeUrl(photoRaw) ? photoRaw : "");
  return {
    id,
    displayName: String(r[H.display] ?? "").trim(),
    legalName: String(r[H.legal] ?? "").trim(),
    kind,
    title,
    photoUrl,
    profile: profile || "",
  };
}

export function parseSpeakersCsvText(text) {
  const matrix = parseCSV(text.replace(/^\uFEFF/, ""));
  if (!matrix.length) return {};
  const headers = matrix[0].map((h) => h.trim());
  const byId = {};
  for (const cells of matrix.slice(1)) {
    const row = rowToObj(headers, cells);
    const sp = speakerFromRow(row);
    if (sp) byId[sp.id] = sp;
  }
  return byId;
}

function stripParenName(s) {
  return String(s || "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
}

export function matchSpeakersFromLine(speakerLine, speakerList) {
  const tokens = String(speakerLine || "")
    .split(/[,、]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = [];
  for (const tok of tokens) {
    const plain = stripParenName(tok);
    const hit = speakerList.find((sp) => {
      if (!sp.displayName && !sp.legalName) return false;
      if (sp.displayName === tok || sp.legalName === tok) return true;
      if (sp.displayName === plain || sp.legalName === plain) return true;
      if (sp.displayName.includes(tok) || tok.includes(sp.displayName)) return true;
      return false;
    });
    if (hit && !out.some((x) => x.id === hit.id)) out.push(hit);
  }
  return out;
}

function sectionHeadingForCat(cat) {
  if (cat === "workshop") return "講師";
  if (cat === "permanent") return "担当";
  return "登壇者";
}

function iconSrcForKind(kind) {
  const k = String(kind || "");
  if (k.includes("外部")) return "./images/fa-up-right-from-square.svg";
  if (k.includes("教員")) return "./images/user-alt.svg";
  return "./images/fa-users.svg";
}

function isStudentKind(kind) {
  return String(kind || "").includes("学生");
}

function speakerPhotoProfile(photoUrl) {
  const stem = resolveImageStem(photoUrl);
  const base = stem.split("/").pop() || stem;
  if (/^guest_/i.test(base) || /^irodori_/i.test(base)) return "guest";
  return inferProfileFromStem(stem);
}

function renderFeatureCard(cat, sp, { sub = false } = {}) {
  const nameLine = sp.displayName || sp.legalName || sp.id;
  const subCls = sub ? " event-speaker-feature--sub" : "";
  const cardCls = sub ? "event-guest-mock-card event-guest-mock-card--sub" : "event-guest-mock-card";
  const titleLine = sp.title ? `<p class="event-speaker-feature__title">${escapeHtml(sp.title)}</p>` : "";
  const studentCls = isStudentKind(sp.kind) ? " event-guest-mock--student" : "";
  const bio = sp.profile
    ? `<p class="event-guest-mock-bio${isStudentKind(sp.kind) ? " event-guest-mock-bio--student" : ""}">${formatSpeakerProfileHtml(sp.profile)}</p>`
    : "";
  const initial = escapeHtml(String(nameLine || "?").charAt(0));
  const guestPic =
    pictureHTMLFromPath(sp.photoUrl, {
      profile: speakerPhotoProfile(sp.photoUrl),
      class: "event-guest-mock-thumb",
      alt: nameLine,
      loading: "eager",
    }) ||
    (sp.photoUrl
      ? `<img class="event-guest-mock-thumb" src="${escapeHtml(sp.photoUrl)}" alt="${escapeHtml(nameLine)}" width="240" height="240" loading="lazy" decoding="async" />`
      : "");
  const aside = guestPic
    ? `<div class="event-guest-mock-aside">${guestPic}</div>`
    : `<div class="event-guest-mock-aside event-guest-mock-aside--nophoto" aria-hidden="true">
        <span class="event-guest-mock-initial">${initial}</span>
      </div>`;
  return `<div class="event-speaker-feature event-guest-mock event-guest-mock--${escapeHtml(cat)}${subCls}${studentCls}">
      <div class="${cardCls}">
        ${aside}
        <div class="event-guest-mock-body">
          <p class="event-guest-mock-name">${escapeHtml(nameLine)}</p>
          ${titleLine}
          ${bio}
        </div>
      </div>
    </div>`;
}

function renderCompactItem(sp, { fullWidth = false } = {}) {
  const nameLine = sp.displayName || sp.legalName || sp.id;
  const role = sp.title ? `<p class="event-speaker-mini__role">${escapeHtml(sp.title)}</p>` : "";
  const profileText = sp.profile || "";
  const noteLimit = fullWidth ? 280 : 120;
  const icon = iconSrcForKind(sp.kind);
  const fullCls = fullWidth ? " event-speaker-mini--full" : "";
  const studentCls = isStudentKind(sp.kind) ? " event-speaker-mini--student" : "";
  const noteCls = isStudentKind(sp.kind) ? " event-speaker-mini__note--student" : "";
  const notePlain =
    profileText.length > noteLimit ? `${profileText.slice(0, noteLimit)}…` : profileText;
  const note = profileText
    ? `<p class="event-speaker-mini__note${noteCls}">${formatSpeakerProfileHtml(notePlain)}</p>`
    : "";
  return `<li class="event-speaker-mini${fullCls}${studentCls}">
      <span class="event-speaker-mini__icon" aria-hidden="true">
        <img src="${escapeHtml(icon)}" alt="" width="18" height="18" decoding="async" />
      </span>
      <div class="event-speaker-mini__body">
        <p class="event-speaker-mini__name">${escapeHtml(nameLine)}</p>
        ${role}
        ${note}
      </div>
    </li>`;
}

export function renderEventSpeakersSectionHtml(ev, featured, compact, wideSub) {
  const main = featured || [];
  const mini = compact || [];
  const wide = wideSub || [];
  if (!main.length && !mini.length && !wide.length) return "";
  const cat = ["lecture", "workshop", "permanent"].includes(ev.cat) ? ev.cat : "lecture";
  const h = sectionHeadingForCat(cat);
  let html = `<section class="event-speakers-block event-speakers-block--${escapeHtml(cat)}" aria-label="${escapeHtml(h)}">`;
  html += `<h4 class="event-speakers-block__heading">${escapeHtml(h)}</h4>`;
  if (main.length) {
    html += `<div class="event-speakers-featured-list">`;
    html += main.map((sp) => renderFeatureCard(cat, sp)).join("");
    html += `</div>`;
  }
  if (mini.length || wide.length) {
    const singleColCompact =
      ["evt-02", "evt-03"].includes(ev.id) && mini.length > 0;
    html += `<ul class="event-speaker-compact-list${
      singleColCompact ? " event-speaker-compact-list--single-col" : ""
    }" role="list">`;
    html += mini.map((sp) => renderCompactItem(sp)).join("");
    html += wide.map((sp) => renderCompactItem(sp, { fullWidth: true })).join("");
    html += `</ul>`;
  }
  html += `</section>`;
  return html;
}

export function resolveEventSpeakers(ev, speakersById, cfg) {
  const list = Object.values(speakersById);
  if (!list.length) return { featured: [], compact: [], wideSub: [] };

  let ordered = [];
  const explicit = cfg.eventSpeakerIds?.[ev.id];
  if (explicit && explicit.length) {
    ordered = explicit.map((id) => speakersById[id]).filter(Boolean);
  }
  if (!ordered.length) {
    ordered = matchSpeakersFromLine(ev.speakers, list);
  }
  if (!ordered.length) return { featured: [], compact: [], wideSub: [] };

  const wideCfg = cfg.eventWideSubSpeakerIds;
  const wideIds =
    wideCfg && Object.prototype.hasOwnProperty.call(wideCfg, ev.id) ? wideCfg[ev.id] || [] : [];
  const wideSet = new Set(wideIds);

  const featuredCfg = cfg.eventFeaturedSpeakerIds;
  if (featuredCfg && Object.prototype.hasOwnProperty.call(featuredCfg, ev.id)) {
    const featuredIds = featuredCfg[ev.id] || [];
    const featured = featuredIds.map((id) => speakersById[id]).filter(Boolean);
    const reserved = new Set([...featured.map((s) => s.id), ...wideIds]);
    const compact = ordered.filter((s) => !reserved.has(s.id));
    const wideSub = wideIds.map((id) => speakersById[id]).filter(Boolean);
    return { featured, compact, wideSub };
  }

  const fallbackMain = ordered.find((s) => String(s.kind).includes("外部")) || ordered[0];
  const featured = fallbackMain && !wideSet.has(fallbackMain.id) ? [fallbackMain] : [];
  const reserved = new Set([...featured.map((s) => s.id), ...wideIds]);
  const compact = ordered.filter((s) => !reserved.has(s.id));
  const wideSub = wideIds.map((id) => speakersById[id]).filter(Boolean);
  return { featured, compact, wideSub };
}

/** モーダルオーバーレイ用：登壇者を表示順で1行にまとめる */
export function eventSpeakersInlineText(ev, speakersById, cfg) {
  const { featured, compact, wideSub } = resolveEventSpeakers(ev, speakersById, cfg);
  const ordered = [...featured, ...compact, ...wideSub];
  const names = ordered.map((sp) => sp.displayName || sp.legalName || "").filter(Boolean);
  if (names.length) return names.join("、");
  return String(ev.speakers || "").trim();
}
