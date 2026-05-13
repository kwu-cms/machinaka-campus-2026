# 掲載コンテンツの更新ガイド

サイト上の「ニュース・展示・イベント・上映・スケジュール・会場」などが、**どのファイル／データを直せば反映されるか**の一覧です。更新担当の方はまずこの表を参照してください。

---

## クイックリファレンス

| 画面での見え方 | 主な編集先 | コード側の参照 |
|----------------|------------|----------------|
| **お知らせ**（一覧＋901px未満で見えるブロック）／ヒーロー下マーキー | [`data/news.json`](../data/news.json) | [`js/config.js`](../js/config.js) の `SITE_CONFIG.newsJsonUrl` → [`js/main.js`](../js/main.js) |
| **イベント**（タイムテーブル・注目・詳細モーダル） | Google スプレッドシート（`eventsCsvUrl`）※列名は下表 | [`js/config.js`](../js/config.js) → [`js/events.js`](../js/events.js) |
| **上映作品**（カード・モーダル・サイネージ） | Google スプレッドシート（`moviesCsvUrl`） | [`js/config.js`](../js/config.js) → [`js/screening-movies.js`](../js/screening-movies.js) |
| **開催概要のスケジュール帯**（展示・上映の帯／時刻） | [`js/config.js`](../js/config.js) の `PROGRAM_TIMELINE` | [`js/timeline-ui.js`](../js/timeline-ui.js) |
| **ヒーロー・ナビ・展示の説明・上映の静的スライド・会場テキスト・OGP 等** | [`index.html`](../index.html) | 画像は [`images/`](../images/) |
| **テストページ注意ダイアログ** | [`index.html`](../index.html) 内の dialog 本文 ＋ [`js/config.js`](../js/config.js) の `TEST_PAGE_NOTICE` | [`js/main.js`](../js/main.js) |
| **地図（Google Maps）** | [`index.html`](../index.html) の `#gmap`（`data-map-id`）＋ API キー | [`js/config.js`](../js/config.js) の `googleMapsApiKey`、[`js/main.js`](../js/main.js) |

バックアップ用の CSV 例: [`data/events.csv`](../data/events.csv)、[`data/movies.csv`](../data/movies.csv)（本番 URL は `config.js` が指すスプレッドシートが優先されます）。

---

## ページ内アンカーと HTML の対応

| アンカー | 内容の概要 |
|----------|------------|
| `#news` | お知らせ（`news.json`） |
| `#about` | 開催概要（本文・会期 DL・**スケジュール** `#schedule`） |
| `#program` | プログラム見出しの下に `#exhibition` `#event` `#screening` |
| `#exhibition` | 展示（静的コピー＋カルーセル画像） |
| `#event` | イベント（CSV から描画） |
| `#screening` | 上映（CSV ＋一部静的） |
| `#access` | 会場アクセス |

---

## お知らせ（`data/news.json`）

- **形式**: トップレベル `items` 配列。各要素は例として次のキーが使われます。
  - `date` … ソート用（`YYYY-MM-DD`）
  - `dateDisplay` … 画面上の日付表示（省略可。無い場合は `date` から生成）
  - `text` … 本文
- **取得先変更**: [`js/config.js`](../js/config.js) の `SITE_CONFIG.newsJsonUrl`（既定は `./data/news.json`）。

---

## イベント（スプレッドシート / `data/events.csv`）

[`js/events.js`](../js/events.js) が **1行目のヘッダ名** で列を読みます。列名を変えると表示が壊れるので、スプレッドシート側では列名を維持してください。

| 列名（ヘッダ） | 用途 |
|----------------|------|
| `ID` | `evt-01` 形式。HTML の `id`・URL `?event_id=`・画像 `./images/{id}.png`（時間列ビジュアル）に使用 |
| `カテゴリ` | `lecture` / `workshop` / `permanent` など（小文字化して解釈） |
| `イベント名` | タイトル |
| `担当分野` | 分野ラベル |
| `日付1行目` | 例: `7/18（土）`（曜日の有無で土日判定） |
| `時間2行目` | 時間帯表示 |
| `会場` | 空のとき、詳細モーダルでは [`js/events.js`](../js/events.js) の `DEFAULT_EVENT_MODAL_VENUE` が使われます |
| `タグ` | カンマ区切り |
| `説明（200文字程度）` | 詳細文（列名はコード内 `DESC_KEY` と一致必須） |
| `サムネURL` | 任意。空なら `FEATURED_IMAGE_BY_ID` または `./images/{ID}.png` など |
| `申込要否` / `申込URL` | 申込ボタン表示 |
| `表示順` | 並び |
| `メイン` | 列があるときのみ: `TRUE` で注目ヒーロー候補（列が無いときは `config.js` の `FEATURED_EVENT_IDS`） |
| `登壇者` | 登壇者行（時間列との入れ替え救済ロジックあり） |

**注目画像の既定**: [`js/config.js`](../js/config.js) の `FEATURED_IMAGE_BY_ID` / `FEATURED_IMAGE_FALLBACK`。

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
   [`js/config.js`](../js/config.js) の `moviesCsvUrl` / `eventsCsvUrl` は **Google スプレッドシートの `gid=`** を含みます。シートを複製したり gid が変わったら、**URL を差し替え**ないと古いシートを読みます。

2. **イベント CSV の列名**  
   特に **`説明（200文字程度）`** はコードと完全一致が必要です。

3. **イベント ID と画像**  
   時間列の背景は CSS で `../images/{evt-xx}.png` を参照します。ファイル名を変える場合は [`js/events.js`](../js/events.js) と CSS の規則を確認してください。

4. **本番の `noindex`**  
   [`index.html`](../index.html) の `<meta name="robots">` は公開切替時に忘れず確認してください。

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

## ローカル検証（スプレッドシートを使わない）

1. [`data/events.csv`](../data/events.csv) または [`data/movies.csv`](../data/movies.csv) を編集する。  
2. 一時的に [`js/config.js`](../js/config.js) で  
   `eventsCsvUrl: "./data/events.csv"`  
   `moviesCsvUrl: "./data/movies.csv"`  
   のように **相対パスへ差し替え**（検証後に本番 URL に戻す）。  
3. ローカルサーバーで開く（`README.md` の `python3 -m http.server` など）。`file://` 直開きでは fetch がブロックされることがあります。

---

## その他のドキュメント

- デプロイ手順: [`README.md`](../README.md)  
- **CSS のファイル分割・ブレークポイント**: [`CSS.md`](./CSS.md)  
- 学科内向けチェックリスト（草案）: [`_draft/本番化_情報確定_学科内依頼.md`](../_draft/本番化_情報確定_学科内依頼.md)  
- カラー・トークン: [`STYLEGUIDE.md`](./STYLEGUIDE.md)
