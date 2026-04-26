      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) e.target.classList.add("show");
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      for (const el of document.querySelectorAll(".reveal")) io.observe(el);

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
          "Workshop"
        ];

        /** 語順シャッフルの次のサイクルまでの待ち（ms） */
        const CYCLE_MS = 10000;

        /**
         * RandomText 既定値に対し、`_` から文字が見え始めるまでを約 1.5 倍に伸ばす。
         * （既定: speed 2 / frameOffset 30 / charOffset 20 / charStep 10）
         */
        const RT_SPEED = 4 / 3;
        const RT_FRAME_OFFSET = 45;
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

        slides.forEach((_, j) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "screening-dot";
          b.setAttribute("aria-label", `スライド ${j + 1}`);
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
        const rows = document.querySelectorAll("#event .event-list--cards li");
        const modal = document.getElementById("event-modal");
        const closeBtn = document.getElementById("event-modal-close");
        const modalImage = document.getElementById("event-modal-image");
        const modalType = document.getElementById("event-modal-type");
        const modalTitle = document.getElementById("event-modal-title");
        const modalTime = document.getElementById("event-modal-time");
        const modalFieldWrap = document.getElementById("event-modal-field-wrap");
        const modalField = document.getElementById("event-modal-field");
        const modalDetail = document.getElementById("event-modal-detail");
        const modalApply = document.getElementById("event-modal-apply");
        if (
          !rows.length ||
          !modal ||
          !closeBtn ||
          !modalImage ||
          !modalType ||
          !modalTitle ||
          !modalTime ||
          !modalFieldWrap ||
          !modalField ||
          !modalDetail ||
          !modalApply
        )
          return;

        let lastFocused = null;

        function openModal(row) {
          const title = row.querySelector(".ev-body strong")?.textContent?.trim() || "";
          const dateLine = row.querySelector(".ev-time .ev-date")?.textContent?.trim() || "";
          const timeLine = row.querySelector(".ev-time .ev-time-range")?.textContent?.trim() || "";
          const field = row.querySelector(".ev-field-tag")?.textContent?.trim() || "";
          const image = row.querySelector(".ev-thumb");
          const type = row.closest("ul")?.previousElementSibling?.textContent?.trim() || "イベント";
          const detail = row.dataset.detail || "詳細情報は後日更新予定です。";
          const applyLink = row.querySelector(".ev-status--apply");

          if (image) {
            modalImage.src = image.src;
            modalImage.alt = image.alt || title;
          }
          modalType.textContent = type;
          modalTitle.textContent = title;
          modalTime.textContent = [dateLine, timeLine].filter(Boolean).join("\n") || "-";
          if (field) {
            modalField.textContent = field;
            modalFieldWrap.classList.add("is-visible");
          } else {
            modalField.textContent = "";
            modalFieldWrap.classList.remove("is-visible");
          }
          modalDetail.textContent = detail;
          if (applyLink && applyLink.getAttribute("href")) {
            modalApply.href = applyLink.getAttribute("href");
            modalApply.hidden = false;
          } else {
            modalApply.hidden = true;
            modalApply.removeAttribute("href");
          }
          modal.classList.add("is-open");
          modal.setAttribute("aria-hidden", "false");
          document.body.style.overflow = "hidden";
          closeBtn.focus();
        }

        function closeModal() {
          modal.classList.remove("is-open");
          modal.setAttribute("aria-hidden", "true");
          document.body.style.overflow = "";
          if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
        }

        rows.forEach((row) => {
          row.tabIndex = 0;
          row.setAttribute("role", "button");
          row.setAttribute("aria-label", "イベント詳細を開く");
          row.addEventListener("click", (e) => {
            if (e.target.closest(".ev-status--apply")) return;
            lastFocused = row;
            openModal(row);
          });
          row.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              lastFocused = row;
              openModal(row);
            }
          });
        });

        closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", (e) => {
          if (e.target === modal) closeModal();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
        });
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
