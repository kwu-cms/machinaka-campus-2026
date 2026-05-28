import { IMAGE_PROFILES } from "../image-profiles.js";
import { escapeHtml } from "./html.js";

const IMAGES_PREFIX = "./images/";

/**
 * 論理パス（./images/evt-01.png 等）→ images 配下の stem（拡張子なし・サブパス可）
 * @param {string} logicalPath
 * @returns {string}
 */
export function resolveImageStem(logicalPath) {
  const t = String(logicalPath || "").trim();
  if (!t || /^https?:\/\//i.test(t)) return "";
  let p = t.replace(/^\.\//, "").replace(/^images\//, "");
  return p.replace(/\.[^/.]+$/, "");
}

/**
 * @param {string} stem
 * @param {number} width
 * @param {"webp"|"jpeg"} format
 * @param {{ cssRelative?: boolean }} [opts]
 */
export function variantUrl(stem, width, format, opts = {}) {
  if (!stem) return "";
  const ext = format === "webp" ? "webp" : "jpeg";
  const prefix = opts.cssRelative ? "../images/" : IMAGES_PREFIX;
  return `${prefix}${stem}-${width}.${ext}`;
}

/** @param {string} name */
export function getProfile(name) {
  return IMAGE_PROFILES[name] || IMAGE_PROFILES.misc;
}

/**
 * @param {string} stem
 * @param {number[]} widths
 * @param {"webp"|"jpeg"} format
 * @param {{ cssRelative?: boolean }} [opts]
 */
function buildSrcset(stem, widths, format, opts = {}) {
  return widths.map((w) => `${variantUrl(stem, w, format, opts)} ${w}w`).join(", ");
}

/**
 * @param {string} stem
 * @param {string} profileName
 */
export function inferProfileFromStem(stem) {
  const base = stem.split("/").pop() || stem;
  if (/^image_\d+$/i.test(base)) return "hero";
  if (/^evt-/i.test(base)) return "event";
  if (stem.includes("screening-slides/")) return "screening";
  if (/^guest_/i.test(base) || /^irodori_/i.test(base)) return "guest";
  return "misc";
}

/**
 * @param {string} logicalPath
 * @param {object} [opts]
 */
export function pictureHTMLFromPath(logicalPath, opts = {}) {
  const stem = resolveImageStem(logicalPath);
  if (!stem) return "";
  const profile = opts.profile || inferProfileFromStem(stem);
  return pictureHTML(stem, profile, opts);
}

/**
 * @param {string} stem
 * @param {string} profileName
 * @param {object} [opts]
 */
export function pictureHTML(stem, profileName, opts = {}) {
  const profile = getProfile(profileName);
  const { widths, sizes, defaultWidth, aspect } = profile;
  const dw = defaultWidth || widths[0];
  const alt = escapeHtml(opts.alt ?? "");
  const cls = opts.class ? ` class="${escapeHtml(opts.class)}"` : "";
  const loading = opts.loading ? ` loading="${opts.loading}"` : "";
  const decoding = opts.decoding ?? "async";
  const fetchpriority = opts.fetchpriority ? ` fetchpriority="${opts.fetchpriority}"` : "";
  const w = opts.width ?? aspect?.width ?? dw;
  const h = opts.height ?? aspect?.height ?? Math.round((w * 9) / 16);

  const webpSrcset = escapeHtml(buildSrcset(stem, widths, "webp"));
  const jpegSrcset = escapeHtml(buildSrcset(stem, widths, "jpeg"));
  const fallback = escapeHtml(variantUrl(stem, dw, "jpeg"));
  const sizesAttr = escapeHtml(opts.sizes ?? sizes);

  return `<picture>
  <source type="image/webp" srcset="${webpSrcset}" sizes="${sizesAttr}" />
  <img src="${fallback}" srcset="${jpegSrcset}" sizes="${sizesAttr}" alt="${alt}" width="${w}" height="${h}" decoding="${decoding}"${cls}${loading}${fetchpriority} />
</picture>`;
}

/**
 * CSS background-image 用 image-set()
 * @param {string} stem
 * @param {string} profileName
 * @param {{ cssRelative?: boolean, width?: number }} [opts]
 */
export function cssBackgroundImageSet(stem, profileName, opts = {}) {
  const profile = getProfile(profileName);
  const w = opts.width ?? profile.widths[profile.widths.length - 1];
  const rel = opts.cssRelative ?? false;
  const webp = variantUrl(stem, w, "webp", { cssRelative: rel });
  const jpeg = variantUrl(stem, w, "jpeg", { cssRelative: rel });
  const esc = (u) =>
    String(u)
      .replace(/\\/g, "/")
      .replace(/'/g, "%27");
  return `image-set(url('${esc(webp)}') type('image/webp'), url('${esc(jpeg)}') type('image/jpeg'))`;
}

/**
 * @param {HTMLImageElement} img
 * @param {string} stem
 * @param {string} profileName
 */
export function applyResponsiveImageToImg(img, stem, profileName) {
  if (!img || !stem) return;
  const profile = getProfile(profileName);
  const { widths, sizes, defaultWidth } = profile;
  const dw = defaultWidth || widths[0];

  let picture = img.closest("picture");
  if (!picture) {
    picture = document.createElement("picture");
    const source = document.createElement("source");
    source.type = "image/webp";
    img.replaceWith(picture);
    picture.append(source, img);
  }

  const source = picture.querySelector('source[type="image/webp"]');
  if (source) {
    source.srcset = buildSrcset(stem, widths, "webp");
    source.sizes = sizes;
  }
  img.src = variantUrl(stem, dw, "jpeg");
  img.srcset = buildSrcset(stem, widths, "jpeg");
  img.sizes = sizes;
}

/**
 * スライド要素内の picture / img を差し替え
 * @param {HTMLElement} container
 * @param {string} stem
 * @param {string} profileName
 * @param {object} [opts]
 */
export function setResponsivePicture(container, stem, profileName, opts = {}) {
  if (!container || !stem) return;
  const html = pictureHTML(stem, profileName, opts);
  container.innerHTML = html;
}
