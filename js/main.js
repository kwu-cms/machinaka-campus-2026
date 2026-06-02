import { SITE_CONFIG, TEST_PAGE_NOTICE, HERO_SPOTLIGHT_SLIDE_INTERVAL_MS } from "./config.js";
import { initScreeningMovies } from "./screening-movies.js";
import { initExhibitionSection } from "./exhibition.js";
import { initEventsSection } from "./events.js";
import { initNews } from "./news.js";
import { initScrollChoreography } from "./scroll-choreography.js";
import { pictureHTML, setResponsivePicture } from "./lib/responsive-image.js";
import { readActiveSignageHeroIndex, storeSignageHeroIndex } from "./signage-hero-state.js";


/** @returns {URLSearchParams} */
function signageSearchParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

/** サイネージの1画面あたり秒数（`duration=60`）。既定 60、最小 5、最大 3600 */
function parseSignageDurationSeconds(raw) {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 60;
  return Math.min(3600, Math.max(5, n));
}

/**
 * 縦型サイネージ（1080×1920 想定）。
 * - `?signage=screening|event` または `#signage-screening` / `#signage-event`
 * - 交互表示: `?signage=cycle&duration=60`（`view=screening|event` で開始画面）
 * - 別表記: `?signage=screening,event&duration=60` / `?signage=screening&cycle=1&duration=60`
 */
(function initSignageMode() {
  function getSignageMode() {
    const params = signageSearchParams();
    let q = String(params.get("signage") || "").toLowerCase();

    if (q === "cycle" || q === "rotate" || q === "both") {
      const view = String(params.get("view") || params.get("phase") || "screening").toLowerCase();
      return view === "event" ? "event" : "screening";
    }

    if (q.includes(",")) {
      const parts = q
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s === "screening" || s === "event");
      if (parts.length) {
        const view = String(params.get("view") || parts[0] || "screening").toLowerCase();
        return view === "event" ? "event" : "screening";
      }
    }

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

/** 上映 ⇄ イベントを一定間隔で URL 遷移して切り替え（キオスク用） */
(function initSignageCycle() {
  const params = signageSearchParams();
  const rawSignage = String(params.get("signage") || "").toLowerCase();
  const cycleFlag =
    params.get("cycle") === "1" ||
    params.get("rotate") === "1" ||
    params.get("alternate") === "1";

  /** @type {("screening"|"event")[]} */
  let modes = [];
  if (rawSignage === "cycle" || rawSignage === "rotate" || rawSignage === "both") {
    modes = ["screening", "event"];
  } else if (rawSignage.includes(",")) {
    modes = rawSignage
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s === "screening" || s === "event");
  } else if (cycleFlag && (rawSignage === "screening" || rawSignage === "event")) {
    modes = ["screening", "event"];
  }

  if (modes.length < 2) return;
  const current = document.body.dataset.signage;
  if (current !== "screening" && current !== "event") return;

  const durationSec = parseSignageDurationSeconds(params.get("duration"));
  const idx = Math.max(0, modes.indexOf(current));
  const next = modes[(idx + 1) % modes.length];

  const useCycleParam =
    rawSignage === "cycle" ||
    rawSignage === "rotate" ||
    rawSignage === "both" ||
    rawSignage.includes(",");

  window.setTimeout(() => {
    storeSignageHeroIndex(current, readActiveSignageHeroIndex(current));
    const p = new URLSearchParams(params);
    if (useCycleParam) {
      p.set("signage", "cycle");
      p.set("view", next);
      p.delete("phase");
    } else {
      p.set("signage", next);
      p.set("cycle", "1");
    }
    p.set("duration", String(durationSec));
    const qs = p.toString();
    const hash = window.location.hash || "";
    window.location.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}${hash}`);
  }, durationSec * 1000);
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

  initNews({ observeReveal: (el) => io.observe(el) });
  initScrollChoreography();
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

  /** 背景テキスト全体の傾き（ヒーロー中心・-20°〜20°・5°刻み）— 待機中に EaseOutQuint で切替 */
  const HERO_FIELD_ROT_MIN = -20;
  const HERO_FIELD_ROT_MAX = 20;
  const HERO_FIELD_ROT_STEP = 5;
  const HERO_FIELD_ROT_MIN_DELTA = 10;
  const HERO_FIELD_ROT_ANGLES = (() => {
    const angles = [];
    for (let d = HERO_FIELD_ROT_MIN; d <= HERO_FIELD_ROT_MAX; d += HERO_FIELD_ROT_STEP) {
      angles.push(d);
    }
    return angles;
  })();
  const HERO_FIELD_ROT_TRANSITION_MS = 680;
  const HERO_FIELD_SCALE_BASE = 1.18;
  /** 最大傾きでも端が抜けないよう確保する最低行数 */
  const HERO_FIELD_LINE_FLOOR = 19;
  /** テキスト切替の直前に回転を終える余白（ms） */
  const HERO_FIELD_ROT_BUFFER_MS = 180;
  /** スクランブル完了後、回転開始までの最短待ち（ms） */
  const HERO_FIELD_ROT_MIN_IDLE_MS = 1200;

  let heroFieldRotateDeg = -6;
  let heroFieldRotateAnim = null;
  let heroFieldCycleStartMs = performance.now();
  let heroFieldRotateTimeout = null;

  function easeOutQuint(t) {
    return 1 - (1 - t) ** 5;
  }

  function heroFieldScaleForAngle(deg) {
    const rad = (Math.abs(deg) * Math.PI) / 180;
    if (rad < 0.001) return HERO_FIELD_SCALE_BASE;
    const corrected = HERO_FIELD_SCALE_BASE / Math.cos(rad * 0.92);
    return Math.min(corrected, HERO_FIELD_SCALE_BASE * 1.14);
  }

  function setHeroFieldRotate(deg) {
    heroFieldRotateDeg = deg;
    root.style.setProperty("--hero-field-rotate", `${deg.toFixed(2)}deg`);
    root.style.setProperty("--hero-field-scale", heroFieldScaleForAngle(deg).toFixed(3));
  }

  function clearHeroFieldRotateTimeout() {
    if (heroFieldRotateTimeout != null) {
      window.clearTimeout(heroFieldRotateTimeout);
      heroFieldRotateTimeout = null;
    }
  }

  function pickNextHeroFieldRotate(current) {
    const candidates = HERO_FIELD_ROT_ANGLES.filter((a) => Math.abs(a - current) > HERO_FIELD_ROT_MIN_DELTA);
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    for (let i = 0; i < 32; i += 1) {
      const pick = HERO_FIELD_ROT_ANGLES[Math.floor(Math.random() * HERO_FIELD_ROT_ANGLES.length)];
      if (Math.abs(pick - current) > HERO_FIELD_ROT_MIN_DELTA) return pick;
    }
    return HERO_FIELD_ROT_ANGLES.find((a) => a !== current) ?? HERO_FIELD_ROT_ANGLES[0];
  }

  function animateHeroFieldRotate(toDeg) {
    if (heroFieldRotateAnim) cancelAnimationFrame(heroFieldRotateAnim);

    if (reduceMotion) {
      setHeroFieldRotate(toDeg);
      requestAnimationFrame(syncHeroFieldLayout);
      return;
    }

    const fromDeg = heroFieldRotateDeg;
    const fromScale = heroFieldScaleForAngle(fromDeg);
    const toScale = heroFieldScaleForAngle(toDeg);
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / HERO_FIELD_ROT_TRANSITION_MS);
      const eased = easeOutQuint(t);
      const deg = fromDeg + (toDeg - fromDeg) * eased;
      const scale = fromScale + (toScale - fromScale) * eased;
      root.style.setProperty("--hero-field-rotate", `${deg.toFixed(2)}deg`);
      root.style.setProperty("--hero-field-scale", scale.toFixed(3));
      if (t < 1) {
        heroFieldRotateAnim = requestAnimationFrame(tick);
      } else {
        heroFieldRotateAnim = null;
        setHeroFieldRotate(toDeg);
        requestAnimationFrame(syncHeroFieldLayout);
      }
    };

    heroFieldRotateAnim = requestAnimationFrame(tick);
  }

  function advanceHeroFieldRotate() {
    animateHeroFieldRotate(pickNextHeroFieldRotate(heroFieldRotateDeg));
  }

  function scheduleIdleRotation() {
    clearHeroFieldRotateTimeout();
    const elapsed = performance.now() - heroFieldCycleStartMs;
    const leadMs = HERO_FIELD_ROT_TRANSITION_MS + HERO_FIELD_ROT_BUFFER_MS;
    const delay = Math.max(HERO_FIELD_ROT_MIN_IDLE_MS, CYCLE_MS - elapsed - leadMs);
    heroFieldRotateTimeout = window.setTimeout(() => {
      heroFieldRotateTimeout = null;
      advanceHeroFieldRotate();
    }, delay);
  }

  setHeroFieldRotate(heroFieldRotateDeg);

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
        syncHeroFieldLayout();
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

  const nTerms = TERMS.length;
  /** 1 行あたり「全分野を一通りシャッフルした並び」を何回つなぐか（各分野はこの回数だけ等しく出る） */
  const repeatsPerLine = 3;

  /** 行あたりのスラッシュ区切り語数（モード間で見た目の長さを揃える） */
  const targetItemsPerLine = repeatsPerLine * nTerms;

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
  let n = 0;

  function computeHeroFieldLineCount() {
    const hero = root.closest(".hero");
    if (!hero) return Math.max(nTerms, HERO_FIELD_LINE_FLOOR);

    const { width, height } = hero.getBoundingClientRect();
    if (height < 1) return Math.max(nTerms, HERO_FIELD_LINE_FLOOR);

    const probe = lineEls[0];
    const lineHeight =
      probe?.getBoundingClientRect().height ||
      parseFloat(getComputedStyle(probe || root).fontSize) ||
      44;
    const scale = heroFieldScaleForAngle(HERO_FIELD_ROT_MAX);
    const maxRad = (HERO_FIELD_ROT_MAX * Math.PI) / 180;
    const safety = 1.22;
    const requiredContentH =
      (height / (scale * Math.cos(maxRad))) * safety + width * Math.sin(maxRad) * 0.1;

    return Math.max(nTerms, Math.ceil(requiredContentH / lineHeight), HERO_FIELD_LINE_FLOOR);
  }

  function ensureHeroFieldLineCount() {
    const want = computeHeroFieldLineCount();
    const text = buildLineHeroWords(heroWordCycleIndex);

    while (lineEls.length < want) {
      const p = document.createElement("p");
      p.className = "hero-field-words-line";
      p.textContent = text;
      root.appendChild(p);
      lineEls.push(p);
    }
    while (lineEls.length > want) {
      lineEls.pop()?.remove();
    }
    n = lineEls.length;
  }

  for (let row = 0; row < nTerms; row += 1) {
    const p = document.createElement("p");
    p.className = "hero-field-words-line";
    p.textContent = buildLineHeroWords(heroWordCycleIndex);
    root.appendChild(p);
    lineEls.push(p);
  }
  ensureHeroFieldLineCount();

  function applyHeroFieldWordVerticalTighten() {
    let sumL = 0;
    for (const el of root.children) {
      sumL += el.offsetHeight;
    }
    const free = Math.max(0, root.clientHeight - sumL);
    const pad = free / Math.max(6, n + 2);
    root.style.setProperty("--hero-field-pad-v", `${pad}px`);
  }

  function syncHeroFieldLayout() {
    ensureHeroFieldLineCount();
    applyHeroFieldWordVerticalTighten();
  }

  requestAnimationFrame(() => {
    syncHeroFieldLayout();
    requestAnimationFrame(syncHeroFieldLayout);
  });
  window.addEventListener("resize", syncHeroFieldLayout);
  if (document.fonts?.ready) {
    document.fonts.ready.then(syncHeroFieldLayout);
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
    heroFieldCycleStartMs = performance.now();
    clearHeroFieldRotateTimeout();
    cancelHeroFieldScramble();
    const modeJa = heroWordCycleIndex === 3;
    /* 日本語: M PLUS 1 Code 未読込時は即時差し替え（RandomText のコードレンジと描画の両方を安定させる） */
    if (reduceMotion || !hasRandomText || (modeJa && !heroFieldMplusReady)) {
      for (let row = 0; row < n; row += 1) {
        lineEls[row].textContent = buildLineHeroWords(heroWordCycleIndex);
      }
      requestAnimationFrame(applyHeroFieldWordVerticalTighten);
      scheduleIdleRotation();
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
        scheduleIdleRotation();
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

  scheduleIdleRotation();

  window.setInterval(runHeroFieldScrambleCycle, CYCLE_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      cancelHeroFieldScramble();
      clearHeroFieldRotateTimeout();
      if (heroFieldRotateAnim) cancelAnimationFrame(heroFieldRotateAnim);
      heroFieldRotateAnim = null;
    }
  });
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

  const stems = Array.from({ length: 72 }, (_, i) => `image_${i + 1}`);
  if (stems.length === 0) return;

  const shuffle = (arr) => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  let queue = shuffle(stems);
  const nextStem = () => {
    if (queue.length === 0) queue = shuffle(stems);
    return queue.shift();
  };

  const first = nextStem();
  const second = nextStem();
  heroBg.innerHTML = `
    <div class="hero-bg-slide is-active">${pictureHTML(first, "hero", { alt: "", fetchpriority: "high" })}</div>
    <div class="hero-bg-slide">${pictureHTML(second, "hero", { alt: "", loading: "lazy" })}</div>
  `;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const slides = heroBg.querySelectorAll(".hero-bg-slide");
  let activeIndex = 0;
  window.setInterval(() => {
    const current = slides[activeIndex];
    const next = slides[1 - activeIndex];
    setResponsivePicture(next, nextStem(), "hero", { alt: "", loading: "lazy" });
    next.classList.add("is-active");
    current.classList.remove("is-active");
    activeIndex = 1 - activeIndex;
  }, 7000);
})();

(function initStaticResponsiveImages() {
  if (document.body.dataset.signage) return;

  const spotlightStems = [
    "screening-slides/screening_1",
    "screening-slides/screening_2",
    "screening-slides/screening_3",
    "screening-slides/screening_4",
    "screening-slides/screening_5",
    "screening-slides/screening_6",
  ];
  document.querySelectorAll(".hero-screening-spotlight__slide").forEach((el, i) => {
    if (el.tagName === "PICTURE") return;
    const stem = spotlightStems[i];
    if (!stem) return;
    const loading = i === 0 ? undefined : "lazy";
    const pic = pictureHTML(stem, "screening", { alt: "", loading, class: el.className });
    const wrap = document.createElement("span");
    wrap.innerHTML = pic;
    const picture = wrap.firstElementChild;
    if (picture) {
      picture.classList.add("hero-screening-spotlight__slide");
      if (el.classList.contains("is-active")) picture.classList.add("is-active");
      el.replaceWith(picture);
    }
  });
})();

(function initHeroSpotlightSlideshow() {
  const root = document.querySelector('a.hero-screening-spotlight[href="#screening"]');
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

(function initHeroSpotlightLink() {
  const link = document.querySelector('a.hero-screening-spotlight[href="#screening"]');
  if (!link || document.body.dataset.signage) return;

  link.addEventListener("click", (e) => {
    const target = document.getElementById("screening");
    if (!target) return;
    e.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#screening");
  });
})();

initExhibitionSection();
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
      color: "#c6171d",
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
      "<code>#gmap</code> の <code>data-map-id</code> には、Cloud「マップ管理」で作成した Map ID を設定できます（<a href=\"https://developers.google.com/maps/documentation/javascript/styling#cloud_tooling\" target=\"_blank\" rel=\"noopener\">クラウドのマップ スタイル</a>で完全なグレースケール等も可能）。空のときは開発用 <code>DEMO_MAP_ID</code> となりカラー地図です。サイト上は CSS で彩度を抑えています。" +
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
        zoom: 14,
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
      const fitPadding = { top: 48, right: 40, bottom: 48, left: 40 };
      map.fitBounds(bounds, fitPadding);
      /* fitBounds 後、UI の「−」2段階ぶん広げる（より遠方まで表示） */
      google.maps.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (typeof z === "number") map.setZoom(Math.max(z - 2, 0));
      });
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

