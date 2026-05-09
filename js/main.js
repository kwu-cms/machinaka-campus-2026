import { SITE_CONFIG, TEST_PAGE_NOTICE, HERO_SPOTLIGHT_SLIDE_INTERVAL_MS } from "./config.js";
import { initScreeningHeroSlideshow } from "./screening-slideshow.js";
import { initScreeningMovies } from "./screening-movies.js";
import { initEventsSection } from "./events.js";


/** 縦型サイネージ（1080×1920 想定）。`?signage=screening|event` または `#signage-screening` / `#signage-event` */
(function initSignageMode() {
  function getSignageMode() {
    let q = "";
    try {
      q = new URLSearchParams(window.location.search).get("signage") || "";
    } catch {
      q = "";
    }
    q = String(q).toLowerCase();
    if (q === "event" || q === "screening") return q;
    const h = String(window.location.hash || "")
      .replace(/^#/, "")
      .toLowerCase();
    if (h === "signage-event") return "event";
    if (h === "signage-screening") return "screening";
    return null;
  }
  const mode = getSignageMode();
  if (!mode) return;
  document.documentElement.classList.add("is-signage");
  document.body.classList.add("is-signage-vertical");
  document.body.dataset.signage = mode;
  const suffix = mode === "event" ? "イベント（サイネージ）" : "上映プログラム（サイネージ）";
  document.title = `${document.title} — ${suffix}`;
})();

(function initTestPageNotice() {
  if (!TEST_PAGE_NOTICE.ENABLED) return;
  if (document.body.dataset.signage) return;
  const dialog = document.getElementById("test-page-notice-dialog");
  if (!dialog || typeof dialog.showModal !== "function") return;

  const todayYmd = (() => {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  if (todayYmd > TEST_PAGE_NOTICE.VALID_UNTIL) return;

  try {
    if (localStorage.getItem(TEST_PAGE_NOTICE.STORAGE_KEY) === "1") return;
  } catch {
    return;
  }

  dialog.addEventListener("close", () => {
    try {
      localStorage.setItem(TEST_PAGE_NOTICE.STORAGE_KEY, "1");
    } catch (_) {}
  });

  dialog.querySelector("[data-test-notice-confirm]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  requestAnimationFrame(() => {
    try {
      dialog.showModal();
    } catch (_) {}
  });
})();

(function () {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add("show");
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  const signage = Boolean(document.body.dataset.signage);
  document.querySelectorAll(".reveal").forEach((el) => {
    if (signage) el.classList.add("show");
    else io.observe(el);
  });

  function newsDateLabel(item) {
    if (item.dateDisplay) return item.dateDisplay;
    return (item.date || "").replace(/-/g, ".");
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

  (async function loadNewsJson() {
    if (document.body.dataset.signage) return;
    const track = document.querySelector(".hero-news-track");
    const list = document.querySelector(".news-list");
    if (!track || !list) return;
    try {
      const res = await fetch(SITE_CONFIG.newsJsonUrl, { cache: "no-cache" });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length === 0) return;

      track.textContent = "";
      appendHeroMarqueeCycle(track, items);
      appendHeroMarqueeCycle(track, items);

      list.textContent = "";
      for (const item of items) {
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
        list.appendChild(article);
        io.observe(article);
      }
    } catch {
      /* news.json が無い・fetch不可のときはヒーローマーキー・リストは空のまま */
    }
  })();
})();

(function () {
  const root = document.getElementById("hero-field-words");
  if (!root) return;
  if (document.body.dataset.signage) return;

  const TERMS = [
    "Design",
    "Art",
    "Photography",
    "Manga and Animation",
    "Internet",
    "Video",
    "Literature",
    "New Media",
    "Place Making",
    "Creation ,AI",
    "Visual Culture",
    "Social Design",
    "Design Thinking",
  ];

  /** ヒーロー背景テキスト・モード3（循環の最後）。語順は各サイクルでシャッフル */
  const VERBS = [
    "観察する",
    "読み解く",
    "考える",
    "構想する",
    "企てる",
    "定義する",
    "設計する",
    "試す",
    "作る",
    "組み立てる",
    "配置する",
    "描く",
    "撮る",
    "切り取る",
    "つなぐ",
    "重ねる",
    "動かす",
    "区切る",
    "連ねる",
    "間をつくる",
    "書く",
    "タイプする",
    "物語る",
    "描写する",
    "たとえる",
    "書き換える",
    "推敲する",
    "整える",
    "編集する",
    "まとめる",
    "選ぶ",
    "比べる",
    "位置づける",
    "問いを立てる",
    "引き出す",
    "対話する",
    "共有する",
    "振り返る",
    "記録する",
    "伝える",
    "広める",
    "関わる",
    "振る舞う",
    "介入する",
    "組み替える",
    "接続する",
    "検証する",
    "判断する",
    "発見する",
    "展開する",
  ];

  /** デザイン思考プロセス・リサーチ用語（英語）— 語順は各サイクルでシャッフル */
  const DESIGN_PROCESS_TERMS = [
    "Empathize",
    "Define",
    "Ideate",
    "Sketch",
    "Prototyping",
    "Test",
    "Research",
    "Synthesis",
    "Iteration",
    "Persona",
    "Desk Research",
    "Depth Interview",
    "User Journey",
    "Journey Map",
    "Affinity Mapping",
    "How Might We",
    "Problem Statement",
    "Contextual Inquiry",
    "Field Study",
    "Insight",
  ];

  const CMS_ONLY_LABEL = "Creative Media Studies";

  /** 語順シャッフルの次のサイクルまでの待ち（ms） */
  const CYCLE_MS = 10000;

  /**
   * RandomText 既定値に対し、`_` から文字が見え始めるまでを約 1.5 倍に伸ばす。
   * （既定: speed 2 / frameOffset 30 / charOffset 20 / charStep 10）
   */
  const RT_SPEED = 1;
  const RT_FRAME_OFFSET = 30;
  const RT_CHAR_OFFSET = 30;
  const RT_CHAR_STEP = 7;
  /** RandomText: 英語モードは ASCII、日本語モードは BMP（スペース〜）でラップ */
  const RT_MIN_ASCII = 32;
  const RT_MAX_ASCII = 122;
  const RT_MIN_JP = 0x20;
  const RT_MAX_JP = 0xffff;

  /** M PLUS 1 Code が Font Loading API で読めてから日本語スクランブルを有効にする */
  let heroFieldMplusReady = false;
  (function loadHeroFieldFont() {
    const markReady = () => {
      heroFieldMplusReady = true;
      requestAnimationFrame(() => {
        applyHeroFieldWordVerticalTighten();
      });
    };
    try {
      const load =
        document.fonts?.load?.('300 16px "M PLUS 1 Code"') ?? Promise.resolve();
      Promise.all([load, document.fonts?.ready ?? Promise.resolve()])
        .then(markReady)
        .catch(() => {
          /* 取得失敗時は日本語モードのみ即時差し替えのまま */
        });
    } catch {
      document.fonts?.ready?.then(markReady);
    }
  })();

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  const n = TERMS.length;
  /** 1 行あたり「全分野を一通りシャッフルした並び」を何回つなぐか（各分野はこの回数だけ等しく出る） */
  const repeatsPerLine = 3;

  /** 行あたりのスラッシュ区切り語数（モード間で見た目の長さを揃える） */
  const targetItemsPerLine = repeatsPerLine * TERMS.length;

  /**
   * hero 背景テキストのモード（順に循環）
   * 0: 分野配列 TERMS をシャッフル
   * 1: Creative Media Studies のみ羅列
   * 2: デザイン思考プロセス英語をシャッフル
   * 3: 動詞（日本語）VERBS をシャッフル — 最後
   */
  let heroWordCycleIndex = 0;

  function buildShuffledLineToLength(pool) {
    const parts = [];
    while (parts.length < targetItemsPerLine) {
      parts.push(...shuffle(pool));
    }
    parts.length = targetItemsPerLine;
    return `${parts.join(" / ")} / `;
  }

  function buildLineHeroWords(mode) {
    if (mode === 0) {
      const parts = [];
      for (let r = 0; r < repeatsPerLine; r += 1) {
        parts.push(...shuffle(TERMS));
      }
      return `${parts.join(" / ")} / `;
    }
    if (mode === 1) {
      const parts = Array(targetItemsPerLine).fill(CMS_ONLY_LABEL);
      return `${parts.join(" / ")} / `;
    }
    if (mode === 2) {
      return buildShuffledLineToLength(DESIGN_PROCESS_TERMS);
    }
    return buildShuffledLineToLength(VERBS);
  }

  root.textContent = "";
  const lineEls = [];
  for (let row = 0; row < n; row += 1) {
    const p = document.createElement("p");
    p.className = "hero-field-words-line";
    p.textContent = buildLineHeroWords(heroWordCycleIndex);
    root.appendChild(p);
    lineEls.push(p);
  }

  function applyHeroFieldWordVerticalTighten() {
    let sumL = 0;
    for (const el of root.children) {
      sumL += el.offsetHeight;
    }
    const free = Math.max(0, root.clientHeight - sumL);
    const pad = free / 6;
    root.style.setProperty("--hero-field-pad-v", `${pad}px`);
  }

  requestAnimationFrame(() => {
    applyHeroFieldWordVerticalTighten();
    requestAnimationFrame(applyHeroFieldWordVerticalTighten);
  });
  window.addEventListener("resize", applyHeroFieldWordVerticalTighten);
  if (document.fonts?.ready) {
    document.fonts.ready.then(applyHeroFieldWordVerticalTighten);
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasRandomText = typeof window.RandomText === "function";

  let activeHeroRTs = [];
  let activeHeroTimeouts = [];

  function cancelHeroFieldScramble() {
    for (const id of activeHeroTimeouts) window.clearTimeout(id);
    activeHeroTimeouts = [];
    for (const rt of activeHeroRTs) {
      try {
        rt.stop();
      } catch {
        /* noop */
      }
    }
    activeHeroRTs = [];
  }

  function runHeroFieldScrambleCycle() {
    heroWordCycleIndex = (heroWordCycleIndex + 1) % 4;
    cancelHeroFieldScramble();
    const modeJa = heroWordCycleIndex === 3;
    /* 日本語: M PLUS 1 Code 未読込時は即時差し替え（RandomText のコードレンジと描画の両方を安定させる） */
    if (reduceMotion || !hasRandomText || (modeJa && !heroFieldMplusReady)) {
      for (let row = 0; row < n; row += 1) {
        lineEls[row].textContent = buildLineHeroWords(heroWordCycleIndex);
      }
      requestAnimationFrame(applyHeroFieldWordVerticalTighten);
      return;
    }

    const targets = lineEls.map(() => buildLineHeroWords(heroWordCycleIndex));
    const minC = modeJa ? RT_MIN_JP : RT_MIN_ASCII;
    const maxC = modeJa ? RT_MAX_JP : RT_MAX_ASCII;

    let completed = 0;
    const onLineDone = () => {
      completed += 1;
      if (completed >= n) {
        requestAnimationFrame(applyHeroFieldWordVerticalTighten);
      }
    };

    /** 行ごとに開始だけ少しずらす */
    const rowStartGapMs = 140;

    for (let row = 0; row < n; row += 1) {
      const el = lineEls[row];
      const str = targets[row];
      const delayMs = row * rowStartGapMs;
      const tid = window.setTimeout(() => {
        const rt = new window.RandomText({
          str,
          speed: RT_SPEED,
          frameOffset: RT_FRAME_OFFSET,
          charOffset: RT_CHAR_OFFSET,
          charStep: RT_CHAR_STEP,
          minCharCode: minC,
          maxCharCode: maxC,
          onProgress: (s) => {
            el.textContent = s;
          },
          onComplete: (s) => {
            el.textContent = s;
            onLineDone();
          },
        });
        activeHeroRTs.push(rt);
        rt.start();
      }, delayMs);
      activeHeroTimeouts.push(tid);
    }
  }

  window.setInterval(runHeroFieldScrambleCycle, CYCLE_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cancelHeroFieldScramble();
  });
})();

(function () {
  if (document.body.dataset.signage) return;
  const track = document.getElementById("exhTrack");
  const prev = document.querySelector(".exh-prev");
  const next = document.querySelector(".exh-next");
  const dotsHost = document.getElementById("exhDots");
  const counterEl = document.getElementById("exhCounter");
  if (!track || !prev || !next || !dotsHost || !counterEl) return;

  const cards = Array.from(track.querySelectorAll(".exh-card"));
  if (!cards.length) return;

  const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollMotion = () => (reducedMq.matches ? "auto" : "smooth");

  /** @type {HTMLButtonElement[]} */
  const dotButtons = [];

  function captionAt(i) {
    const cap = cards[i]?.querySelector("figcaption");
    return cap?.textContent?.trim() || `作品 ${i + 1}`;
  }

  function indexFromScroll() {
    const sl = track.scrollLeft;
    let best = 0;
    let minD = Infinity;
    cards.forEach((el, i) => {
      const d = Math.abs(el.offsetLeft - sl);
      if (d < minD) {
        minD = d;
        best = i;
      }
    });
    return best;
  }

  function scrollToIndex(i) {
    const idx = Math.max(0, Math.min(cards.length - 1, i));
    track.scrollTo({ left: cards[idx].offsetLeft, behavior: scrollMotion() });
  }

  function updateChrome() {
    const i = indexFromScroll();
    const n = cards.length;

    prev.disabled = i <= 0;
    next.disabled = i >= n - 1;

    const prevTarget = i > 0 ? captionAt(i - 1) : null;
    const nextTarget = i < n - 1 ? captionAt(i + 1) : null;
    prev.setAttribute("aria-label", prevTarget ? `前へ: ${prevTarget}` : "これが最初の作品です");
    next.setAttribute("aria-label", nextTarget ? `次へ: ${nextTarget}` : "これが最後の作品です");

    counterEl.textContent = `${i + 1} / ${n}`;

    dotButtons.forEach((b, j) => {
      const on = j === i;
      b.classList.toggle("is-active", on);
      if (on) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
  }

  cards.forEach((_, j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "exh-dot";
    b.setAttribute("aria-label", captionAt(j));
    b.addEventListener("click", () => scrollToIndex(j));
    dotsHost.appendChild(b);
    dotButtons.push(b);
  });

  prev.addEventListener("click", () => scrollToIndex(indexFromScroll() - 1));
  next.addEventListener("click", () => scrollToIndex(indexFromScroll() + 1));

  if ("onscrollend" in window) {
    track.addEventListener("scrollend", updateChrome);
  } else {
    let scrollEndTimer;
    track.addEventListener("scroll", () => {
      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = window.setTimeout(updateChrome, 150);
    });
  }

  reducedMq.addEventListener("change", updateChrome);

  const ro = new ResizeObserver(() => updateChrome());
  ro.observe(track);

  updateChrome();
})();

(function () {
  const toggle = document.querySelector(".nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  if (!toggle || !mobileNav) return;
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
    mobileNav.classList.toggle("is-open", !expanded);
  });
  mobileNav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      mobileNav.classList.remove("is-open");
    });
  });
})();

(function () {
  const heroBg = document.querySelector(".hero-bg");
  if (!heroBg) return;
  if (document.body.dataset.signage) return;

  const images = Array.from({ length: 72 }, (_, i) => `images/image_${i + 1}.jpeg`);
  if (images.length === 0) return;

  const shuffle = (arr) => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  let queue = shuffle(images);
  const nextImage = () => {
    if (queue.length === 0) queue = shuffle(images);
    return queue.shift();
  };

  heroBg.innerHTML = `
    <div class="hero-bg-slide is-active"><img src="${nextImage()}" alt="" width="1920" height="1080" decoding="async" fetchpriority="high" /></div>
    <div class="hero-bg-slide"><img src="${nextImage()}" alt="" width="1920" height="1080" loading="lazy" decoding="async" /></div>
  `;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const slides = heroBg.querySelectorAll(".hero-bg-slide");
  let activeIndex = 0;
  window.setInterval(() => {
    const current = slides[activeIndex];
    const next = slides[1 - activeIndex];
    const nextImg = next.querySelector("img");
    if (nextImg) nextImg.src = nextImage();
    next.classList.add("is-active");
    current.classList.remove("is-active");
    activeIndex = 1 - activeIndex;
  }, 7000);
})();

(function () {
  const root = document.getElementById("screeningSlideshow");
  if (!root || document.body.dataset.signage) return;
  initScreeningHeroSlideshow(root);
})();

(function initHeroSpotlightSlideshow() {
  const root = document.querySelector(".hero-screening-spotlight");
  if (!root || document.body.dataset.signage) return;
  const slides = root.querySelectorAll(".hero-screening-spotlight__slide");
  if (slides.length < 2) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  const setActive = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((el, j) => el.classList.toggle("is-active", j === index));
  };
  setActive(0);
  if (reduced) return;
  window.setInterval(() => setActive(index + 1), HERO_SPOTLIGHT_SLIDE_INTERVAL_MS);
})();

initScreeningMovies();
initEventsSection();

(function () {
  if (document.body.dataset.signage) return;
  const MAP_KEY = SITE_CONFIG.googleMapsApiKey;
  const VENUES = [
    {
      lat: 34.6861399,
      lng: 135.1828489,
      title: "こうべまちづくり会館",
      color: "#d94e81",
    },
    {
      lat: 34.6867056,
      lng: 135.1838745,
      title: "元町映画館",
      color: "#4c4784",
    },
  ];

  /** 会場カードのドットと同じ :root 変数を優先し、取れなければ VENUES[].color */
  function venuePinColors() {
    const rs = getComputedStyle(document.documentElement);
    const cssVars = ["--venue-pin-a", "--venue-pin-b"];
    return VENUES.map((v, i) => {
      const name = cssVars[i];
      const fromCss = name ? rs.getPropertyValue(name).trim() : "";
      return fromCss || v.color;
    });
  }

  function mapLoadFailedMessage() {
    return (
      "<p style=\"padding:1.5rem;font-size:0.85rem;color:#666;line-height:1.65;\">" +
      "<strong>地図を表示できませんでした（ApiTargetBlocked など）。</strong><br />" +
      "Google Cloud Console の API キーで、次を確認してください。<br />" +
      "・<strong>API の制限</strong>に「Maps JavaScript API」が含まれている（または一時的に「制限なし」で試す）<br />" +
      "・<strong>アプリケーションの制限</strong>が「HTTP リファラー」の場合、現在のオリジンが許可されている（例: <code>http://localhost:8080/*</code>、<code>https://ユーザー名.github.io/*</code>、<code>file://</code> は不可）<br />" +
      "・請求先が有効で「Maps JavaScript API」が有効化されている<br />" +
      "<code>#gmap</code> の <code>data-map-id</code> には、Cloud「マップ管理」で作成した Map ID を設定してください（グレースケールは JS/CSS の filter ではなく、その Map に紐づく<a href=\"https://developers.google.com/maps/documentation/javascript/styling#cloud_tooling\" target=\"_blank\" rel=\"noopener\">クラウドのマップ スタイル</a>で設定します）。空のときは開発用 <code>DEMO_MAP_ID</code> となりカラー地図のままです。" +
      "</p>"
    );
  }

  window.gm_authFailure = function () {
    const el = document.getElementById("gmap");
    if (el) el.innerHTML = mapLoadFailedMessage();
  };

  window.initVenueMap = async function () {
    const el = document.getElementById("gmap");
    if (!el || !window.google?.maps?.importLibrary) {
      if (el) el.innerHTML = mapLoadFailedMessage();
      return;
    }

    try {
      const { Map } = await google.maps.importLibrary("maps");
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

      const customMapId = (el.dataset.mapId || "").trim();
      /** AdvancedMarkerElement には mapId が必須。未設定時は評価用 DEMO_MAP_ID（本番は Cloud の Map ID 推奨） */
      const mapId = customMapId || "DEMO_MAP_ID";
      /* mapId 指定時は styles を付けられない（Cloud Console のマップスタイルで調整）。付与するとコンソール警告になる */
      const mapOptions = {
        mapId,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoom: 16,
        center: { lat: 34.68855, lng: 135.18625 },
        mapTypeId: "roadmap",
      };
      const map = new Map(el, mapOptions);
      map.setOptions({ maxZoom: 18 });

      const pinColors = venuePinColors();
      for (let i = 0; i < VENUES.length; i += 1) {
        const v = VENUES[i];
        const pos = { lat: v.lat, lng: v.lng };
        const color = pinColors[i] || v.color;
        const pin = new PinElement({
          background: color,
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
        });
        new AdvancedMarkerElement({
          map,
          position: pos,
          title: v.title,
          content: pin,
        });
      }

      const bounds = new google.maps.LatLngBounds();
      for (const v of VENUES) {
        bounds.extend({ lat: v.lat, lng: v.lng });
      }
      map.fitBounds(bounds, { top: 48, right: 40, bottom: 48, left: 40 });
    } catch (err) {
      el.innerHTML = mapLoadFailedMessage();
      console.error(err);
    }
  };

  const s = document.createElement("script");
  s.src =
    "https://maps.googleapis.com/maps/api/js?key=" +
    encodeURIComponent(MAP_KEY) +
    "&callback=initVenueMap&language=ja&loading=async&v=weekly";
  s.async = true;
  s.defer = true;
  s.onerror = function () {
    const el = document.getElementById("gmap");
    if (el) el.innerHTML = mapLoadFailedMessage();
  };
  document.head.appendChild(s);
})();

