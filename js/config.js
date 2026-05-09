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
    timeDisplay: "17:10～19:00",
    start: "17:10",
    end: "19:00",
    venue: "元町映画館",
  },
  exhibition: {
    label: "展示",
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
