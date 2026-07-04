# 掲載コンテンツの更新ガイド

サイト上の「ニュース・展示・イベント・上映・スケジュール・会場」などが、**どのファイル／データを直せば反映されるか**の一覧です。更新担当の方はまずこの表を参照してください。

---

## クイックリファレンス

| 画面での見え方 | 主な編集先 | コード側の参照 |
|----------------|------------|----------------|
| **お知らせ**（一覧・モーダル／ヒーロー下マーキー） | [`data/news.json`](../data/news.json) | [`js/config.js`](../js/config.js) の `newsJsonUrl` → [`js/news.js`](../js/news.js) |
| **イベント**（タイムテーブル・注目・詳細モーダル） | テスト: スプレッドシート／本番: [`data/events.csv`](../data/events.csv) | [`js/config.js`](../js/config.js) の `DATA_MODE` → [`js/events.js`](../js/events.js) |
| **展示作品**（カルーセル・詳細モーダル） | テスト: スプレッドシート／本番: [`data/exhibitions.csv`](../data/exhibitions.csv) | `exhibitionsCsvUrl` → [`js/exhibition.js`](../js/exhibition.js) |
| **上映作品**（カード・モーダル・サイネージ） | テスト: スプレッドシート／本番: [`data/movies.csv`](../data/movies.csv) | [`js/config.js`](../js/config.js) → [`js/screening-movies.js`](../js/screening-movies.js) |
| **登壇者** | テスト: スプレッドシート／本番: [`data/speakers.csv`](../data/speakers.csv) | `speakersCsvUrl` → [`js/speaker-blocks.js`](../js/speaker-blocks.js) |
| **開催概要のスケジュール帯**（展示・上映の帯／時刻） | [`js/config.js`](../js/config.js) の `PROGRAM_TIMELINE` | [`js/timeline-ui.js`](../js/timeline-ui.js) |
| **ヒーロー・ナビ・展示の説明・上映の静的スライド・会場テキスト・OGP 等** | [`index.html`](../index.html) | 画像は [`images-src/`](../images-src/) → [`npm run optimize:images`](../package.json) → [`images/`](../images/) |
| **テストページ注意ダイアログ** | [`index.html`](../index.html) 内の dialog 本文 ＋ [`js/config.js`](../js/config.js) の `TEST_PAGE_NOTICE` | [`js/main.js`](../js/main.js) |
| **地図（Google Maps）** | [`index.html`](../index.html) の `#gmap`（`data-map-id`）＋ API キー | [`js/config.js`](../js/config.js) の `googleMapsApiKey`、[`js/main.js`](../js/main.js) |

---

## データ源（`DATA_MODE`）

実行時にどこから CSV を読むかは [`js/config.js`](../js/config.js) の **`DATA_MODE`** で決まります（`scripts/generate-config.mjs` で生成）。

| モード | 用途 | イベント・上映・登壇者・展示 |
|--------|------|------------------------------|
| **`sheet`** | テスト（Heteml・`develop`・日常編集） | Google スプレッドシートの CSV エクスポート URL（[`js/config.shared.js`](../js/config.shared.js) の `SHEET_DATA_URLS`） |
| **`local`** | 本番（GitHub Pages `main`） | 同梱の [`data/*.csv`](../data/) |

- URL の既定値・本番用パス: [`js/config.shared.js`](../js/config.shared.js)
- 設定の編集: [`js/config.shared.js`](../js/config.shared.js)（Node・ビルド用）
- ブラウザが読む [`js/config.js`](../js/config.js): `npm run config:sheet` / `npm run config:local` で生成（**`config.shared.js` は import しない単体ファイル**）
- シート → `data/` への書き出し: `npm run sync:data`

---

## ページ内アンカーと HTML の対応

| アンカー | 内容の概要 |
|----------|------------|
| `#news` | お知らせ（`news.json`） |
| `#about` | 開催概要（本文・会期 DL・**スケジュール** `#schedule`） |
| `#program` | プログラム見出しの下に `#exhibition` `#event` `#screening` |
| `#exhibition` | 展示（CSV からカルーセル描画） |
| `#event` | イベント（CSV から描画） |
| `#screening` | 上映（CSV ＋一部静的） |
| `#access` | 会場アクセス |

---

## お知らせ（`data/news.json`）

- **形式**: トップレベル `items` 配列。各要素は例として次のキーが使われます。
  - `date` … ソート用（`YYYY-MM-DD`）
  - `dateDisplay` … 画面上の日付表示（省略可。無い場合は `date` から生成）
  - `text` … 本文（プレーンテキスト。`https://` URL と `@handle` は自動リンク化）
  - `text` 内の **`<a href="...">`** … 相対パス（`./data/...` など）または `http(s)://` のみ許可。一覧・モーダルではリンクとして表示。マーキーはタグを除いた文字のみ
- **取得先変更**: [`js/config.js`](../js/config.js) の `SITE_CONFIG.newsJsonUrl`（既定は `./data/news.json`）。
- **表示**: **901px 以上**はヒーロー下マーキーのみ（`#news` セクションは非表示）。ナビの「お知らせ」で一覧モーダル（`#news-dialog`）を開く。**900px 以下**はマーキー非表示・`#news` セクションを表示し、ナビからは同セクションへスクロール。

---

## 画像の最適化（`images-src` → `images/`）

| 種類 | 置き場所 |
|------|----------|
| **ラスター原稿**（写真・サムネ PNG/JPEG） | [`images-src/`](../images-src/) |
| **公開用**（WebP + JPEG・複数幅） | [`images/`](../images/)（`npm run optimize:images` で自動生成） |
| **SVG アイコン・テクスチャ** | [`images/`](../images/) に直接配置（最適化スクリプト対象外） |

### 手順

1. 原稿を `images-src/` に追加（サブフォルダ可。例: `images-src/screening-slides/screening_1.png`）。
2. リポジトリ直下で `npm run optimize:images` を実行。
3. 生成された `images/` 内の `{stem}-{幅}.webp` / `.jpeg` を **Git に commit** する（Pages・Heteml はこのフォルダをそのまま配信）。

### 論理ファイル名（CSV・config）

イベント CSV の `画像ファイル名` や [`js/config.shared.js`](../js/config.shared.js) の `FEATURED_IMAGE_BY_ID` では、従来どおり **`evt-01.png` や `images/image_14.jpeg` のような論理パス** を書きます。表示時は拡張子を除いた名前（stem）から、例として `evt-01-960.webp` などを自動で選びます。**CSV の一括変更は不要**です。

### プロファイル（生成される幅の目安）

| プロファイル | 原稿の例 | 生成幅（長辺） |
|--------------|----------|----------------|
| `hero` | `image_1.jpeg` … `image_72.jpeg` | 1920, 1280, 960 |
| `event` | `evt-01.png` など | 960, 640 |
| `screening` | `screening-slides/screening_1.png` | 960, 480 |
| `guest` | `guest_evt-03-1.jpg` | 480, 240 |
| `misc` | その他（`irodori_photo.jpeg` など） | 960, 640 |

設定の詳細は [`scripts/image-profiles.json`](../scripts/image-profiles.json)。ブラウザ向けは [`js/image-profiles.js`](../js/image-profiles.js) と [`js/lib/responsive-image.js`](../js/lib/responsive-image.js)。

### OGP（SNS プレビュー）

[`index.html`](../index.html) の `og:image` / `twitter:image` は **1200×630** の `images/ogp-1200.jpeg` を指定しています。原稿は [`images-src/image_ogp.png`](../images-src/image_ogp.png)。差し替え後は [`npm run generate:ogp`](../package.json) で `images/ogp-1200.{jpeg,webp}` を再生成してください。`<picture>` は SNS クローラー非対応のため、OGP パスだけは固定 JPEG です。

---

## イベント（スプレッドシート / `data/events.csv`）

[`js/events.js`](../js/events.js) が **1行目のヘッダ名** で列を読みます。列名を変えると表示が壊れるので、スプレッドシート側では列名を維持してください。

| 列名（ヘッダ） | 用途 |
|----------------|------|
| `ID` | `evt-01` 形式。HTML の `id`・URL `?event_id=`・未指定時のサムネ既定 `./images/{id}.png`（stem 解決）に使用 |
| `カテゴリ` | `lecture` / `workshop` / `permanent` など（小文字化して解釈） |
| `イベント名` | タイトル |
| `担当分野` | 分野ラベル |
| `日付1行目` | 例: `7/18（土）`（曜日の有無で土日判定） |
| `時間2行目` | 時間帯表示 |
| `会場` | 空のとき、詳細モーダルでは [`js/events.js`](../js/events.js) の `DEFAULT_EVENT_MODAL_VENUE` が使われます |
| `タグ` | カンマ区切り |
| `説明（200文字程度）` | 詳細文（列名はコード内 `DESC_KEY` と一致必須） |
| `画像` | `TRUE` のとき `画像ファイル名` をサムネに使用（`FALSE` ならファイル名は無視） |
| `画像ファイル名` | 論理パス（例: `evt-03-2.jpeg` または `images/evt-03-2.jpeg`）。空なら `FEATURED_IMAGE_BY_ID` または `./images/{ID}.png`。表示は最適化済み `{stem}-{幅}.webp/jpeg` |
| `申込要否` / `申込URL` | 申込ボタン表示 |
| `表示順` | 並び |
| `メイン` | 列があるときのみ: `TRUE` で注目ヒーロー候補（列が無いときは `config.js` の `FEATURED_EVENT_IDS`） |
| `登壇者` | 登壇者行（時間列との入れ替え救済ロジックあり） |

**注目画像の既定**: [`js/config.js`](../js/config.js) の `FEATURED_IMAGE_BY_ID` / `FEATURED_IMAGE_FALLBACK`。

---

## 展示（スプレッドシート / `data/exhibitions.csv`）

シート **2-1_展示作品**（gid=`1913009152`）を [`js/exhibition.js`](../js/exhibition.js) が読み込みます。

### 表示モード（`EXHIBITION_UI`）

[`js/config.shared.js`](../js/config.shared.js) の `EXHIBITION_UI` で切り替えます（`npm run build:config` または `node scripts/generate-config.mjs local` で [`js/config.js`](../js/config.js) に反映）。

| `mode` | 動作 |
|--------|------|
| `auto`（既定） | `fullDetailFrom`（既定 `2026-07-04`）未満は **シンプル**、以降は **フル** |
| `simple` | **3列の画像のみ**（`タイトル` が入っている行かつ画像あり。詳細モーダル・カルーセル操作なし） |
| `full` | 横スクロールカルーセル＋詳細モーダル |

- **シンプル時**は作品名・作者は表示せず、`画像ファイル名` がある行のみグリッドに載せます（詳細モーダル・深リンクは `?exhibition_id=` 経由で全作品に対応）。
- **フル時**はカルーセルに **画像ありの作品のみ** 掲載。カルーセルから開いたモーダルの前後ナビも **画像あり作品のみ**。
- **`?exhibition_id=`（QR）** 経由では **全 `exhi-N` 作品** を表示し、モーダルの前後ナビも全作品を巡回。
- ハンドアウト QR 検証など事前確認は `mode: "full"` に変更するか、`fullDetailFrom` を前倒ししてください。

### ハンドアウト QR 用深リンク

会場配布の QR コードは、各作品の URL パラメータ `exhibition_id` で詳細モーダルを開きます（**フル表示モード時**）。

```
https://{本番ドメイン}/?exhibition_id=exhi-1
https://{本番ドメイン}/?exhibition_id=exhi-2
…（`exhi-20` まで）
```

| 列名（ヘッダ） | 用途 |
|----------------|------|
| `ID` | `exhi-1` 形式。URL `?exhibition_id=` に使用 |
| `タイトル` | 作品名（空のときは `領域` をカード見出しに使用） |
| `作者` | 作者名 |
| `領域` | 学科領域（タイトルが空の行では見出しになる） |
| `作者区分` | 例: 卒業生（作者が空のときカード副題に使用） |
| `制作年` | 制作年度 |
| `メディア種別` | ゲーム・本 など |
| `展示方法` | 例: パネル＋パネルスタンド、中央で平置き（モーダルタグに表示） |
| `作品説明` | 詳細モーダル本文 |
| `展示日` | 例: 両日（モーダルタグに表示） |
| `画像ファイル名` | 例: `image_9.jpeg`（`images/` 配下の論理パス） |
| `関連URL（任意）` | 詳細モーダルに外部リンク |
| `備考` | モーダル本文末尾（控えめ表示） |

- `ID` が `exhi-` で始まらない行（記入メモなど）は無視されます。
- 画像は [`images-src/`](../images-src/) に原稿を置き `npm run optimize:images` で生成してください。

### データ同期・固定化

```bash
npm run sync:data          # スプレッドシート → data/exhibitions.csv
npm run export:exhibitions # CSV → data/exhibitions.json
npm run build:prod         # 本番用 _site/ 組み立て（local CSV 同梱）
```

本番反映前に `data/exhibitions.csv`（および任意で `data/exhibitions.json`）を Git にコミットして内容を固定してください。

---

## 上映（スプレッドシート / `data/movies.csv`）

[`js/screening-movies.js`](../js/screening-movies.js) が列を読み替えます。代表的な列:

| 列名 | 用途 |
|------|------|
| `ID` | `scr-1` など |
| `タイトル` / `監督` / `上映時間` / `制作年度` / `作品説明` / `画像` | 表示・カード・モーダル |

**上映日**などシートによって列が増える場合は、実装のマッピングに合わせてください（詳細は `screening-movies.js` 内の行オブジェクト生成部分）。

---

## `PROGRAM_TIMELINE`（スケジュール帯・上映見出しメタ）

[`js/config.js`](../js/config.js) の `PROGRAM_TIMELINE` は次で共有されます。

- 開催概要の横タイムライン: [`js/timeline-ui.js`](../js/timeline-ui.js)（展示・上映スロットのラベル・時刻）
- 上映セクションの日別見出しの時刻など: [`js/screening-movies.js`](../js/screening-movies.js)（`PROGRAM_TIMELINE.screening`）

**二重管理に注意**: 作品詳細モーダルの上映枠文言には、[`js/screening-movies.js`](../js/screening-movies.js) 内の **`MV_DIALOG_SLOT_RANGE` / `MV_DIALOG_VENUE`** という定数があります。上映時間や会場を変えたときは **`PROGRAM_TIMELINE.screening` とこちらの両方** を揃えてください（将来まとめる余地あり）。

---

## 壊れやすいポイント

1. **スプレッドシートのエクスポート URL**  
   [`js/config.shared.js`](../js/config.shared.js) の `SHEET_DATA_URLS`（または `.env` の `SHEET_*_URL`）は **Google スプレッドシートの `gid=`** を含みます。シートを複製したり gid が変わったら **URL を差し替え**ないと古いシートを読みます。本番（`DATA_MODE=local`）ではブラウザはこれらの URL を使いません。

2. **イベント CSV の列名**  
   特に **`説明（200文字程度）`** はコードと完全一致が必要です。

3. **イベント ID と画像**  
   時間列の背景は [`js/events.js`](../js/events.js) が `image-set()` で WebP/JPEG を指定します。原稿を変えたら `images-src/` を更新し `npm run optimize:images` を再実行してください。

4. **SEO メタ（`canonical` / `robots` / JSON-LD）**  
   [`index.html`](../index.html) は `__SITE_ORIGIN__` プレースホルダを使います。`scripts/assemble-site.sh` が本番ビルド時に置換するため、置換対象の綴りを崩さないでください。

---

## 静的文言の「正」（会期・会場など／ズレ防止用）

同じ事実が **複数箇所** に書かれているため、変更時は次をまとめて確認することを推奨します。

| 内容 | 主な記載箇所（[`index.html`](../index.html) 内の目安） |
|------|--------------------------------------------------------|
| 会期・開催日の一文 | ヒーロー `.hero-date`、`<meta name="description">` / OGP / Twitter |
| 会場の住所・階 | 開催概要 `dl.facts`、各プログラム `header .program-venue`、上映導入 `.screening-intro`、`#access` の会場カード |
| 上映時間帯（文言） | ヒーロー付近、上映 `.screening-intro`、**`PROGRAM_TIMELINE.screening`**、**`MV_DIALOG_*`**（上記） |

開催概要スケジュール帯の「展示」「上映」の**時刻・会場名**は `PROGRAM_TIMELINE` がソースです（本文の段落だけ直しても帯は変わりません）。

---

## ローカル検証

| 目的 | コマンド |
|------|----------|
| シートを編集しながら確認（テストと同じ） | `npm run config:sheet` → `npm run serve` |
| 同梱 CSV のみで確認（本番と同じ） | `npm run sync:data` → `npm run config:local` → `npm run serve` |
| `_site/` を組み立てるだけ | `npm run build:test` または `npm run build:prod` |

`file://` 直開きでは `fetch` がブロックされることがあるため、必ず HTTP サーバー（`npm run serve`）で開いてください。

---

## その他のドキュメント

- デプロイ手順: [`README.md`](../README.md)  
- **CSS のファイル分割・ブレークポイント**: [`CSS.md`](./CSS.md)  
- 学科内向けチェックリスト（草案）: [`_draft/本番化_情報確定_学科内依頼.md`](../_draft/本番化_情報確定_学科内依頼.md)  
- カラー・トークン: [`STYLEGUIDE.md`](./STYLEGUIDE.md)
