import {
  SITE_CONFIG,
  PROGRAM_TIMELINE,
  SCREENING_SLIDESHOW_INTERVAL_MS,
  dialogProgramLabelText,
} from "./config.js";
import { parseCSV, rowToObj } from "./lib/csv.js";
import { escapeHtml } from "./lib/html.js";
import { getQueryParam, removeQueryParam, setQueryParam } from "./lib/url-params.js";
import { initScreeningHeroSlideshow } from "./screening-slideshow.js";
import {
  pictureHTMLFromPath,
  cssBackgroundImageSet,
  resolveImageStem,
  applyResponsiveImageToImg,
} from "./lib/responsive-image.js";
import { withViewTransition, tagViewTransitionPair } from "./lib/view-transition.js";
import { resolveSignageHeroStartIndex } from "./signage-hero-state.js";

const MOVIE_QUERY_PARAM = "movie_id";

export function initScreeningMovies() {
    const listHost = document.getElementById("mv-list");
    const sectionRoot = document.querySelector("#screening .mv-section");
    const dialog = document.getElementById("movie-detail-dialog");
    if (!listHost || !dialog) return;
    if (document.body.dataset.signage === "event") {
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
      return;
    }

    const screeningSlideshowRoot = document.getElementById("screeningSlideshow");
    if (screeningSlideshowRoot && !document.body.dataset.signage) {
      screeningSlideshowRoot.classList.add("is-loading");
      screeningSlideshowRoot.setAttribute("aria-busy", "true");
    }

    const MOVIES_CSV_URL = SITE_CONFIG.moviesCsvUrl;
    const SYNOPSIS_PLACEHOLDER =
      "作品概要は準備中です。開催にあわせて更新します。最新情報は元町映画館のWebページやInstagram（@mediastudies_kwu）もご確認ください。";

    function movieDayKey(dateStr) {
      const s = String(dateStr).trim();
      if (!s) return null;
      if (/7\/19|19日（日）|7月19日/.test(s)) return "sun";
      if (/7\/18|18日（土）|7月18日/.test(s)) return "sat";
      return null;
    }

    /** 「上映」シートの「24分」形式と従来の数値のみの両方 */
    function parseMovieDurationInput(raw) {
      const s = String(raw || "").trim();
      const m = s.match(/(\d+)\s*分/);
      if (m) return m[1];
      if (/^\d+$/.test(s)) return s;
      const digits = s.replace(/[^\d]/g, "");
      return digits || "";
    }

    /** シートの「画像」列（例: screening_1.png）→ サイト内パス */
    function resolveMovieThumbPath(raw) {
      const p = String(raw || "").trim();
      if (!p) return "";
      if (/^https?:\/\//i.test(p)) return p;
      if (p.startsWith("./") || p.startsWith("../") || p.startsWith("images/")) return p;
      return `images/screening-slides/${p.replace(/^\.?\//, "")}`;
    }

    /** 「上映日」列が空のとき、ID（scr-1…3→土、scr-4…6→日、m01…と同様）で土日を推定 */
    function inferMovieDayFromId(id) {
      const s = String(id || "").trim();
      let m = /^scr-(\d+)$/i.exec(s);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 3) return "sat";
        if (n >= 4 && n <= 6) return "sun";
        return null;
      }
      m = /^m(\d+)$/i.exec(s);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= 3) return "sat";
        if (n >= 4 && n <= 6) return "sun";
        return null;
      }
      return null;
    }

    function inferSortFromMovieId(id) {
      const m = /^scr-(\d+)$/i.exec(String(id || "").trim());
      if (m) return parseInt(m[1], 10);
      const m2 = /^m(\d+)$/i.exec(String(id || "").trim());
      if (m2) return parseInt(m2[1], 10);
      return 999;
    }

    /**
     * 従来 movies.csv（上映日・尺・概要…）と「上映」シート（上映時間・制作年度・作品説明・画像…）の両方
     * @param {string[]} headers
     * @param {Record<string, string>} r
     */
    function movieRecordToUnified(headers, r) {
      const hdr = new Set(headers);
      const id = (r["ID"] || "").trim();
      if (hdr.has("作品説明")) {
        const dayFromDate = movieDayKey(r["上映日"] || "");
        const day = dayFromDate || inferMovieDayFromId(id);
        const sortNum = Number((r["表示順"] || "").trim());
        return {
          id,
          dateLabel: String(r["上映日"] || "").trim(),
          title: (r["タイトル"] || "").trim(),
          director: (r["監督"] || "").trim(),
          durationMin: parseMovieDurationInput(r["上映時間"] || r["尺（分）"] || ""),
          metaExtra: normalizeMovieMetaExtra((r["制作年度"] || r["メタ（卒制等）"] || "").trim()),
          synopsis: (r["作品説明"] || r["概要"] || "").trim(),
          thumbPath: resolveMovieThumbPath(r["画像"] || r["サムネイルパス"] || ""),
          sort: Number.isFinite(sortNum) && sortNum > 0 ? sortNum : inferSortFromMovieId(id),
          day,
        };
      }
      return {
        id,
        dateLabel: r["上映日"] || "",
        title: (r["タイトル"] || "").trim(),
        director: (r["監督"] || "").trim(),
        durationMin: (r["尺（分）"] || "").trim(),
        metaExtra: normalizeMovieMetaExtra(r["メタ（卒制等）"] || ""),
        synopsis: (r["概要"] || "").trim(),
        thumbPath: (r["サムネイルパス"] || "").trim(),
        sort: Number((r["表示順"] || "999").trim()) || 999,
        day: movieDayKey(r["上映日"] || "") || inferMovieDayFromId(id),
      };
    }

    function thumbSrc(raw) {
      const p = String(raw || "").trim();
      if (!p) return "";
      if (/^https?:\/\//i.test(p)) return p;
      if (p.startsWith("./") || p.startsWith("../") || p.startsWith("/")) return p;
      return `./${p.replace(/^\.\//, "")}`;
    }

    function thumbBackgroundStyle(thumb) {
      if (!thumb) return "";
      if (/^https?:\/\//i.test(thumb)) {
        return `background-image:url('${cssUrlForAttr(thumb)}')`;
      }
      const stem = resolveImageStem(thumb);
      if (!stem) return "";
      return `background-image:${cssBackgroundImageSet(stem, "screening")}`;
    }

    function thumbPictureHTML(thumb, opts = {}) {
      if (!thumb) return "";
      if (/^https?:\/\//i.test(thumb)) {
        const alt = escapeHtml(opts.alt ?? "");
        const loading = opts.loading ? ` loading="${opts.loading}"` : "";
        const fp = opts.fetchpriority ? ` fetchpriority="${opts.fetchpriority}"` : "";
        return `<img src="${escapeHtml(thumb)}" alt="${alt}" width="960" height="540" decoding="async"${loading}${fp} />`;
      }
      return pictureHTMLFromPath(thumb, { profile: "screening", ...opts });
    }

    function formatDisplayTitle(title) {
      const t = String(title || "").trim();
      if (!t) return "";
      if (t.startsWith("「") && t.endsWith("」")) return t;
      return `「${t}」`;
    }

    /** CSV の「25年度卒制」などを内部表現「2025年度卒業制作」へ変換（詳細モーダル用） */
    function normalizeMovieMetaExtra(raw) {
      const s = String(raw || "").trim();
      return s.replace(/(\d{2})年度卒制/g, (_, yy) => `20${yy}年度卒業制作`);
    }

    /** カードでは「2025年度」、詳細では metaExtra 全文（…年度卒業制作） */
    function metaExtraForDisplay(metaExtra, forDetail) {
      const full = String(metaExtra || "").trim();
      if (!full) return "";
      if (forDetail) return full;
      return full.replace(/(\d{4})年度卒業制作/g, "$1年度");
    }

    /** @param {boolean} [forDetail] 詳細モーダルなら true（卒業制作まで表記） */
    function metaLine(m, forDetail) {
      const parts = [];
      if (m.director) parts.push(`${m.director} 監督`);
      const mins =
        m.durationMin != null && m.durationMin !== "" ? `上映時間${m.durationMin}分` : "";
      if (mins) parts.push(mins);
      const meta = metaExtraForDisplay(m.metaExtra, !!forDetail);
      if (meta) parts.push(meta);
      return parts.join("・");
    }

    function movieHeroDateLine(m) {
      const d = String(m.dateLabel || "").trim();
      if (d) return d;
      if (m.day === "sat") return "7/18（土）";
      if (m.day === "sun") return "7/19（日）";
      return "";
    }

    /** 詳細モーダル: 一覧の各日列と同じプログラム枠・会場 */
    const MV_DIALOG_SLOT_RANGE = "17:00～19:10";
    const MV_DIALOG_VENUE = "元町映画館";
    const MV_DIALOG_PIN_SRC = "./images/fa-location-pin.svg";

    const MOVIE_DIALOG_FLOAT_ICONS = {
      schedule: "./images/icon-calendar-days.svg",
      venue: MV_DIALOG_PIN_SRC,
    };

    function movieDialogDateLabel(m) {
      if (m.day === "sat") return "7/18（土）";
      if (m.day === "sun") return "7/19（日）";
      return String(m.dateLabel || "").trim();
    }

    function movieDialogFloatLine(kind, bodyHtml) {
      if (!bodyHtml) return "";
      const iconSrc = MOVIE_DIALOG_FLOAT_ICONS[kind];
      return `<p class="movie-dialog-float-line movie-dialog-float-line--${kind}">
  <img class="movie-dialog-float-icon" src="${iconSrc}" alt="" width="14" height="14" decoding="async" aria-hidden="true" />
  <span class="movie-dialog-float-line-body">${bodyHtml}</span>
</p>`;
    }

    function movieDialogScheduleBodyHtml(m) {
      const dateLabel = movieDialogDateLabel(m);
      if (!dateLabel) return "";
      return [
        `<span class="movie-dialog-float-date">${escapeHtml(dateLabel)}</span>`,
        `<span class="movie-dialog-float-time">${escapeHtml(MV_DIALOG_SLOT_RANGE)}</span>`,
      ].join("");
    }

    /** @returns {string} */
    function movieDialogFloatSummaryHtml(m) {
      const scheduleBody = movieDialogScheduleBodyHtml(m);
      if (!scheduleBody) {
        return `<p class="movie-dialog-float-unknown" role="status">上映日が設定されていません。<code class="inline-code">上映日</code>列または ID（scr-1…6）を確認してください。</p>`;
      }
      const lines = [
        movieDialogFloatLine("schedule", scheduleBody),
        movieDialogFloatLine("venue", escapeHtml(MV_DIALOG_VENUE)),
      ].filter(Boolean);
      return `<div class="movie-dialog-float-summary">${lines.join("")}</div>`;
    }

    /** 監督・上映時間・卒制メタを「／」区切りの1行にまとめる */
    function mvFloatPanelMetaLineJoined(m) {
      const parts = [];
      if (m.director) parts.push(`監督：${m.director}`);
      if (m.durationMin != null && String(m.durationMin).trim() !== "") {
        parts.push(`上映時間：${String(m.durationMin).trim()}分`);
      }
      const metaFull = metaExtraForDisplay(m.metaExtra, true);
      if (metaFull) parts.push(metaFull);
      return parts.join("／");
    }

    /**
     * 上映ヒーロー（index カルーセル）：モーダル同型のガラスパネル
     * @param {object} m movies.csv 行オブジェクト
     * @param {string} [synopsisFallback]
     */
    function mvFloatPanelCarouselInnerHTML(m, _synopsisFallback, uniqueKey) {
      const titleShown = formatDisplayTitle(m.title);
      const titleId =
        uniqueKey != null && String(uniqueKey).trim() !== ""
          ? `mv-float-title-${escapeHtml(m.id)}-${escapeHtml(uniqueKey)}`
          : `mv-float-title-${escapeHtml(m.id)}`;
      const credits = metaLine(m, true);
      const creditsHtml = credits
        ? `<p class="mv-float-panel-credits">${escapeHtml(credits)}</p>`
        : "";

      return `<h3 class="mv-float-panel-title" id="${titleId}">${escapeHtml(titleShown)}</h3>
${movieDialogFloatSummaryHtml(m)}
${creditsHtml}`;
    }

    /**
     * 上映ヒーロー共通：日付・タイトル・メタ1行・あらすじ（サイネージ用）
     * @param {object} m movies.csv 行オブジェクト
     * @param {string} [synopsisFallback]
     */
    function mvFloatPanelInnerHTML(m, synopsisFallback, uniqueKey) {
      const fb = synopsisFallback ?? SYNOPSIS_PLACEHOLDER;
      const dateLine = movieHeroDateLine(m);
      const titleShown = formatDisplayTitle(m.title);
      const synopsis = String(m.synopsis || "").trim() || fb;
      const titleId =
        uniqueKey != null && String(uniqueKey).trim() !== ""
          ? `mv-float-title-${escapeHtml(m.id)}-${escapeHtml(uniqueKey)}`
          : `mv-float-title-${escapeHtml(m.id)}`;

      const metaJoined = mvFloatPanelMetaLineJoined(m);
      const metaHtml = metaJoined
        ? `<p class="mv-float-panel-meta-line">${escapeHtml(metaJoined)}</p>`
        : "";

      return `<div class="mv-float-panel-head">
  ${dateLine ? `<p class="mv-float-panel-date"><span class="mv-float-panel-date-badge">${escapeHtml(dateLine)}</span></p>` : ""}
  <h3 class="mv-float-panel-title" id="${titleId}">${escapeHtml(titleShown)}</h3>
  ${metaHtml}
</div>
<div class="mv-float-panel-body">
  <p class="mv-float-panel-lead">あらすじ</p>
  <p class="mv-float-panel-synopsis">${escapeHtml(synopsis)}</p>
</div>`;
    }

    function mvFloatPanelAsideHTML(m, asideClass, synopsisFallback, uniqueKey) {
      const titleShown = formatDisplayTitle(m.title);
      const isCarousel = String(asideClass).includes("screening-carousel-float");
      const inner = isCarousel
        ? mvFloatPanelCarouselInnerHTML(m, synopsisFallback, uniqueKey)
        : mvFloatPanelInnerHTML(m, synopsisFallback, uniqueKey);
      const tid =
        uniqueKey != null && String(uniqueKey).trim() !== ""
          ? `mv-float-title-${escapeHtml(m.id)}-${escapeHtml(uniqueKey)}`
          : `mv-float-title-${escapeHtml(m.id)}`;
      if (isCarousel) {
        return `<aside class="${asideClass}" aria-hidden="true">${inner}</aside>`;
      }
      return `<aside class="${asideClass}" aria-labelledby="${tid}" aria-label="${escapeHtml(titleShown)}の詳細">${inner}</aside>`;
    }

    function movieDetailHref(id) {
      try {
        const u = new URL(window.location.href);
        u.searchParams.set(MOVIE_QUERY_PARAM, String(id));
        const qs = u.searchParams.toString();
        return `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`;
      } catch {
        return `?${MOVIE_QUERY_PARAM}=${encodeURIComponent(id)}`;
      }
    }

    function screeningCarouselSlidesInnerHTML(orderedMovies) {
      return orderedMovies
        .map((m, j) => {
          const thumb = thumbSrc(m.thumbPath);
          const titleShown = formatDisplayTitle(m.title);
          const active = j === 0 ? " is-active" : "";
          const loading = j === 0 ? "eager" : "lazy";
          const fp = j === 0 ? ' fetchpriority="high"' : "";
          const media = thumb
            ? thumbPictureHTML(thumb, {
                alt: "",
                loading,
                fetchpriority: j === 0 ? "high" : undefined,
                width: 960,
                height: 540,
              })
            : `<div class="screening-slide-fallback" aria-hidden="true"></div>`;
          const panel = mvFloatPanelAsideHTML(
            m,
            "mv-float-panel screening-carousel-float",
            undefined,
            `sc-${j}`,
          );
          const href = movieDetailHref(m.id);
          const ariaOpen = escapeHtml(`${titleShown}の詳細を見る`);
          return `<figure class="screening-slide${active}"><a class="screening-slide-link" href="${escapeHtml(href)}" data-movie-id="${escapeHtml(m.id)}" aria-label="${ariaOpen}">${media}${panel}</a></figure>`;
        })
        .join("");
    }

    /** style 用に URL をエスケープ（div の background-image に直書きし、::before + var() より確実に描画） */
    function cssUrlForAttr(u) {
      return String(u || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/'/g, "%27")
        .replace(/</g, "%3C");
    }

    function movieCardHTML(m) {
      const titleShown = formatDisplayTitle(m.title);
      const meta = metaLine(m);
      const aria = meta ? `${titleShown}、${meta}` : titleShown;
      const thumb = thumbSrc(m.thumbPath);
      const cardClass = thumb ? "mv-card mv-card--thumb" : "mv-card";
      const titleEl = `<div class="mv-item-title">${escapeHtml(titleShown)}</div>`;
      const metaEl = meta ? `<p class="mv-item-meta">${escapeHtml(meta)}</p>` : "";
      const bodyInner = thumb
        ? `<div class="mv-item-overlay">${titleEl}${metaEl}</div>`
        : `${titleEl}${metaEl}`;
      const bgDiv = thumb
        ? `<div class="mv-card-bg" style="${thumbBackgroundStyle(thumb)}" aria-hidden="true"></div>`
        : "";
      return `<article class="${cardClass}" tabindex="0" role="button" data-movie-id="${escapeHtml(m.id)}" aria-label="${escapeHtml(aria)}の詳細を開く">
        ${bgDiv}${bodyInner}
      </article>`;
    }

    /** 縦型サイネージ（上映）：左サムネ＋右テキスト（あらすじは上部スライド） */
    function movieCardSignageListHTML(m) {
      const titleShown = formatDisplayTitle(m.title);
      const meta = metaLine(m, true);
      const metaBlock = meta
        ? `<p class="mv-signage-list-meta">${escapeHtml(meta)}</p>`
        : "";
      const thumb = thumbSrc(m.thumbPath);
      const mediaHtml = thumb
        ? thumbPictureHTML(thumb, {
            alt: "",
            loading: "lazy",
            sizes: "120px",
            width: 240,
            height: 136,
          })
        : `<div class="mv-signage-list-media-placeholder" aria-hidden="true"></div>`;
      return `<article class="mv-card mv-card--signage-list mv-card--signage-media" data-movie-id="${escapeHtml(m.id)}">
        <div class="mv-signage-list-media">${mediaHtml}</div>
        <div class="mv-signage-list-body">
          <p class="mv-signage-list-title">${escapeHtml(titleShown)}</p>
          ${metaBlock}
        </div>
      </article>`;
    }

    /** 上映サイネージ：chrome・ヒーロー・日別リストをイベントサイネージと同型の DOM に配置 */
    function ensureSignageScreeningShell() {
      const programBody = document.querySelector("#screening .program-body");
      const screeningBody = programBody?.querySelector(".screening-body");
      if (!programBody || !screeningBody) {
        return { heroHost: null, programBody: null };
      }
      let heroHost = document.getElementById("mv-signage-hero");
      if (!heroHost) {
        heroHost = document.createElement("div");
        heroHost.id = "mv-signage-hero";
        heroHost.className = "signage-mv-hero-host";
        const mvSection = screeningBody.querySelector(".mv-section");
        if (mvSection) screeningBody.insertBefore(heroHost, mvSection);
        else screeningBody.appendChild(heroHost);
      }
      return { heroHost, programBody };
    }

    function applySignageScreeningLayout({ chromeHtml, heroHtml, scheduleHtml }) {
      const { heroHost, programBody } = ensureSignageScreeningShell();
      if (programBody && chromeHtml) {
        const existing = programBody.querySelector(".signage-screening-chrome");
        if (existing) existing.outerHTML = chromeHtml;
        else programBody.insertAdjacentHTML("afterbegin", chromeHtml);
      }
      listHost.innerHTML = scheduleHtml;
      if (!heroHost) return;
      if (heroHtml) {
        heroHost.hidden = false;
        heroHost.innerHTML = heroHtml;
        wireSignagePageHeroSlideshow(heroHost);
      } else {
        heroHost.hidden = true;
        heroHost.innerHTML = "";
      }
    }

    /** 上映サイネージ：プログラム名・会場・時間（列見出しと重複しない共通情報） */
    function signageScreeningChromeHTML(timeDisplay, venue) {
      return `<div class="signage-screening-chrome">
        <header class="signage-screening-chrome__head">
          <p class="signage-screening-chrome__kicker">上映プログラム</p>
          <h1 class="signage-screening-chrome__title">卒業制作選抜展「南女シネマ」</h1>
          <p class="signage-screening-chrome__tagline">映画つくった　宝物みつけた</p>
        </header>
        <p class="signage-screening-chrome__meta">
          <span class="signage-screening-chrome__venue">${escapeHtml(venue)}</span>
          <span class="signage-screening-chrome__time">${escapeHtml(timeDisplay)}</span>
          <span class="signage-screening-chrome__note">入場無料</span>
        </p>
      </div>`;
    }

    function mvProgramColTitleSignageHtml(label, headingId) {
      return `<h5 class="mv-program-col-title mv-program-col-title--signage" id="${escapeHtml(headingId)}"><span class="mv-program-col-date">${escapeHtml(label)}</span></h5>`;
    }

    /** ページ先頭ヒーロー：7/18列→7/19列の順で全作品ビジュアルをスライド表示 */
    function signagePageHeroHTML(orderedMovies) {
      if (!orderedMovies.length) return "";
      const slidesHtml = orderedMovies
        .map((m, j) => {
          const titleShown = formatDisplayTitle(m.title);
          const thumb = thumbSrc(m.thumbPath);
          const active = j === 0 ? " is-active" : "";
          const loading = j === 0 ? "eager" : "lazy";
          const fp = j === 0 ? ' fetchpriority="high"' : "";
          const media = thumb
            ? thumbPictureHTML(thumb, {
                alt: `${titleShown}のキービジュアル`,
                loading,
                fetchpriority: j === 0 ? "high" : undefined,
                width: 1080,
                height: 608,
              })
            : `<div class="signage-mv-page-slide-placeholder" aria-hidden="true"></div>`;
          const infoFloat = mvFloatPanelAsideHTML(
            m,
            "signage-mv-page-synopsis-float mv-float-panel",
            undefined,
            `sg-${j}`,
          );
          return `<figure class="signage-mv-page-slide${active}">${media}${infoFloat}</figure>`;
        })
        .join("");
      return `<div class="signage-mv-page-hero">
        <div class="signage-mv-page-slideshow" role="region" aria-roledescription="カルーセル" aria-label="上映作品ビジュアル">
          <div class="signage-mv-page-slides-inner">${slidesHtml}</div>
          <div class="signage-mv-page-dots" aria-hidden="false"></div>
        </div>
      </div>`;
    }

    function wireSignagePageHeroSlideshow(host) {
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

      slides.forEach((slideEl, j) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "signage-mv-page-dot";
        const panel = slideEl.querySelector(".mv-float-panel");
        b.setAttribute(
          "aria-label",
          panel && panel.textContent.trim() ? panel.textContent.trim() : `スライド ${j + 1}`,
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

      setActive(resolveSignageHeroStartIndex(slides.length, "screening"));
      if (reduced) return;
      timer = window.setInterval(() => setActive(index + 1), SCREENING_SLIDESHOW_INTERVAL_MS);
    }

    const titleEl = dialog.querySelector("#movie-dialog-title");
    const creditsEl = dialog.querySelector(".movie-dialog-credits");
    const floatMetaEl = dialog.querySelector(".movie-dialog-meta.movie-dialog-float");
    const bodyEl = dialog.querySelector(".movie-dialog-body");
    const mediaWrap = dialog.querySelector(".movie-dialog-media");
    const thumbEl = dialog.querySelector(".movie-dialog-thumb");
    const closeBtn = dialog.querySelector(".movie-dialog-close");
    const navPrev = dialog.querySelector("[data-movie-dialog-prev]");
    const navNext = dialog.querySelector("[data-movie-dialog-next]");
    const movieDlgProgramLabel = dialog.querySelector("#movie-dialog-program-label");
    if (movieDlgProgramLabel) {
      movieDlgProgramLabel.textContent = dialogProgramLabelText("screening");
    }

    /** @type {Record<string, object>} */
    let byId = {};
    /** 詳細モーダル Chevron 用：全作品 ID（表示順・カルーセルと同じ） */
    let movieDialogNavIds = [];
    /** @type {string | null} */
    let movieDialogCurrentId = null;

    function getMovieDialogNavState(id) {
      const ids = movieDialogNavIds.length ? movieDialogNavIds : [id];
      if (ids.length <= 1) return { ids, index: 0 };
      const index = ids.indexOf(id);
      if (index < 0) return { ids: [id], index: 0 };
      return { ids, index };
    }

    function updateMovieDialogNav(id) {
      if (!navPrev || !navNext) return;
      const m = byId[id];
      const { ids, index } = getMovieDialogNavState(id);
      const multi = ids.length > 1 && m && ids.includes(id);
      if (!multi) {
        navPrev.hidden = true;
        navNext.hidden = true;
        return;
      }
      navPrev.hidden = false;
      navNext.hidden = false;
      const pos = `${index + 1} / ${ids.length}`;
      navPrev.setAttribute("aria-label", `前の作品へ（${pos}）`);
      navNext.setAttribute("aria-label", `次の作品へ（${pos}）`);
    }

    function placeMovieDialogFloat(hasImage) {
      if (!floatMetaEl || !titleEl) return;
      if (hasImage && mediaWrap) {
        floatMetaEl.classList.remove("movie-dialog-meta--below");
        if (!mediaWrap.contains(floatMetaEl)) {
          mediaWrap.appendChild(floatMetaEl);
        }
      } else {
        floatMetaEl.classList.add("movie-dialog-meta--below");
        const anchor = creditsEl && !creditsEl.hidden ? creditsEl : titleEl;
        if (anchor.nextElementSibling !== floatMetaEl) {
          anchor.insertAdjacentElement("afterend", floatMetaEl);
        }
      }
    }

    function fillDialog(m) {
      if (!titleEl || !bodyEl || !mediaWrap || !thumbEl || !floatMetaEl) return;
      const titleShown = formatDisplayTitle(m.title);
      titleEl.textContent = titleShown;
      if (creditsEl) {
        const credits = metaLine(m, true);
        creditsEl.textContent = credits || "";
        creditsEl.hidden = !credits;
      }
      floatMetaEl.innerHTML = movieDialogFloatSummaryHtml(m);
      const synopsis = String(m.synopsis || "").trim();
      bodyEl.innerHTML = `<p class="movie-dialog-desc">${escapeHtml(synopsis || SYNOPSIS_PLACEHOLDER)}</p>`;

      const src = thumbSrc(m.thumbPath);
      const stem = resolveImageStem(src);
      let hasImage = false;
      if (stem) {
        hasImage = true;
        applyResponsiveImageToImg(thumbEl, stem, "screening");
        thumbEl.alt = `${titleShown}のサムネイル`;
        mediaWrap.hidden = false;
      } else if (src && /^https?:\/\//i.test(src)) {
        hasImage = true;
        thumbEl.src = src;
        thumbEl.removeAttribute("srcset");
        thumbEl.alt = `${titleShown}のサムネイル`;
        mediaWrap.hidden = false;
      } else {
        thumbEl.removeAttribute("src");
        thumbEl.removeAttribute("srcset");
        thumbEl.alt = "";
        mediaWrap.hidden = true;
      }
      placeMovieDialogFloat(hasImage);
    }

    function openForId(id, opts = {}) {
      const fromUrl = Boolean(opts.fromUrl);
      const sourceEl = opts.sourceEl || null;
      const m = byId[id];
      if (!m) return;

      const show = () => {
        movieDialogCurrentId = id;
        fillDialog(m);
        updateMovieDialogNav(id);
        if (typeof dialog.showModal === "function") dialog.showModal();
        if (!fromUrl) setQueryParam(MOVIE_QUERY_PARAM, id);
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

    function stepMovieDialog(delta) {
      const id = movieDialogCurrentId;
      if (!id) return;
      const { ids, index } = getMovieDialogNavState(id);
      if (ids.length <= 1) return;
      const nextIndex = (index + delta + ids.length) % ids.length;
      openForId(ids[nextIndex]);
    }

    function bindCards() {
      listHost.querySelectorAll(".mv-card[data-movie-id]").forEach((el) => {
        const openFromCard = () =>
          openForId(el.getAttribute("data-movie-id"), {
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

    function bindScreeningCarouselSlides() {
      const root = document.getElementById("screeningSlideshow");
      if (!root) return;
      root.querySelectorAll(".screening-slide-link[data-movie-id]").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          openForId(el.getAttribute("data-movie-id"));
        });
      });
    }

    if (dialog.dataset.mxmMvDlgBound !== "1") {
      dialog.dataset.mxmMvDlgBound = "1";
      dialog.querySelector(".movie-dialog-close")?.addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => {
        removeQueryParam(MOVIE_QUERY_PARAM);
        movieDialogCurrentId = null;
      });
      navPrev?.addEventListener("click", () => stepMovieDialog(-1));
      navNext?.addEventListener("click", () => stepMovieDialog(1));
      dialog.addEventListener("keydown", (e) => {
        if (!dialog.open) return;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const id = movieDialogCurrentId;
        if (!id) return;
        const { ids } = getMovieDialogNavState(id);
        if (ids.length <= 1) return;
        e.preventDefault();
        stepMovieDialog(e.key === "ArrowLeft" ? -1 : 1);
      });
    }

    async function load() {
      const signageScreening = document.body.dataset.signage === "screening";
      try {
        const res = await fetch(MOVIES_CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const text = (await res.text()).replace(/^\uFEFF/, "");
        const matrix = parseCSV(text);
        if (!matrix.length) throw new Error("empty");
        const headers = matrix[0].map((h) => h.trim());
        const records = matrix.slice(1).map((cells) => rowToObj(headers, cells));

        const movies = records.map((r) => movieRecordToUnified(headers, r)).filter((m) => m.id && m.title);

        byId = {};
        for (const m of movies) byId[m.id] = m;

        const dayDefs = [
          { key: "sat", label: "7/18（土）", headingId: "mv-program-sat" },
          { key: "sun", label: "7/19（日）", headingId: "mv-program-sun" },
        ];

        const MV_PROGRAM_SLOT_TIME = PROGRAM_TIMELINE.screening.timeDisplay;
        const MV_PROGRAM_SLOT_VENUE = PROGRAM_TIMELINE.screening.venue;

        function mvProgramColTitleHtml(label, headingId) {
          const pin =
            '<img class="mv-program-col-pin" src="./images/fa-location-pin.svg" alt="" width="14" height="14" decoding="async" />';
          return `<h5 class="mv-program-col-title" id="${escapeHtml(headingId)}"><span class="mv-program-col-date">${escapeHtml(label)}</span><span class="mv-program-col-meta"><span class="mv-program-col-time">${escapeHtml(MV_PROGRAM_SLOT_TIME)}</span>${pin}<span class="mv-program-col-venue">${escapeHtml(MV_PROGRAM_SLOT_VENUE)}</span></span></h5>`;
        }

        function moviesForDay(key) {
          return movies
            .filter((m) => m.day === key)
            .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "ja"));
        }

        /** ヒーロー・モーダル Chevron 共通：7/18（土）→ 7/19（日）の列順（各日3本） */
        function moviesInDisplayOrder() {
          return [...moviesForDay("sat"), ...moviesForDay("sun")];
        }

        movieDialogNavIds = moviesInDisplayOrder().map((m) => m.id);

        const cardRenderer = signageScreening ? movieCardSignageListHTML : movieCardHTML;

        const signageHeroMovies =
          signageScreening && movies.length
            ? [...moviesForDay("sat"), ...moviesForDay("sun")]
            : [];
        const signagePageHero =
          signageScreening && signageHeroMovies.length
            ? signagePageHeroHTML(signageHeroMovies)
            : "";

        let html = "";
        if (movies.length) {
          const cols = dayDefs
            .map(({ key, label, headingId }) => {
              const dayMovies = moviesForDay(key);
              const colTitle = signageScreening
                ? mvProgramColTitleSignageHtml(label, headingId)
                : mvProgramColTitleHtml(label, headingId);
              const listInner = dayMovies.length
                ? dayMovies.map(cardRenderer).join("")
                : `<p class="mv-signage-col-empty" role="status">この日の上映に紐づく作品がありません。<code class="inline-code">上映日</code>列を確認してください。</p>`;
              return `<div class="mv-program-col">
          ${colTitle}
          <div class="mv-program-col-list" aria-labelledby="${escapeHtml(headingId)}">${listInner}</div>
        </div>`;
            })
            .join("");
          html = `<div class="mv-program-cols" role="region" aria-label="南女シネマ 日別上映">${cols}</div>`;
        }

        const bodyHtml =
          html ||
          '<p class="mv-load-error" role="alert">上映作品データがありません。スプレッドシートの「上映」シート（列名・公開設定）を確認してください。</p>';
        const signageChrome = signageScreening
          ? signageScreeningChromeHTML(MV_PROGRAM_SLOT_TIME, MV_PROGRAM_SLOT_VENUE)
          : "";
        if (signageScreening) {
          applySignageScreeningLayout({
            chromeHtml: signageChrome,
            heroHtml: signagePageHero || "",
            scheduleHtml: bodyHtml,
          });
        } else {
          listHost.innerHTML = bodyHtml;
        }
        if (!signageScreening) {
          const heroCarouselMovies = moviesInDisplayOrder();
          const slideshowRoot = document.getElementById("screeningSlideshow");
          const innerEl = slideshowRoot?.querySelector(".screening-slideshow-inner");
          if (slideshowRoot && innerEl && heroCarouselMovies.length) {
            innerEl.removeAttribute("aria-hidden");
            innerEl.innerHTML = screeningCarouselSlidesInnerHTML(heroCarouselMovies);
            slideshowRoot.querySelector(".screening-slideshow-dots")?.setAttribute("aria-hidden", "false");
            initScreeningHeroSlideshow(slideshowRoot);
            bindScreeningCarouselSlides();
          }
          if (slideshowRoot) {
            slideshowRoot.classList.remove("is-loading");
            slideshowRoot.setAttribute("aria-busy", "false");
          }
          bindCards();
        }

        const deepMovieId = getQueryParam(MOVIE_QUERY_PARAM);
        if (deepMovieId && byId[deepMovieId]) openForId(deepMovieId, { fromUrl: true });
      } catch {
        movieDialogNavIds = [];
        const signageChrome =
          document.body.dataset.signage === "screening"
            ? signageScreeningChromeHTML(
                PROGRAM_TIMELINE.screening.timeDisplay,
                PROGRAM_TIMELINE.screening.venue,
              )
            : "";
        const errHtml =
          '<p class="mv-load-error" role="alert">上映作品一覧を読み込めませんでした。スプレッドシートの共有（リンクを知っている全員が閲覧可）とネットワークを確認し、しばらくしてから再度お試しください。</p>';
        if (document.body.dataset.signage === "screening") {
          applySignageScreeningLayout({
            chromeHtml: signageChrome,
            heroHtml: "",
            scheduleHtml: errHtml,
          });
        } else {
          listHost.innerHTML = errHtml;
        }
        if (screeningSlideshowRoot && document.body.dataset.signage !== "screening") {
          screeningSlideshowRoot.classList.remove("is-loading");
          screeningSlideshowRoot.setAttribute("aria-busy", "false");
        }
      }
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
    }

    load();
}
