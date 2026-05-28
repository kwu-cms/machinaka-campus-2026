/**
 * ヒーロー多層パララックス + プログラム章ナビのアクティブ表示
 */

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initHeroParallax() {
  const hero = document.querySelector(".hero");
  if (!hero || prefersReducedMotion() || document.body.dataset.signage) return;

  const root = document.documentElement;
  const max = () => {
    const v = getComputedStyle(root).getPropertyValue("--hero-parallax-max").trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 36;
  };

  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = hero.getBoundingClientRect();
    const h = rect.height || 1;
    const progress = Math.min(1, Math.max(0, -rect.top / h));
    const cap = max();
    root.style.setProperty("--hero-parallax-bg", `${(progress * cap * 0.55).toFixed(2)}px`);
    root.style.setProperty("--hero-parallax-scrim", `${(progress * cap * 0.35).toFixed(2)}px`);
    root.style.setProperty("--hero-parallax-words", `${(progress * cap * 0.25).toFixed(2)}px`);
    root.style.setProperty("--hero-parallax-inner", `${(-progress * cap * 0.12).toFixed(2)}px`);
    root.style.setProperty(
      "--hero-parallax-spotlight",
      `${(-progress * cap * 0.08).toFixed(2)}px`,
    );
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

function initProgramChapterNav() {
  const nav = document.querySelector(".program-chapter-nav");
  if (!nav || document.body.dataset.signage) return;

  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links
    .map((a) => {
      const id = a.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      return el ? { link: a, el } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const setActive = (id) => {
    links.forEach((a) => {
      const match = a.getAttribute("href") === `#${id}`;
      a.classList.toggle("is-active", match);
      if (match) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  };

  const getScrollSpyOffset = () => {
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 76;
    const chapterNavH = nav.getBoundingClientRect().height || 0;
    return navH + chapterNavH + 12;
  };

  let ticking = false;

  const update = () => {
    ticking = false;
    const marker = window.scrollY + getScrollSpyOffset();
    let activeId = sections[0].el.id;

    for (const { el } of sections) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= marker) activeId = el.id;
    }

    setActive(activeId);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

export function initScrollChoreography() {
  if (document.body.dataset.signage) return;

  if (prefersReducedMotion()) {
    document.documentElement.classList.add("reduce-motion");
  } else {
    document.documentElement.classList.remove("reduce-motion");
  }

  initHeroParallax();
  initProgramChapterNav();
}
