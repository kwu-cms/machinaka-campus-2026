/** fetch 先・外部 API。公開リポジトリでは Maps キーのリファラー制限を別途確認してください。 */
export const SITE_CONFIG = Object.freeze({
  newsJsonUrl: "./data/news.json",
  moviesCsvUrl:
    "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=1499163471",
  eventsCsvUrl:
    "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=651546877",
  googleMapsApiKey: "AIzaSyDSfeNa_ftv6Orh--hQQOvZOVyRCuUvBqg",
});

/**
 * プログラム横タイムライン・上映リスト見出しの共通メタ。
 */
export const PROGRAM_TIMELINE = Object.freeze({
  axisStartMin: 9 * 60,
  axisEndMin: 20 * 60,
  screening: {
    label: "卒業制作選抜展\n「南女シネマ」",
    timeDisplay: "17:00～19:10",
    start: "17:00",
    end: "19:10",
    venue: "元町映画館",
  },
  exhibition: {
    label: "作品展示",
    start: "10:00",
    end: "18:00",
    venue: "こうべまちづくり会館 2F ホール、3F多目的室",
  },
});

export const SCREENING_SLIDESHOW_INTERVAL_MS = 12000;

/** ヒーロー右下フロートの映像サムネイル切り替え間隔 */
export const HERO_SPOTLIGHT_SLIDE_INTERVAL_MS = 5000;

export const TEST_PAGE_NOTICE = Object.freeze({
  ENABLED: true,
  VALID_UNTIL: "2026-05-31",
  STORAGE_KEY: "mxm2026_testPageNoticeDismissed_v1",
});

/**
 * イベント CSV に「メイン」列がないときの注目（ピックアップ）候補 ID。
 * 列がある場合は CSV の TRUE/FALSE が優先される。
 */
export const FEATURED_EVENT_IDS = Object.freeze(["evt-01", "evt-04"]);

/** 注目ヒーローカルーセルの自動送り（ms）。上映スライドショーと同じ間隔。prefers-reduced-motion では使わない */
export const FEATURED_PICKUP_CAROUSEL_INTERVAL_MS = SCREENING_SLIDESHOW_INTERVAL_MS;

/**
 * 注目イベントのビジュアル（イベント ID → 画像パス）。
 * CSV に「サムネURL」列があり値がある場合はそちらが優先される。
 */
export const FEATURED_IMAGE_BY_ID = Object.freeze({
  "evt-01": "./images/evt-01.png",
  "evt-04": "./images/evt-04.png",
});

export const FEATURED_IMAGE_FALLBACK = "./images/image_12.jpeg";
