/**
 * scripts/image-profiles.json と同期（ブラウザ用）
 */
export const IMAGE_PROFILES = {
  hero: {
    widths: [1920, 1280, 960],
    sizes: "100vw",
    defaultWidth: 1920,
    aspect: { width: 1920, height: 1080 },
  },
  event: {
    widths: [960, 640],
    sizes: "(max-width: 768px) 100vw, 960px",
    defaultWidth: 960,
    aspect: { width: 960, height: 540 },
  },
  screening: {
    widths: [960, 480],
    sizes: "(max-width: 480px) 120px, 240px",
    defaultWidth: 480,
    aspect: { width: 120, height: 68 },
  },
  guest: {
    widths: [480, 240],
    sizes: "(max-width: 480px) 50vw, 240px",
    defaultWidth: 240,
    aspect: { width: 240, height: 240 },
  },
  misc: {
    widths: [960, 640],
    sizes: "(max-width: 768px) 100vw, 960px",
    defaultWidth: 960,
    aspect: { width: 960, height: 540 },
  },
};
