      (function () {
        const io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) e.target.classList.add("show");
            }
          },
          { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
        );

        document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

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
          const track = document.querySelector(".hero-news-track");
          const list = document.querySelector(".news-list");
          if (!track || !list) return;
          try {
            const res = await fetch("./news.json", { cache: "no-cache" });
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

        /** 分野語をシャッフルした列を、行の長さが足りるまで繰り返しつなぐ（各分野は各ブロックで 1 回ずつ） */
        function buildLineFieldWords() {
          const parts = [];
          for (let r = 0; r < repeatsPerLine; r += 1) {
            parts.push(...shuffle(TERMS));
          }
          return `${parts.join(" / ")} / `;
        }

        root.textContent = "";
        const lineEls = [];
        for (let row = 0; row < n; row += 1) {
          const p = document.createElement("p");
          p.className = "hero-field-words-line";
          p.textContent = buildLineFieldWords();
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
          cancelHeroFieldScramble();
          if (reduceMotion || !hasRandomText) {
            for (let row = 0; row < n; row += 1) {
              lineEls[row].textContent = buildLineFieldWords();
            }
            requestAnimationFrame(applyHeroFieldWordVerticalTighten);
            return;
          }

          const targets = lineEls.map(() => buildLineFieldWords());

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
        const track = document.getElementById("exhTrack");
        const prev = document.querySelector(".exh-prev");
        const next = document.querySelector(".exh-next");
        if (!track || !prev || !next) return;
        const step = () => Math.min(Math.round(track.clientWidth * 0.82), 340);
        prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
        next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
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
        if (!root) return;

        const slides = Array.from(root.querySelectorAll(".screening-slide"));
        const dotsHost = root.querySelector(".screening-slideshow-dots");
        if (!slides.length || !dotsHost) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let index = 0;
        let timer = null;

        const setActive = (nextIndex) => {
          const i = (nextIndex + slides.length) % slides.length;
          index = i;
          slides.forEach((s, j) => s.classList.toggle("is-active", j === i));
          const dots = dotsHost.querySelectorAll("button");
          dots.forEach((d, j) => d.classList.toggle("is-active", j === i));
        };

        slides.forEach((slideEl, j) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "screening-dot";
          const cap = slideEl.querySelector("figcaption");
          b.setAttribute(
            "aria-label",
            cap && cap.textContent.trim() ? cap.textContent.trim() : `スライド ${j + 1}`,
          );
          b.addEventListener("click", () => {
            setActive(j);
            if (timer) window.clearInterval(timer);
            if (!reduced) timer = window.setInterval(() => setActive(index + 1), 5200);
          });
          dotsHost.appendChild(b);
        });

        setActive(0);

        if (reduced) return;

        timer = window.setInterval(() => setActive(index + 1), 5200);
      })();

      (function () {
        const permanentHost = document.getElementById("ev-permanent-list");
        const listHost = document.getElementById("ev-list");
        const sectionRoot = document.querySelector("#event .ev-section");
        if (!permanentHost || !listHost) return;

        const CSV_URL =
          "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=651546877";
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
            parts.push(
              `<div class="ev-tags">${tags
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
            return `<div class="ev-time-inner ev-time-inner--single"><span class="ev-time-part">${escapeHtml(start)}</span></div>`;
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
            ? `<span class="ev-domain">${escapeHtml(hashLabel(ev.domain))}</span>`
            : "";

          return `<div class="ev-card ev-card--${escapeHtml(ev.cat)}" id="${escapeHtml(ev.id)}">
            <div class="ev-time">
              ${timeColumnHtml(ev)}
            </div>
            <div class="ev-body">
              <div class="ev-meta">
                <span class="ev-cat ev-cat-${escapeHtml(ev.cat)}">${escapeHtml(hashLabel(catLabel(ev.cat)))}</span>
                ${domainHtml}
                ${ev.apply ? '<span class="ev-apply-inline">要申込</span>' : ""}
              </div>
              <div class="ev-title">${escapeHtml(ev.name)}</div>
              <div class="ev-detail">${detailInner}</div>
            </div>
          </div>`;
        }

        async function load() {
          let records;
          try {
            const res = await fetch(CSV_URL, { cache: "no-store" });
            if (!res.ok) throw new Error(String(res.status));
            const text = await res.text();
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

          const events = records.map((r) => ({
            id: r["ID"] || "",
            cat: (r["カテゴリ"] || "").trim().toLowerCase(),
            name: (r["イベント名"] || "").replace(/\s+/g, " ").trim(),
            domain: r["担当分野"] || "",
            dateLine: r["日付1行目"] || "",
            timeLine: r["時間2行目"] || "",
            tagsRaw: r["タグ"] || "",
            desc: (r[DESC_KEY] || "").trim(),
            apply: parseBool(r["申込要否"] || ""),
            applyUrl: (r["申込URL"] || "").trim(),
            sort: Number((r["表示順"] || "999").trim()) || 999,
            day: dayKeyFromDateStr(r["日付1行目"] || ""),
          }));

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
        const MAP_KEY = "AIzaSyDSfeNa_ftv6Orh--hQQOvZOVyRCuUvBqg";
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
