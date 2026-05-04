      /** fetch 先・外部 API。公開リポジトリでは Maps キーのリファラー制限を別途確認してください。 */
      const SITE_CONFIG = Object.freeze({
        newsJsonUrl: "./data/news.json",
        /** Google スプレッドシート「上映」シート（CSV エクスポート）。共有設定で「リンクを知っている全員が閲覧可」にしてください。 */
        moviesCsvUrl:
          "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=1499163471",
        eventsCsvUrl:
          "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=651546877",
        googleMapsApiKey: "AIzaSyDSfeNa_ftv6Orh--hQQOvZOVyRCuUvBqg",
      });

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

      /**
       * テストページの初回アクセス告知（ローカル日付が VALID_UNTIL 以前のときのみ）。
       * 本番: `ENABLED` を false にするだけで無効化できます。
       * 完全削除: この定数と直後の IIFE、`index.html` の test-page-notice-dialog、`styles.css` の「test-page-notice」を検索して削除。
       */
      const TEST_PAGE_NOTICE = Object.freeze({
        ENABLED: true,
        VALID_UNTIL: "2026-05-31",
        STORAGE_KEY: "mxm2026_testPageNoticeDismissed_v1",
      });

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
         * 0: 分野配列 TERMS をシャッフル（従来どおり）
         * 1: Creative Media Studies のみ羅列
         * 2: デザイン思考プロセス英語をシャッフル
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
          return buildShuffledLineToLength(DESIGN_PROCESS_TERMS);
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
          heroWordCycleIndex = (heroWordCycleIndex + 1) % 3;
          cancelHeroFieldScramble();
          if (reduceMotion || !hasRandomText) {
            for (let row = 0; row < n; row += 1) {
              lineEls[row].textContent = buildLineHeroWords(heroWordCycleIndex);
            }
            requestAnimationFrame(applyHeroFieldWordVerticalTighten);
            return;
          }

          const targets = lineEls.map(() => buildLineHeroWords(heroWordCycleIndex));

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

      /** #screeningSlideshow（静的HTMLまたは CSV 差し替え後）のドット・自動送り */
      let mxmScreeningHeroSlideTimer = null;
      function clearMxmScreeningHeroSlideTimer() {
        if (mxmScreeningHeroSlideTimer != null) {
          window.clearInterval(mxmScreeningHeroSlideTimer);
          mxmScreeningHeroSlideTimer = null;
        }
      }

      function initScreeningHeroSlideshow(root) {
        clearMxmScreeningHeroSlideTimer();
        if (!root) return;
        if (document.body.dataset.signage) return;

        const slides = Array.from(root.querySelectorAll(".screening-slide"));
        const dotsHost = root.querySelector(".screening-slideshow-dots");
        if (!slides.length || !dotsHost) return;

        dotsHost.textContent = "";

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let index = 0;

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
          b.className = "screening-dot";
          const panel = slideEl.querySelector(".mv-float-panel");
          const cap = slideEl.querySelector("figcaption");
          const labelSrc = panel || cap;
          b.setAttribute(
            "aria-label",
            labelSrc && labelSrc.textContent.trim() ? labelSrc.textContent.trim() : `スライド ${j + 1}`,
          );
          b.addEventListener("click", () => {
            setActive(j);
            clearMxmScreeningHeroSlideTimer();
            if (!reduced) {
              mxmScreeningHeroSlideTimer = window.setInterval(() => setActive(index + 1), 5200);
            }
          });
          dotsHost.appendChild(b);
        });

        setActive(0);

        if (!reduced) {
          mxmScreeningHeroSlideTimer = window.setInterval(() => setActive(index + 1), 5200);
        }
      }

      (function () {
        const root = document.getElementById("screeningSlideshow");
        if (!root || document.body.dataset.signage) return;
        initScreeningHeroSlideshow(root);
      })();

      (function () {
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

        function parseCSV(text) {
          const rows = [];
          let row = [];
          let field = "";
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
              if (c === '"') {
                if (text[i + 1] === '"') {
                  field += '"';
                  i++;
                } else {
                  inQuotes = false;
                }
              } else {
                field += c;
              }
            } else if (c === '"') {
              inQuotes = true;
            } else if (c === ",") {
              row.push(field);
              field = "";
            } else if (c === "\n" || c === "\r") {
              if (c === "\r" && text[i + 1] === "\n") i++;
              row.push(field);
              if (row.some((cell) => cell.trim() !== "")) rows.push(row);
              row = [];
              field = "";
            } else {
              field += c;
            }
          }
          row.push(field);
          if (row.some((cell) => cell.trim() !== "")) rows.push(row);
          return rows;
        }

        function escapeHtml(s) {
          return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        }

        function rowToObj(headers, cells) {
          const o = {};
          headers.forEach((h, i) => {
            o[h] = cells[i] != null ? cells[i].trim() : "";
          });
          return o;
        }

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
                <p class="program-kicker">- P01 - Screening</p>
                <h3 class="program-title">上映</h3>
              </div>
              <span class="program-venue">元町映画館</span>
            </header>
            <h4 class="screening-program-name signage-screening-chrome-program-name">特別上映プログラム「南女シネマ」</h4>
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
          const SIGNAGE_SCREENING_HERO_INTERVAL_MS = 15000;
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
                timer = window.setInterval(() => setActive(index + 1), SIGNAGE_SCREENING_HERO_INTERVAL_MS);
              }
            });
            dotsHost.appendChild(b);
          });

          setActive(0);
          if (reduced) return;
          timer = window.setInterval(() => setActive(index + 1), SIGNAGE_SCREENING_HERO_INTERVAL_MS);
        }

        const titleEl = dialog.querySelector("#movie-dialog-title");
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

            const MV_PROGRAM_SLOT_TIME = "17:00～19:10";
            const MV_PROGRAM_SLOT_VENUE = "元町映画館";

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
      })();

      (function () {
        const permanentHost = document.getElementById("ev-permanent-list");
        const listHost = document.getElementById("ev-list");
        const sectionRoot = document.querySelector("#event .ev-section");
        if (!permanentHost || !listHost) return;
        if (document.body.dataset.signage === "screening") {
          if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
          return;
        }

        const CSV_URL = SITE_CONFIG.eventsCsvUrl;
        const DETAIL_PLACEHOLDER =
          "詳細テキストは準備中です。開催にあわせて内容を更新します。最新情報はInstagram（@mediastudies_kwu）もご確認ください。";

        function parseCSV(text) {
          const rows = [];
          let row = [];
          let field = "";
          let inQuotes = false;
          for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
              if (c === '"') {
                if (text[i + 1] === '"') {
                  field += '"';
                  i++;
                } else {
                  inQuotes = false;
                }
              } else {
                field += c;
              }
            } else if (c === '"') {
              inQuotes = true;
            } else if (c === ",") {
              row.push(field);
              field = "";
            } else if (c === "\n" || c === "\r") {
              if (c === "\r" && text[i + 1] === "\n") i++;
              row.push(field);
              if (row.some((cell) => cell.trim() !== "")) rows.push(row);
              row = [];
              field = "";
            } else {
              field += c;
            }
          }
          row.push(field);
          if (row.some((cell) => cell.trim() !== "")) rows.push(row);
          return rows;
        }

        function escapeHtml(s) {
          return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
        }

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

        function timeSortKey(timeLine) {
          const m = String(timeLine).match(/(\d{1,2}):(\d{2})/);
          if (!m) return 9999;
          return Number(m[1]) * 60 + Number(m[2]);
        }

        /** 終了時刻（範囲の2つ目）。並び替えの第2キー用 */
        function timeEndSortKey(timeLine) {
          const t = String(timeLine || "").trim();
          const sep = /[–\-〜～]/;
          const parts = t.split(sep);
          const endPart = (parts.length > 1 ? parts[1] : parts[0] || "").trim();
          const m = endPart.match(/(\d{1,2}):(\d{2})/);
          if (!m) return 9999;
          return Number(m[1]) * 60 + Number(m[2]);
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

        function rowToObj(headers, cells) {
          const o = {};
          headers.forEach((h, i) => {
            o[h] = cells[i] != null ? cells[i].trim() : "";
          });
          return o;
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

          listHost.innerHTML =
            html ||
            '<p class="ev-empty">タイムテーブルに表示できるイベントがありません。</p>';

          if (sectionRoot) sectionRoot.setAttribute("aria-busy", "false");
        }

        load();
      })();

      (function () {
        if (document.body.dataset.signage) return;
        const MAP_KEY = SITE_CONFIG.googleMapsApiKey;
        const VENUES = [
          {
            lat: 34.6861399,
            lng: 135.1828489,
            title: "こうべまちづくり会館",
            color: "#ff6a3d",
          },
          {
            lat: 34.6867056,
            lng: 135.1838745,
            title: "元町映画館",
            color: "#4cc9f0",
          },
        ];

        /** 会場カードのドットと同じ :root 変数を優先し、取れなければ VENUES[].color */
        function venuePinColors() {
          const rs = getComputedStyle(document.documentElement);
          const cssVars = ["--accent", "--accent-2"];
          return VENUES.map((v, i) => {
            const name = cssVars[i];
            const fromCss = name ? rs.getPropertyValue(name).trim() : "";
            return fromCss || v.color;
          });
        }

        /** mapId なし時の Marker 用（テーマ色のピン形 SVG） */
        function classicColoredPinIcon(color) {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
            <path fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"
              d="M18 2C10.8 2 5 7.6 5 14.4c0 9.4 13 25.6 13 25.6S31 23.8 31 14.4C31 7.6 25.2 2 18 2z"/>
            <circle fill="#ffffff" fill-opacity="0.92" cx="18" cy="15" r="5.5"/>
          </svg>`;
          return {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(36, 48),
            anchor: new google.maps.Point(18, 46),
          };
        }

        function mapLoadFailedMessage() {
          return (
            "<p style=\"padding:1.5rem;font-size:0.85rem;color:#666;line-height:1.65;\">" +
            "<strong>地図を表示できませんでした（ApiTargetBlocked など）。</strong><br />" +
            "Google Cloud Console の API キーで、次を確認してください。<br />" +
            "・<strong>API の制限</strong>に「Maps JavaScript API」が含まれている（または一時的に「制限なし」で試す）<br />" +
            "・<strong>アプリケーションの制限</strong>が「HTTP リファラー」の場合、現在のオリジンが許可されている（例: <code>http://localhost:8080/*</code>、<code>https://ユーザー名.github.io/*</code>、<code>file://</code> は不可）<br />" +
            "・請求先が有効で「Maps JavaScript API」が有効化されている<br />" +
            "本番公開時は <code>#gmap</code> の <code>data-map-id</code> に、Cloud の「マップ管理」で作成したベクタマップ用の Map ID を入れると推奨です（空のときは開発用 <code>DEMO_MAP_ID</code> を使用）。" +
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
            const mapOptions = {
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              zoom: 16,
              center: { lat: 34.68855, lng: 135.18625 },
              mapTypeId: "roadmap",
              styles: [
                { elementType: "geometry", stylers: [{ saturation: -100 }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#5f5f5f" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
                { featureType: "poi", stylers: [{ saturation: -100 }] },
                { featureType: "transit", stylers: [{ saturation: -100 }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#d0d0d0" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#c6c6c6" }] },
              ],
            };
            if (customMapId) mapOptions.mapId = customMapId;
            const map = new Map(el, mapOptions);

            const pinColors = venuePinColors();
            for (let i = 0; i < VENUES.length; i += 1) {
              const v = VENUES[i];
              const pos = { lat: v.lat, lng: v.lng };
              const color = pinColors[i] || v.color;
              if (customMapId) {
                const pin = new PinElement({
                  background: color,
                  borderColor: "#ffffff",
                  glyphColor: "#ffffff",
                });
                new AdvancedMarkerElement({
                  map,
                  position: pos,
                  title: v.title,
                  content: pin.element,
                });
              } else {
                // mapId を使わない（styles 優先）時は通常マーカー＋テーマ色アイコン
                new google.maps.Marker({
                  map,
                  position: pos,
                  title: v.title,
                  icon: classicColoredPinIcon(color),
                });
              }
            }
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
