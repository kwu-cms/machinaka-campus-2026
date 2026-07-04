/**
 * サイト設定の共通部分（CSV URL は DATA_MODE で切り替え）。
 * `config.js` は scripts/generate-config.mjs から生成する。
 */

/** Google スプレッドシート CSV エクスポート（テスト・編集用） */
export const SHEET_DATA_URLS = Object.freeze({
  moviesCsvUrl:
    "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=1499163471",
  eventsCsvUrl:
    "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=651546877",
  speakersCsvUrl:
    "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=1429540203",
  exhibitionsCsvUrl:
    "https://docs.google.com/spreadsheets/d/1hXldiXUl2klbJe6v7BraKEFCXL8cxd5WAjc0RRNzlPo/export?format=csv&gid=1913009152",
});

/** 同梱 CSV（本番・オフライン用。build:prod / main CI で sync 後に使用） */
export const LOCAL_DATA_URLS = Object.freeze({
  moviesCsvUrl: "./data/movies.csv",
  eventsCsvUrl: "./data/events.csv",
  speakersCsvUrl: "./data/speakers.csv",
  exhibitionsCsvUrl: "./data/exhibitions.csv",
});

export const DATA_URLS = Object.freeze({
  sheet: SHEET_DATA_URLS,
  local: LOCAL_DATA_URLS,
});

/**
 * @param {typeof SHEET_DATA_URLS} dataUrls
 */
export function createSiteConfig(dataUrls) {
  return Object.freeze({
    newsJsonUrl: "./data/news.json",
    moviesCsvUrl: dataUrls.moviesCsvUrl,
    eventsCsvUrl: dataUrls.eventsCsvUrl,
    speakersCsvUrl: dataUrls.speakersCsvUrl,
    exhibitionsCsvUrl: dataUrls.exhibitionsCsvUrl,
    /**
     * イベント ID → 登壇者 speaker_id の並び（上から順）。
     * 未指定のイベントは events CSV の「登壇者」列の氏名から推測。
     */
    eventSpeakerIds: Object.freeze({
      "evt-01": Object.freeze(["spk-001", "spk-002", "spk-003", "spk-004"]),
      "evt-02": Object.freeze(["spk-005", "spk-006"]),
      "evt-03": Object.freeze(["spk-007", "spk-008", "spk-009", "spk-010"]),
      "evt-04": Object.freeze(["spk-011", "spk-012", "spk-013"]),
      "evt-05": Object.freeze(["spk-007", "spk-006"]),
    }),
    eventFeaturedSpeakerIds: Object.freeze({
      "evt-01": Object.freeze(["spk-001"]),
      "evt-02": Object.freeze(["spk-005"]),
      "evt-03": Object.freeze(["spk-008", "spk-009", "spk-010"]),
      "evt-04": Object.freeze(["spk-011"]),
      "evt-05": Object.freeze([]),
    }),
    eventWideSubSpeakerIds: Object.freeze({
      "evt-01": Object.freeze(["spk-004"]),
    }),
    googleMapsApiKey: "AIzaSyDSfeNa_ftv6Orh--hQQOvZOVyRCuUvBqg",
  });
}

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

/** イベントカテゴリの画面上ラベル（カード・タイムライン等） */
export const EVENT_CATEGORY_LABELS = Object.freeze({
  lecture: "レクチャー",
  workshop: "ワークショップ",
  permanent: "常設",
});

export const DIALOG_PROGRAM_LABELS = Object.freeze({
  screening: PROGRAM_TIMELINE.screening.label.replace(/\s*\n\s*/g, ""),
  lecture: EVENT_CATEGORY_LABELS.lecture,
  workshop: EVENT_CATEGORY_LABELS.workshop,
  permanent: "常設企画",
});

/** @param {string} cat */
export function dialogProgramLabelMod(cat) {
  if (cat === "workshop") return "workshop";
  if (cat === "permanent") return "permanent";
  if (cat === "screening") return "screening";
  return "lecture";
}

/** @param {string} cat */
export function dialogProgramLabelText(cat) {
  const mod = dialogProgramLabelMod(cat);
  return DIALOG_PROGRAM_LABELS[mod] ?? DIALOG_PROGRAM_LABELS.lecture;
}

export const SCREENING_SLIDESHOW_INTERVAL_MS = 12000;
export const HERO_SPOTLIGHT_SLIDE_INTERVAL_MS = 5000;

export const TEST_PAGE_NOTICE = Object.freeze({
  ENABLED: true,
  VALID_UNTIL: "2026-05-31",
  STORAGE_KEY: "mxm2026_testPageNoticeDismissed_v1",
});

/** 展示作品 UI: simple（画像一覧のみ）/ full（カルーセル＋詳細モーダル）/ auto（日付で切替） */
export const EXHIBITION_UI = Object.freeze({
  mode: "auto",
  fullDetailFrom: "2026-07-04",
});

export const FEATURED_EVENT_IDS = Object.freeze(["evt-01", "evt-04"]);
export const FEATURED_PICKUP_CAROUSEL_INTERVAL_MS = SCREENING_SLIDESHOW_INTERVAL_MS;

/** 論理パス（拡張子は任意）。表示時に images/{stem}-{width}.webp/jpeg へ解決される */
export const FEATURED_IMAGE_BY_ID = Object.freeze({
  "evt-01": "./images/evt-01.png",
  "evt-04": "./images/evt-04.png",
});

export const FEATURED_IMAGE_FALLBACK = "./images/image_12.jpeg";
