import { SITE_CONFIG, PROGRAM_TIMELINE, SCREENING_SLIDESHOW_INTERVAL_MS } from "./config.js";
import { parseCSV, rowToObj } from "./lib/csv.js";
import { escapeHtml } from "./lib/html.js";
import { initScreeningHeroSlideshow } from "./screening-slideshow.js";

export function initScreeningMovies() {
    const listHost = document.getElementById("mv-list");
    const sectionRoot = document.querySelector("#screening .mv-section");
    const dialog = document.getElementById("movie-detail-dialog");
    if (!listHost || !dialog) return;
    if (document.body.dataset.signage === "event") {
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
      return;
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
    const MV_DIALOG_SLOT_RANGE = "17:10～19:00";
    const MV_DIALOG_VENUE = "元町映画館";
    const MV_DIALOG_PIN_SRC = "./images/fa-location-pin.svg";

    /**
     * @returns {string} HTML（escapeHtml 済みパーツのみ結合）
     */
    function movieDialogShowtimeHtml(m) {
      const pinImg = `<img class="movie-dialog-showtime-pin" src="${escapeHtml(MV_DIALOG_PIN_SRC)}" alt="" width="14" height="14" decoding="async" loading="lazy" />`;
      let dateLabel = "";
      if (m.day === "sat") dateLabel = "7/18（土）";
      else if (m.day === "sun") dateLabel = "7/19（日）";
      else {
        const d = String(m.dateLabel || "").trim();
        if (d) dateLabel = d;
        else {
          return `<p class="movie-dialog-showtime-unknown" role="status">上映日が設定されていません。<code class="inline-code">上映日</code>列または ID（scr-1…6）を確認してください。</p>`;
        }
      }
      return `<div class="movie-dialog-showtime-inner">
  <span class="movie-dialog-showtime-date">${escapeHtml(dateLabel)}</span>
  <span class="movie-dialog-showtime-slot">${escapeHtml(MV_DIALOG_SLOT_RANGE)}</span>
  <span class="movie-dialog-showtime-venue-row">
    <span class="movie-dialog-showtime-pin-wrap" aria-hidden="true">${pinImg}</span>
    <span class="movie-dialog-showtime-venue">${escapeHtml(MV_DIALOG_VENUE)}</span>
  </span>
</div>`;
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
     * 上映ヒーロー共通：日付・タイトル・メタ1行・あらすじ
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
      const inner = mvFloatPanelInnerHTML(m, synopsisFallback, uniqueKey);
      const tid =
        uniqueKey != null && String(uniqueKey).trim() !== ""
          ? `mv-float-title-${escapeHtml(m.id)}-${escapeHtml(uniqueKey)}`
          : `mv-float-title-${escapeHtml(m.id)}`;
      return `<aside class="${asideClass}" aria-labelledby="${tid}" aria-label="${escapeHtml(titleShown)}の詳細">${inner}</aside>`;
    }

    function screeningCarouselSlidesInnerHTML(orderedMovies) {
      return orderedMovies
        .map((m, j) => {
          const thumb = thumbSrc(m.thumbPath);
          const active = j === 0 ? " is-active" : "";
          const loading = j === 0 ? "eager" : "lazy";
          const fp = j === 0 ? ' fetchpriority="high"' : "";
          const media = thumb
            ? `<img src="${escapeHtml(thumb)}" alt="" width="960" height="540" decoding="async" loading="${loading}"${fp} />`
            : `<div class="screening-slide-fallback" aria-hidden="true"></div>`;
          const panel = mvFloatPanelAsideHTML(
            m,
            "mv-float-panel screening-carousel-float",
            undefined,
            `sc-${j}`,
          );
          return `<figure class="screening-slide${active}">${media}${panel}</figure>`;
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
        ? `<div class="mv-card-bg" style="background-image:url('${cssUrlForAttr(thumb)}')" aria-hidden="true"></div>`
        : "";
      return `<article class="${cardClass}" tabindex="0" role="button" data-movie-id="${escapeHtml(m.id)}" aria-label="${escapeHtml(aria)}の詳細を開く">
        ${bgDiv}${bodyInner}
      </article>`;
    }

    /** 縦型サイネージ（上映）：カードはテキストのみ（画像はページ上部スライド） */
    function movieCardSignageHeroHTML(m) {
      const titleShown = formatDisplayTitle(m.title);
      const meta = metaLine(m, true);
      const synopsis = String(m.synopsis || "").trim();
      const bodyText = synopsis || SYNOPSIS_PLACEHOLDER;
      const metaBlock = meta
        ? `<p class="mv-signage-hero-meta">${escapeHtml(meta)}</p>`
        : "";
      return `<article class="mv-card mv-card--signage-hero" data-movie-id="${escapeHtml(m.id)}">
        <div class="mv-signage-hero-body">
          <p class="mv-signage-hero-title">${escapeHtml(titleShown)}</p>
          ${metaBlock}
          <div class="mv-signage-hero-desc"><p>${escapeHtml(bodyText)}</p></div>
        </div>
      </article>`;
    }

    /** 上映サイネージ：ヒーロー直下に表示する見出し（index の program-head / プログラム名と同等） */
    function signageScreeningChromeHTML() {
      return `<div class="signage-screening-chrome">
        <header class="program-head signage-screening-chrome-head">
          <div class="program-head-main">
            <p class="program-kicker">- P03 - Screening</p>
            <h3 class="program-title">上映</h3>
          </div>
          <span class="program-venue">元町映画館</span>
        </header>
        <div class="screening-program-lede screening-program-lede--signage">
          <h4 class="screening-program-name signage-screening-chrome-program-name">特別上映プログラム「南女シネマ」</h4>
          <p class="screening-program-tagline">映画つくった　宝物みつけた</p>
        </div>
      </div>`;
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
            ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(titleShown)}のキービジュアル" width="1080" height="608" decoding="async" loading="${loading}"${fp} />`
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

      setActive(0);
      if (reduced) return;
      timer = window.setInterval(() => setActive(index + 1), SCREENING_SLIDESHOW_INTERVAL_MS);
    }

    const titleEl = dialog.querySelector("#movie-dialog-title");
    const showtimeEl = dialog.querySelector("#movie-dialog-showtime");
    const metaEl = dialog.querySelector(".movie-dialog-meta");
    const bodyEl = dialog.querySelector(".movie-dialog-body");
    const mediaWrap = dialog.querySelector(".movie-dialog-media");
    const thumbEl = dialog.querySelector(".movie-dialog-thumb");
    const closeBtn = dialog.querySelector(".movie-dialog-close");

    /** @type {Record<string, object>} */
    let byId = {};

    function fillDialog(m) {
      if (!titleEl || !metaEl || !bodyEl || !mediaWrap || !thumbEl) return;
      const titleShown = formatDisplayTitle(m.title);
      titleEl.textContent = titleShown;
      metaEl.textContent = metaLine(m, true) || "";
      if (showtimeEl) {
        showtimeEl.innerHTML = movieDialogShowtimeHtml(m);
      }
      const synopsis = String(m.synopsis || "").trim();
      bodyEl.innerHTML = `<p class="movie-dialog-desc">${escapeHtml(synopsis || SYNOPSIS_PLACEHOLDER)}</p>`;

      const src = thumbSrc(m.thumbPath);
      if (src) {
        thumbEl.src = src;
        thumbEl.alt = `${titleShown}のサムネイル`;
        mediaWrap.hidden = false;
      } else {
        thumbEl.removeAttribute("src");
        thumbEl.alt = "";
        mediaWrap.hidden = true;
      }
    }

    function openForId(id) {
      const m = byId[id];
      if (!m) return;
      fillDialog(m);
      if (typeof dialog.showModal === "function") dialog.showModal();
    }

    function bindCards() {
      listHost.querySelectorAll(".mv-card[data-movie-id]").forEach((el) => {
        el.addEventListener("click", () => openForId(el.getAttribute("data-movie-id")));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openForId(el.getAttribute("data-movie-id"));
          }
        });
      });
    }

    closeBtn?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });

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

        const cardRenderer = signageScreening ? movieCardSignageHeroHTML : movieCardHTML;

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
              const listInner = dayMovies.length
                ? dayMovies.map(cardRenderer).join("")
                : `<p class="mv-signage-col-empty" role="status">この日の上映に紐づく作品がありません。<code class="inline-code">上映日</code>列を確認してください。</p>`;
              return `<div class="mv-program-col">
          ${mvProgramColTitleHtml(label, headingId)}
          <div class="mv-program-col-list" aria-labelledby="${escapeHtml(headingId)}">${listInner}</div>
        </div>`;
            })
            .join("");
          html = `<div class="mv-program-cols" role="region" aria-label="南女シネマ 日別上映">${cols}</div>`;
        }

        const bodyHtml =
          html ||
          '<p class="mv-load-error" role="alert">上映作品データがありません。スプレッドシートの「上映」シート（列名・公開設定）を確認してください。</p>';
        const signageChrome = signageScreening ? signageScreeningChromeHTML() : "";
        listHost.innerHTML = (signagePageHero || "") + signageChrome + bodyHtml;
        if (signageScreening) wireSignagePageHeroSlideshow(listHost);
        if (!signageScreening) {
          const heroCarouselMovies = [...moviesForDay("sat"), ...moviesForDay("sun")];
          const slideshowRoot = document.getElementById("screeningSlideshow");
          const innerEl = slideshowRoot?.querySelector(".screening-slideshow-inner");
          if (slideshowRoot && innerEl && heroCarouselMovies.length) {
            innerEl.innerHTML = screeningCarouselSlidesInnerHTML(heroCarouselMovies);
            initScreeningHeroSlideshow(slideshowRoot);
          }
          bindCards();
        }
      } catch {
        const signageChrome =
          document.body.dataset.signage === "screening" ? signageScreeningChromeHTML() : "";
        listHost.innerHTML =
          signageChrome +
          '<p class="mv-load-error" role="alert">上映作品一覧を読み込めませんでした。スプレッドシートの共有（リンクを知っている全員が閲覧可）とネットワークを確認し、しばらくしてから再度お試しください。</p>';
      }
      if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
    }

    load();
}
