import { SITE_CONFIG } from "./config.js";
import { escapeHtml } from "./lib/html.js";

/** デスクトップ: #news 非表示・モーダル表示（overrides.css の 901px と一致） */
const NEWS_DESKTOP_MQ = window.matchMedia("(min-width: 901px)");

export function newsDateLabel(item) {
  if (item.dateDisplay) return item.dateDisplay;
  return (item.date || "").replace(/-/g, ".");
}

function createNewsArticle(item) {
  const article = document.createElement("article");
  article.className = "news-item reveal";
  const timeEl = document.createElement("time");
  timeEl.className = "news-date";
  if (item.date) timeEl.setAttribute("datetime", item.date);
  timeEl.textContent = newsDateLabel(item);
  const p = document.createElement("p");
  p.className = "news-text";
  p.innerHTML = newsTextWithLinks(item.text || "");
  article.appendChild(timeEl);
  article.appendChild(p);
  return article;
}

const NEWS_ANCHOR_RE = /<a\s+href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

/** @param {string} href */
function isSafeNewsHref(href) {
  const h = String(href || "").trim();
  if (!h) return false;
  if (/^(javascript|data|vbscript):/i.test(h)) return false;
  if (/^https?:\/\//i.test(h)) return true;
  if (h.startsWith("./") || h.startsWith("../") || h.startsWith("/")) return true;
  return false;
}

/**
 * プレーンテキスト部分の URL / @handle をリンク化（HTML はエスケープ）。
 * @param {string} text
 */
function linkifyPlainNewsText(text) {
  const src = String(text || "");
  if (!src) return "";
  const tokenRe = /https?:\/\/[^\s<>"']+|@[A-Za-z0-9._]{1,30}/g;
  let out = "";
  let last = 0;
  for (const m of src.matchAll(tokenRe)) {
    const i = m.index ?? 0;
    const token = m[0];
    out += escapeHtml(src.slice(last, i));

    if (token.startsWith("http://") || token.startsWith("https://")) {
      const href = escapeHtml(token);
      out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`;
    } else {
      const prev = i > 0 ? src[i - 1] : "";
      if (prev && /[A-Za-z0-9._-]/.test(prev)) {
        out += escapeHtml(token);
      } else {
        const handle = token.slice(1);
        const href = `https://www.instagram.com/${encodeURIComponent(handle)}`;
        out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(token)}</a>`;
      }
    }
    last = i + token.length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

/**
 * ニュース本文: 許可した &lt;a href&gt; を維持し、それ以外はエスケープ＋URL/@ をリンク化。
 * @param {string} text
 */
function newsTextWithLinks(text) {
  const src = String(text || "");
  if (!src) return "";
  if (!/<a\s/i.test(src)) return linkifyPlainNewsText(src);

  NEWS_ANCHOR_RE.lastIndex = 0;
  let out = "";
  let last = 0;
  let m;
  while ((m = NEWS_ANCHOR_RE.exec(src)) !== null) {
    const i = m.index ?? 0;
    out += linkifyPlainNewsText(src.slice(last, i));
    const href = m[2];
    const inner = m[3];
    if (isSafeNewsHref(href)) {
      const escHref = escapeHtml(href);
      const escInner = linkifyPlainNewsText(inner);
      out += `<a href="${escHref}" target="_blank" rel="noopener noreferrer">${escInner}</a>`;
    } else {
      out += escapeHtml(m[0]);
    }
    last = i + m[0].length;
  }
  out += linkifyPlainNewsText(src.slice(last));
  return out;
}

/** マーキー用: HTML タグを除いたプレーンテキスト */
function newsTextPlain(text) {
  return String(text || "")
    .replace(/<a\s+href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, "$3")
    .replace(/<[^>]+>/g, "");
}

function appendHeroMarqueeCycle(track, items) {
  for (const item of items) {
    const label = document.createElement("span");
    label.className = "hero-news-label";
    label.textContent = "NEWS";
    const row = document.createElement("span");
    row.className = "hero-news-item";
    const dateEl = document.createElement("span");
    dateEl.className = "hero-news-date";
    dateEl.textContent = newsDateLabel(item);
    row.appendChild(dateEl);
    row.appendChild(document.createTextNode(newsTextPlain(item.text || "")));
    track.appendChild(label);
    track.appendChild(row);
  }
}

function populateNewsList(container, items, observeReveal) {
  container.textContent = "";
  for (const item of items) {
    const article = createNewsArticle(item);
    container.appendChild(article);
    observeReveal?.(article);
  }
}

function openNewsDialog(dialog) {
  if (!dialog || typeof dialog.showModal !== "function") return;
  if (!dialog.querySelector(".news-item")) return;
  try {
    dialog.showModal();
  } catch (_) {}
}

function bindNewsNav(dialog) {
  const links = document.querySelectorAll('a[href="#news"]');
  for (const link of links) {
    link.addEventListener("click", (e) => {
      if (!NEWS_DESKTOP_MQ.matches) return;
      e.preventDefault();
      openNewsDialog(dialog);
    });
  }

  NEWS_DESKTOP_MQ.addEventListener("change", () => {
    if (!NEWS_DESKTOP_MQ.matches && dialog?.open) dialog.close();
  });
}

function wireNewsDialog(dialog) {
  if (!dialog) return;
  dialog.querySelector(".news-dialog-close")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function bindHeroMarquee(dialog) {
  const marquee = document.querySelector(".hero-news-marquee");
  if (!marquee) return;

  marquee.setAttribute("role", "button");
  marquee.setAttribute("tabindex", "0");
  marquee.setAttribute("aria-label", "お知らせ一覧を開く");

  marquee.addEventListener("click", () => openNewsDialog(dialog));
  marquee.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openNewsDialog(dialog);
  });
}

/**
 * お知らせ: ヒーローマーキー・#news 一覧・デスクトップ用モーダル
 * @param {{ observeReveal?: (el: Element) => void }} [opts]
 */
export async function initNews(opts = {}) {
  if (document.body.dataset.signage) return;

  const track = document.querySelector(".hero-news-track");
  const sectionList = document.querySelector("#news .news-list");
  const dialog = document.getElementById("news-dialog");
  const dialogList = dialog?.querySelector(".news-dialog-list");
  if (!track || !sectionList) return;

  wireNewsDialog(dialog);
  bindNewsNav(dialog);
  bindHeroMarquee(dialog);

  try {
    const res = await fetch(SITE_CONFIG.newsJsonUrl, { cache: "no-cache" });
    if (!res.ok) return;
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) return;

    track.textContent = "";
    appendHeroMarqueeCycle(track, items);
    appendHeroMarqueeCycle(track, items);

    populateNewsList(sectionList, items, opts.observeReveal);
    if (dialogList) populateNewsList(dialogList, items);
  } catch (err) {
    console.error("[news] failed to load news.json", err);
  }
}
