import { SCREENING_SLIDESHOW_INTERVAL_MS } from "./config.js";

let mxmScreeningHeroSlideTimer = null;

export function clearMxmScreeningHeroSlideTimer() {
  if (mxmScreeningHeroSlideTimer != null) {
    window.clearInterval(mxmScreeningHeroSlideTimer);
    mxmScreeningHeroSlideTimer = null;
  }
}

/** #screeningSlideshow（静的HTMLまたは CSV 差し替え後）のドット・自動送り */
export function initScreeningHeroSlideshow(root) {
  clearMxmScreeningHeroSlideTimer();
  if (!root) return;
  if (document.body.dataset.signage) return;

  const dotsHost = root.querySelector(".screening-slideshow-dots");
  if (!dotsHost) return;

  const getSlides = () => Array.from(root.querySelectorAll(".screening-slide"));
  const initialSlides = getSlides();
  if (!initialSlides.length) return;

  dotsHost.textContent = "";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;

  const setActive = (nextIndex) => {
    const slides = getSlides();
    if (!slides.length) return;
    const i = (nextIndex + slides.length) % slides.length;
    index = i;
    slides.forEach((s, j) => s.classList.toggle("is-active", j === i));
    dotsHost.querySelectorAll("button").forEach((d, j) => {
      d.classList.toggle("is-active", j === i);
    });
  };

  initialSlides.forEach((slideEl, j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "screening-dot";
    const link = slideEl.querySelector(".screening-slide-link");
    const panel = slideEl.querySelector(".mv-float-panel");
    const cap = slideEl.querySelector("figcaption");
    const labelSrc = link || panel || cap;
    b.setAttribute(
      "aria-label",
      labelSrc && labelSrc.textContent.trim() ? labelSrc.textContent.trim() : `スライド ${j + 1}`,
    );
    b.addEventListener("click", () => {
      setActive(j);
      clearMxmScreeningHeroSlideTimer();
      if (!reduced) {
        mxmScreeningHeroSlideTimer = window.setInterval(
          () => setActive(index + 1),
          SCREENING_SLIDESHOW_INTERVAL_MS,
        );
      }
    });
    dotsHost.appendChild(b);
  });

  setActive(0);

  if (!reduced) {
    mxmScreeningHeroSlideTimer = window.setInterval(
      () => setActive(index + 1),
      SCREENING_SLIDESHOW_INTERVAL_MS,
    );
  }
}
