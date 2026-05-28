/**
 * 生成元テンプレート。直接 import しないでください。
 * `node scripts/generate-config.mjs sheet|local` → js/config.js
 */
import { createSiteConfig, DATA_URLS } from "./config.shared.js";

/** @type {"sheet"|"local"} */
export const DATA_MODE = "__DATA_MODE__";

export const SITE_CONFIG = createSiteConfig(DATA_URLS[DATA_MODE]);

export {
  SHEET_DATA_URLS,
  LOCAL_DATA_URLS,
  DATA_URLS,
  createSiteConfig,
  PROGRAM_TIMELINE,
  EVENT_CATEGORY_LABELS,
  DIALOG_PROGRAM_LABELS,
  dialogProgramLabelMod,
  dialogProgramLabelText,
  SCREENING_SLIDESHOW_INTERVAL_MS,
  HERO_SPOTLIGHT_SLIDE_INTERVAL_MS,
  TEST_PAGE_NOTICE,
  FEATURED_EVENT_IDS,
  FEATURED_PICKUP_CAROUSEL_INTERVAL_MS,
  FEATURED_IMAGE_BY_ID,
  FEATURED_IMAGE_FALLBACK,
} from "./config.shared.js";
