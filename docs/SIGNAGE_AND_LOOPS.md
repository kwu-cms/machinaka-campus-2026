# サイネージ・ループ（自動送り）設定

会場ディスプレイ用の**縦型サイネージ**と、通常サイト上の**カルーセル／スライドショー／マーキー**の切替・周期の一覧です。  
実装の入口は [`js/main.js`](../js/main.js)（サイネージ判定・交互表示）、周期定数は [`js/config.shared.js`](../js/config.shared.js) がソースです（[`js/config.js`](../js/config.js) は `npm run config:local` 等で生成）。

---

## 設定値の早見表

| 名称 | 既定値 | 変更場所 | 用途 |
|------|--------|----------|------|
| `SCREENING_SLIDESHOW_INTERVAL_MS` | **12000**（12秒） | `config.shared.js` | 上映セクションのヒーロースライド（通常）・**サイネージ上映**の作品カルーセル |
| `FEATURED_PICKUP_CAROUSEL_INTERVAL_MS` | **12000**（同上） | `config.shared.js`（`SCREENING_SLIDESHOW_INTERVAL_MS` と同値） | イベント「注目プログラム」カルーセル（通常サイト `#ev-pickup`） |
| `HERO_SPOTLIGHT_SLIDE_INTERVAL_MS` | **5000**（5秒） | `config.shared.js` | ヒーロー右の上映スポットライト（6枚） |
| ヒーロー背景写真 | **7000**（7秒） | `main.js`（`setInterval` 直書き） | `.hero-bg` の2枚クロスフェード |
| ヒーロー背景テキスト | **10000**（10秒） | `main.js`（`CYCLE_MS`） | `.hero-field-words` の語順シャッフル／スクランブル |
| お知らせマーキー | **72秒**／1周 | [`css/nav-hero.css`](../css/nav-hero.css) `.hero-news-track` の `animation: heroMarquee` | ヒーロー下 NEWS 帯（901px 以上） |
| サイネージ `duration` | **60秒**／1画面 | URL クエリ（下記） | ポスター→上映→イベントの**画面全体**の切替 |
| `EXHIBITION_UI` | `mode: "auto"`, `fullDetailFrom: "2026-06-12"` | `config.shared.js` | 展示 UI（simple / full）。詳細は [`CONTENT.md`](./CONTENT.md) |

定数を変えたあとは `node scripts/generate-config.mjs local`（または `npm run config:local`）で `config.js` を再生成してください。

---

## サイネージ（縦型・1080×1920 想定）

### 有効化

[`js/main.js`](../js/main.js) 先頭の `initSignageMode()` が URL を解釈し、次を付与します。

- `html.is-signage`
- `body.is-signage-vertical`
- `body[data-signage="poster"|"screening"|"event"]`

**クエリを優先**し、なければハッシュを参照します。

| 指定 | ポスター | 上映 | イベント |
|------|----------|------|----------|
| クエリ | `?signage=poster` | `?signage=screening` | `?signage=event` |
| ハッシュ | `#signage-poster` | `#signage-screening` | `#signage-event` |

### 自動巡回（ポスター → 上映 → イベント）

キオスクで**ポスター・上映・イベントを一定時間ごとに順送り**する機能です。[`initSignageCycle()`](../js/main.js) が `location.replace` で遷移します（履歴が増えない）。

**巡回順（既定）:** ポスター → 上映 → イベント → ポスター → …

**キオスク用 URL（推奨）**

```text
?signage=cycle&duration=60
```

**その他の例**

```text
?signage=cycle&duration=60&view=screening
?signage=poster,screening,event&duration=90
?signage=screening,event&duration=90
?signage=screening&cycle=1&duration=60
```

| パラメータ | 意味 |
|------------|------|
| `signage=cycle` / `rotate` / `both` | **ポスター→上映→イベント**を順送り（`view=` で開始面を指定。省略時は **ポスター**） |
| `signage=poster,screening,event` | 上記と同じ3面巡回（カンマ区切りで順序を明示） |
| `signage=screening,event` | **上映⇄イベントのみ**（ポスターなし） |
| `signage=screening&cycle=1` | 上映から開始し、以降は上映⇄イベントのみ |
| `duration` | **1画面の表示秒数**。省略時 **60**。最小 **5**・最大 **3600** |
| `view` / `phase` | 巡回モードの**最初に表示する面**。`poster`（`cycle` 既定）・`screening`・`event` |

切替直前に [`js/signage-hero-state.js`](../js/signage-hero-state.js) が **sessionStorage**（キー `mxm-signage-hero-index`）へ、上映・イベント各ヒーローカルーセルの現在スライド番号を保存します。次回表示では `resolveSignageHeroStartIndex()` により続きのスライドから再開します（タブを閉じるとリセット）。

### サイネージで表示される／されないもの

| 項目 | 通常 | サイネージ |
|------|------|------------|
| ナビ・ヒーロー・お知らせ・開催概要・アクセス・フッター | 表示 | **非表示** |
| `#exhibition` 展示 | 表示 | **非表示**（`initExhibitionSection` スキップ） |
| `#news` | 表示 | **非表示** |
| プログラム | 展示・イベント・上映 | **`poster`・`screening`・`event` のいずれか1面** |
| パララックス・章ナビ・テストページ告知 | 有効 | **無効** |

**`signage=poster`**（`images/signage_poster.png` を 1080×1920 全画面表示。cycle の1面）

- [`js/main.js`](../js/main.js) の `initSignagePosterView()` が `main` 末尾に `.signage-poster-view` を挿入
- ヘッダー・フッター・プログラム欄は非表示（[`css/signage.css`](../css/signage.css) の `body[data-signage="poster"]`）

**`signage=screening`**（縦積み: ヘッダー〈日時・会場込み〉→ ビジュアル＋教員オーバーレイ → 2列作品リスト → フッター）

- [`js/signage-layout.js`](../js/signage-layout.js) … ヘッダーに日付・時間・会場を統合（黒い infobar なし）。フッター（`--sg-h-footer: 14.5vh`）は会場情報＋QR（キャプション「特設ウェブサイト」「学科Instagram」）
- ヒーロー高さは `--sg-hero-h` を **1.2 倍**（1080×1920 では 38.4vh 上限）。作品リストは `screening-body` の残り `1fr` で自動調整
- [`js/screening-movies.js`](../js/screening-movies.js) … 作品ビジュアルカルーセル（12秒）＋日別サムネリスト。教員文は [`index.html`](../index.html) の `.faculty-message` をクローンしてヒーロー上に表示
- 通常サイト用 `#screeningSlideshow` の自動送りは **起動しない**

**`signage=event`**（縦積み: ヘッダー → 注目カルーセル → 2列スケジュール → 常設／当日案内 → フッター）

- [`js/signage-layout.js`](../js/signage-layout.js) … 上記と同型のヘッダー・フッター。下段は常設＋当日案内（開催概要の長文は載せない）
- [`js/events.js`](../js/events.js) … `FEATURED_EVENT_IDS` と CSV「メイン」を注目カルーセル（12秒）。各カードは**大きなサムネ**＋**タイトル**＋**登壇者**＋**時間**＋カテゴリ色ラベル（説明文は出さない）。日別欄は 7/18・7/19 の予定を掲載。常設は `.signage-aside` へ
- 通常サイト用 `#ev-pickup` 注目カルーセルは **起動しない**（サイネージ用は `#ev-signage-featured` 内で別 init）

スタイル: [`css/signage.css`](../css/signage.css) の `body[data-signage]`（配色は `--brand-purple` / `--brand-blue` 等）。概要は [`CSS.md`](./CSS.md)。

---

## 通常サイトのループ・自動送り

### お知らせマーキー（NEWS）

| 項目 | 内容 |
|------|------|
| 表示 | **901px 以上**のヒーロー下帯のみ（900px 以下は非表示） |
| データ | [`data/news.json`](../data/news.json) |
| ループ | [`js/news.js`](../js/news.js) が `items` を **2回連結**して DOM に挿入。CSS `@keyframes heroMarquee` で `translateX(-50%)` により Seamless ループ |
| 速度 | [`css/nav-hero.css`](../css/nav-hero.css) … **`72s`**（以前 48s の **2/3 スピード**） |
| 操作 | クリックでお知らせモーダル（`#news-dialog`） |

### ヒーロー

| 要素 | 周期 | 実装 |
|------|------|------|
| 背景写真 `.hero-bg` | 7秒 | `main.js`（`image_1`〜`image_72` をシャッフルキュー） |
| 背景テキスト `.hero-field-words` | 10秒 | `main.js` `CYCLE_MS`（4モードの語順＋RandomText スクランブル） |
| 傾きアニメ | 各サイクル終盤 | `HERO_FIELD_ROT_*` 定数（`main.js` 内、680ms 等） |
| 上映スポットライト | 5秒 | `HERO_SPOTLIGHT_SLIDE_INTERVAL_MS` |

サイネージ時はヒーロー関連の init は **すべてスキップ**されます。

### 上映プログラム（`#screening`）

| 要素 | 周期 | 実装 |
|------|------|------|
| ヒーロースライド `#screeningSlideshow` | 12秒 | [`js/screening-slideshow.js`](../js/screening-slideshow.js) ← `SCREENING_SLIDESHOW_INTERVAL_MS` |
| 作品カード横スクロール | 手動 | ユーザー操作（自動送りなし） |
| 詳細モーダル内 Chevron | 手動 | `?movie_id=` 深リンク対応 |

CSV 読込後にスライド HTML を差し替える場合も、同じ `initScreeningHeroSlideshow()` でタイマーが付きます。

### イベント（`#event`）

| 要素 | 周期 | 実装 |
|------|------|------|
| 注目プログラム `#ev-pickup` | 12秒 | [`js/events.js`](../js/events.js) `initEvPickupCarousel()` ← `FEATURED_PICKUP_CAROUSEL_INTERVAL_MS` |
| 対象イベント ID | — | `FEATURED_EVENT_IDS`（既定 `evt-01`, `evt-04`） |
| 注目画像 | — | `FEATURED_IMAGE_BY_ID` / `FEATURED_IMAGE_FALLBACK` |

サイネージ `event` の注目ブロックは **静止表示**（カルーセルなし）です。

### 展示（`#exhibition`）

| モード | 挙動 |
|--------|------|
| **simple**（〜6/11、`EXHIBITION_UI` auto 時） | 3列画像グリッド。**自動ループなし** |
| **full**（6/12〜） | 横スクロールカルーセル。**自動送りなし**（前後ボタン・スワイプ）。クリックで詳細モーダル |

---

## `prefers-reduced-motion: reduce`

次は **自動 `setInterval` / CSS animation を止める**か、静止表示にフォールバックします。

- 上映・イベント・サイネージのスライドショー（各 `init*` 内の `reduced` 分岐）
- ヒーロー背景写真・スポットライト・フィールド語スクランブル
- お知らせマーキー（[`sections-movies-events-dialogs.css`](../css/sections-movies-events-dialogs.css) で `animation: none`）
- パララックス・scroll-driven（[`css/motion.css`](../css/motion.css)）

サイネージの **画面切替（`duration`）** は URL 遷移のため、OS の reduced-motion 設定では止まりません。止めたい場合は `signage=screening` または `signage=event` の**単独表示**にしてください。

---

## 変更手順（担当者向け）

1. **秒数・イベント ID など** … [`js/config.shared.js`](../js/config.shared.js) を編集 → `node scripts/generate-config.mjs local`
2. **マーキー速度** … [`css/nav-hero.css`](../css/nav-hero.css) の `.hero-news-track` の `animation` 秒数
3. **ヒーロー背景7秒・語10秒** … [`js/main.js`](../js/main.js) 内の該当 `setInterval` / `CYCLE_MS`
4. **サイネージの切替間隔** … キオスク URL の `duration=` を変更（コード変更不要）
5. **展示 simple/full** … `EXHIBITION_UI`（[`CONTENT.md`](./CONTENT.md) 参照）

ローカル確認:

```bash
npm run serve
# 通常: http://localhost:8080/
# サイネージ: http://localhost:8080/?signage=screening
# 巡回:       http://localhost:8080/?signage=cycle&duration=60
# ポスターのみ: http://localhost:8080/?signage=poster
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| [`js/main.js`](../js/main.js) | サイネージ判定・cycle・ヒーローループ |
| [`js/signage-hero-state.js`](../js/signage-hero-state.js) | 交互サイネージ時のスライド位置記憶 |
| [`js/screening-slideshow.js`](../js/screening-slideshow.js) | 通常サイト上映ヒーロースライド |
| [`js/screening-movies.js`](../js/screening-movies.js) | 上映一覧・サイネージ上映 UI |
| [`js/events.js`](../js/events.js) | イベント一覧・注目カルーセル・サイネージイベント UI |
| [`js/news.js`](../js/news.js) | お知らせマーキー・一覧 |
| [`js/exhibition.js`](../js/exhibition.js) | 展示 simple/full |
| [`js/signage-layout.js`](../js/signage-layout.js) | サイネージ共通 DOM（ヘッダー・情報バー・フッター） |
| [`css/signage.css`](../css/signage.css) | サイネージレイアウト・テーマ色 |
| [`css/nav-hero.css`](../css/nav-hero.css) | マーキー `@keyframes heroMarquee` |
