import { SITE_CONFIG } from "./config.js";

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
  p.textContent = item.text || "";
  article.appendChild(timeEl);
  article.appendChild(p);
  return article;
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
    row.appendChild(document.createTextNode(item.text || ""));
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
  } catch {
    /* news.json が無い・fetch不可のときは空のまま */
  }
}
