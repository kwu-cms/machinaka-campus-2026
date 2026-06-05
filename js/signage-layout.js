import { PROGRAM_TIMELINE } from "./config.js";
import { escapeHtml } from "./lib/html.js";

/** サイネージフッター用 QR（タッチ操作なしのためリンクではなく画像表示） */
const SIGNAGE_FOOTER_QR = Object.freeze([
  {
    src: "./images/qr_site.png",
    label: "特設ウェブサイト",
    alt: "特設ウェブサイトのQRコード",
  },
  {
    src: "./images/qr_cinema.png",
    label: "学科Instagram",
    alt: "学科InstagramのQRコード",
  },
]);

const SIGNAGE_EVENT_VENUE_LINE = "こうべまちづくり会館 3F多目的室";
const SIGNAGE_EVENT_HOURS = "10:00 – 18:00";
const SIGNAGE_EVENT_DATES = "7/18（土）・7/19（日）";

/** サイネージフッター左：上映・イベント共通の開催概要（簡潔） */
const SIGNAGE_FOOTER_OVERVIEW_TITLE = "まちなかキャンパス 2026";
const SIGNAGE_FOOTER_OVERVIEW_LINES = Object.freeze([
  SIGNAGE_EVENT_DATES,
  "こうべまちづくり会館・元町映画館",
]);

/** サイネージ下段「当日のご案内」（開催概要・フッターと重複しない実務向け） */
const SIGNAGE_EVENT_DAY_GUIDE = Object.freeze([
  "入場・見学は無料です（申込制のワークショップは各枠で要申込）。",
  "タイムテーブルは上の日程欄をご確認ください。",
  "変更・追加情報はフッターの Instagram でお知らせします。",
]);

/**
 * @param {{ mode: "screening" | "event", kicker: string, title: string, tagline: string, badge?: string }} opts
 */
export function signageHeaderHTML({ mode, kicker = "", title, tagline, badge = "" }) {
  const kickerHtml = kicker
    ? `<p class="signage-header__kicker">${escapeHtml(kicker)}</p>`
    : "";
  const badgeHtml = badge
    ? `<p class="signage-badge" aria-label="${escapeHtml(badge)}">${escapeHtml(badge)}</p>`
    : "";
  return `<header class="signage-header signage-header--${escapeHtml(mode)}" data-signage-zone="header">
  <div class="signage-header__main">
    ${kickerHtml}
    <h1 class="signage-header__title">${escapeHtml(title)}</h1>
    <p class="signage-header__tagline">${escapeHtml(tagline)}</p>
  </div>
  ${badgeHtml}
</header>`;
}

/**
 * @param {{ mode: "screening" | "event" }} opts
 */
function signageFooterQrHTML() {
  const items = SIGNAGE_FOOTER_QR.map(
    ({ src, label, alt }) =>
      `<figure class="signage-footer__qr-item">
        <img class="signage-footer__qr-img" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="96" height="96" decoding="async" />
        <figcaption class="signage-footer__qr-label">${escapeHtml(label)}</figcaption>
      </figure>`,
  ).join("");
  return `<div class="signage-footer__qr" aria-label="特設ウェブサイト・学科InstagramのQRコード">
    <div class="signage-footer__qr-list">${items}</div>
  </div>`;
}

function signageFooterLeadHTML() {
  const lines = SIGNAGE_FOOTER_OVERVIEW_LINES.map(
    (line) => `<p class="signage-footer__overview-line">${escapeHtml(line)}</p>`,
  ).join("");
  return `<div class="signage-footer__overview">
    <p class="signage-footer__overview-title">${escapeHtml(SIGNAGE_FOOTER_OVERVIEW_TITLE)}</p>
    ${lines}
  </div>`;
}

export function signageFooterHTML({ mode }) {
  return `<footer class="signage-footer signage-footer--${escapeHtml(mode)}" data-signage-zone="footer">
  <div class="signage-footer__lead">${signageFooterLeadHTML()}</div>
  ${signageFooterQrHTML()}
</footer>`;
}

export function signageScreeningTopHTML() {
  const { timeDisplay, venue } = PROGRAM_TIMELINE.screening;
  return signageHeaderHTML({
    mode: "screening",
    kicker: "上映プログラム",
    title: "卒業制作選抜展「南女シネマ」",
    tagline: `${SIGNAGE_EVENT_DATES}｜${timeDisplay}｜${venue}`,
  });
}

export function signageEventTopHTML() {
  return signageHeaderHTML({
    mode: "event",
    title: "レクチャー・ワークショップ",
    tagline: `${SIGNAGE_EVENT_DATES}｜${SIGNAGE_EVENT_VENUE_LINE}`,
  });
}

/** index.html の教員メッセージをソースにヒーローオーバーレイ HTML を生成 */
export function facultyHeroOverlayHTML() {
  const catchEl = document.getElementById("screening-faculty-catch");
  const bodyEl = document.querySelector("#screening .faculty-message__body p");
  const titleEl = document.querySelector("#screening .faculty-message__title");
  const nameEl = document.querySelector("#screening .faculty-message__name");

  const catchHtml = catchEl?.innerHTML.trim()
    ? catchEl.innerHTML.trim()
    : "カメラを持った<br />見えてきたのは自分だった";
  const bodyText = bodyEl?.textContent?.trim() || "";
  const attrTitle = titleEl?.textContent?.trim() || "";
  const attrName = nameEl?.textContent?.trim() || "";

  const bodyBlock = bodyText
    ? `<div class="signage-hero__body"><p>${escapeHtml(bodyText)}</p></div>`
    : "";
  const attrBlock =
    attrTitle || attrName
      ? `<div class="signage-hero__attribution">${attrTitle ? `<p class="signage-hero__attr-title">${escapeHtml(attrTitle)}</p>` : ""}${attrName ? `<p class="signage-hero__attr-name">${escapeHtml(attrName)}</p>` : ""}</div>`
      : "";

  return `<div class="signage-hero__overlay" aria-labelledby="signage-faculty-catch">
  <p class="signage-hero__catch" id="signage-faculty-catch">${catchHtml}</p>
  ${bodyBlock}
  ${attrBlock}
</div>`;
}

/**
 * @param {HTMLElement} programBody
 * @param {string} topHtml
 * @param {string} footerHtml
 */
export function mountSignageShellChrome(programBody, topHtml, footerHtml) {
  if (!programBody) return;
  programBody.classList.add("signage-shell");

  let topHost = programBody.querySelector(".signage-top");
  if (!topHost) {
    topHost = document.createElement("div");
    topHost.className = "signage-top";
    programBody.insertBefore(topHost, programBody.firstElementChild);
  }
  topHost.innerHTML = topHtml;

  let footerHost = programBody.querySelector(".signage-footer-host");
  if (!footerHost) {
    footerHost = document.createElement("div");
    footerHost.className = "signage-footer-host";
    programBody.appendChild(footerHost);
  }
  footerHost.innerHTML = footerHtml;
}

export function signageAsideHTML(permanentCardsHtml) {
  const permanentInner = permanentCardsHtml
    ? `<div class="signage-aside__permanent-list">${permanentCardsHtml}</div>`
    : `<p class="signage-aside__empty">常設プログラムはありません。</p>`;
  const guideItems = SIGNAGE_EVENT_DAY_GUIDE.map(
    (line) => `<li class="signage-aside__guide-item">${escapeHtml(line)}</li>`,
  ).join("");

  return `<div class="signage-aside" role="region" aria-label="常設企画と当日のご案内">
  <article class="signage-aside__panel signage-aside__panel--permanent">
    <p class="signage-aside__label">常設企画</p>
    ${permanentInner}
  </article>
  <article class="signage-aside__panel signage-aside__panel--guide">
    <p class="signage-aside__label">当日のご案内</p>
    <ul class="signage-aside__guide-list">${guideItems}</ul>
  </article>
</div>`;
}

export { SIGNAGE_EVENT_VENUE_LINE, SIGNAGE_EVENT_DATES, SIGNAGE_EVENT_DAY_GUIDE };
