# まちなかキャンパス 2026（学科学外イベント）

本リポジトリは、イベント情報などを掲載する**静的 Web サイト**のソースです。

## 公開について

- **2026年6月6日まで**、本サイトは**テスト運用**です。文言・画像・リンク・公開 URL は、確定にあわせて変更される場合があります。
- 本番 URL の例: `https://（組織またはユーザー名）.github.io/（リポジトリ名）/`（実際の URL は公開設定に従います）

## サイトの構成（参考）

入口はリポジトリ直下の [`index.html`](index.html) です。スタイル・スクリプト・データは `css/`・`js/`・`data/`、**画像原稿**は `images-src/`、**公開用画像**は `images/` にあります（[`docs/CONTENT.md`](docs/CONTENT.md) の「画像の最適化」参照）。

カラー・サーフェストークンの一覧は [`docs/STYLEGUIDE.md`](docs/STYLEGUIDE.md) を参照してください。  
CSS の読み込み順・レスポンシブの所在は [`docs/CSS.md`](docs/CSS.md) を参照してください。

## 掲載内容の更新（担当者向け）

**ニュース・イベント・上映・スケジュール帯・静的文言をどこで直すか**は、次のドキュメントに一覧しています。更新作業の前に必ず目を通してください。

- **[`docs/CONTENT.md`](docs/CONTENT.md)** … データソース別の編集先、CSV 列名、`config.js` の注意点、会期・会場の重複チェック、ローカル検証の手順
- **[`docs/SIGNAGE_AND_LOOPS.md`](docs/SIGNAGE_AND_LOOPS.md)** … サイネージ URL・交互表示、マーキー／カルーセル／スライドの周期と変更場所

## データ源（テストと本番）

| 環境 | ブランチ／配布 | データ |
|------|----------------|--------|
| **テスト** | `develop`（CI は Artifact）、**Heteml**（`npm run deploy:heteml`） | 実行時に **Google スプレッドシート**（`DATA_MODE=sheet`） |
| **本番** | `main` → GitHub Pages | デプロイ時にシートから **`data/*.csv` を同期**し、**同梱 CSV のみ**参照（`DATA_MODE=local`） |

詳細は [`docs/CONTENT.md`](docs/CONTENT.md) の「データ源（`DATA_MODE`）」を参照してください。

## ビルド・デプロイ（担当者向け）

初回のみ [`.env.example`](.env.example) をコピーして `.env` を作り、Heteml の SSH 情報などを設定します（`.env` は Git に含めません）。

```bash
cp .env.example .env   # 値を編集
npm run config:sheet   # ローカル開発の既定（スプレッドシート参照）
npm run dev            # http://localhost:8080/（バックグラウンド）
```

| コマンド | 内容 |
|----------|------|
| `npm run dev` | ローカルサーバー起動（`http://127.0.0.1:8080/`） |
| `npm run dev stop` | ローカルサーバー停止 |
| `npm run serve` | `npm run dev` と同じ |

開発サーバーは HTML / JS / CSS / CSV に `Cache-Control: no-store` を付与します（古い `exhibition.js` が残るのを防ぐ）。
| `npm run optimize:images` | `images-src/` の原稿から `images/` に WebP/JPEG（複数幅）を生成 |
| `npm run sync:data` | スプレッドシート → `data/events.csv`・`exhibitions.csv` 等へ書き出し |
| `npm run build:test` | `DATA_MODE=sheet` で `_site/` 組み立て |
| `npm run build:prod` | 同期 + `DATA_MODE=local` で `_site/` 組み立て |
| `npm run deploy` | デフォルトで `full`（`heteml` → `prod` を連続実行） |
| `npm run deploy -- full` | `heteml` → `prod` を連続実行 |
| `npm run deploy -- heteml` | テストビルド後、`.env` の SSH 先へ `rsync` |
| `npm run deploy -- prod` | `deploy:prod` と同じ（本番更新のみ） |
| `npm run deploy:heteml` | テストビルド後、`.env` の SSH 先へ `rsync` |
| `npm run deploy:prod` | 本番ビルド → `optimize:images` → 配信対象一式（`index.html` / `css` / `js` / `data` / `images` / `scripts`）を commit → `git push github main`（`SKIP_OPTIMIZE_IMAGES=1` / `SKIP_GIT_COMMIT=1` で省略可） |

設定の編集先: [`js/config.shared.js`](js/config.shared.js)（共通定数・シート URL）、[`js/config.template.js`](js/config.template.js)（生成テンプレ）。[`js/config.js`](js/config.js) は `npm run config:sheet` / `config:local` で自動生成されます。

## 運用・公開（GitHub Pages）

**必ず次の順で**行ってください。

1. **Settings → Pages** の **Source** を **GitHub Actions** にする。  
2. **`main`** への push で [`.github/workflows/pages.yml`](.github/workflows/pages.yml) が走り、シート同期 → 同梱 CSV → Pages 公開。  
3. **`develop`** への push で [`.github/workflows/pages-preview.yml`](.github/workflows/pages-preview.yml) が走り、スプレッドシート参照の `_site` を **Artifact** として保存（Pages 本番は `main` のみ）。

手元から本番反映する例: `npm run deploy:prod`（内部で `sync:data` と `github` リモートへ push）。

## ローカルでの表示確認

```bash
npm run dev
```

停止するとき:

```bash
npm run dev stop
```

ブラウザで `http://localhost:8080/` を開いてください（`file://` 直開きでは `fetch` が失敗することがあります）。

## URL パラメータ・ハッシュ

通常表示と、会場サイネージ用の縦型表示で URL の指定が異なります。**サイネージ・各種ループ（カルーセル／マーキー）の周期・変更場所**は **[`docs/SIGNAGE_AND_LOOPS.md`](docs/SIGNAGE_AND_LOOPS.md)** に一覧しています。

クエリの読み書きは [`js/lib/url-params.js`](js/lib/url-params.js)（`history.replaceState`、再読込なし）を使っています。

### 深リンク（通常サイト）

| パラメータ | 例 | 動作 |
|------------|-----|------|
| `event_id` | `?event_id=evt-01` | 読み込み後、該当イベントの詳細モーダルを開く。モーダルを閉じると URL から削除される |
| `movie_id` | `?movie_id=scr-1` | 読み込み後、該当上映作品の詳細モーダルを開く。モーダルを閉じると URL から削除される |

カードからモーダルを開いたときも、上記パラメータが URL に付与されます（共有用）。存在しない ID を指定してもエラーにはせず、モーダルは開きません。

### サイネージ（縦型・1080×1920 想定）

**詳細・周期・変更手順は [`docs/SIGNAGE_AND_LOOPS.md`](docs/SIGNAGE_AND_LOOPS.md) を参照。** 以下はクイックリファレンスです。

会場ディスプレイなど、**プログラムの一部だけを全画面表示**するモードです。`js/main.js` 先頭の `initSignageMode()` が判定し、`html.is-signage`・`body.is-signage-vertical`・`body[data-signage]` を付与します。

**指定方法**（クエリを優先、なければハッシュを参照）:

| 方法 | ポスター | 上映 | イベント |
|------|----------|------|----------|
| クエリ | `?signage=poster` | `?signage=screening` | `?signage=event` |
| ハッシュ | `#signage-poster` | `#signage-screening` | `#signage-event` |
| **自動巡回** | `?signage=cycle&duration=60`（**ポスター→上映→イベント**を 60 秒ごとに順送り） | 同上 | 同上 |

**例**

```text
https://（サイトURL）/?signage=poster
https://（サイトURL）/?signage=screening
https://（サイトURL）/?signage=event
https://（サイトURL）/#signage-screening
https://（サイトURL）/?signage=cycle&duration=60
https://（サイトURL）/?signage=cycle&duration=60&view=screening
https://（サイトURL）/?signage=poster,screening,event&duration=90
https://（サイトURL）/?signage=screening,event&duration=90
https://（サイトURL）/?signage=screening&cycle=1&duration=60
```

**自動巡回（`duration`）**

- `duration` … 1 画面の表示秒数（秒）。省略時 **60**。最小 5・最大 3600。
- `signage=cycle`（または `rotate` / `both`）… **ポスター→上映→イベント**を `location.replace` で順送り。開始画面は `view=poster`（既定）・`screening`・`event`。
- `signage=poster,screening,event` … `cycle` と同じ3面巡回（カンマ区切り）。
- `signage=screening,event` … **上映⇄イベントのみ**（ポスターなし）。
- `signage=screening&cycle=1&duration=60` … 上映から開始し、以降は上映⇄イベントのみ。
- 自動巡回（`cycle`）では、上映・イベント各ヒーローカルーセル位置を **sessionStorage** に記憶し、切替後も先頭に戻らず続きから表示します（タブを閉じるとリセット）。

**表示の違い**

| 項目 | 通常 | サイネージ |
|------|------|------------|
| ナビ・ヒーロー・お知らせ・開催概要・アクセス・フッター | 表示 | **非表示** |
| プログラム | 展示・イベント・上映 | **`poster`・`screening`・`event` のいずれか1面** |
| パララックス・章ナビ・テストページ告知 | 有効 | **無効** |
| ページタイトル | 既定 | 末尾に「上映プログラム（サイネージ）」等を付与 |

**`signage=screening`（上映）**

- `#screening` のみ表示（コンテナ最大幅 **1080px**、`min-height: 1700px` 付近で 9:16 向け密度調整）。
- 構成は **①プログラム見出し → ②作品スライド（画像＋あらすじ）→ ③日別リスト（タイトル＋メタ）→ ④池谷ゼミ教員メッセージ（下部パネル）**。画面高さ 1920px いっぱいに伸ばす flex レイアウト。
- 静的 HTML のプログラム名ブロック（`screening-program-lede-stack`）は非表示。
- `#event` セクションの読み込み・表示は行いません。

**`signage=event`（イベント）**

- `#event` のみ表示（コンテナ最大幅 **1080px**、`min-height: 1700px` 付近で 9:16 向け密度調整）。
- 構成は **①プログラム見出し（上映サイネージと同型）→ ②全イベントの全幅カルーセル（画像＋概要フロート）→ ③日別2列リスト（タイトル＋メタ）**。長文（`program-copy`・説明文）は非表示。
- `#screening` セクションの読み込み・表示は行いません。

**1080×1920 について**

CSS は縦型 **1080×1920px** を想定して調整していますが、ブラウザの UI や実機の解像度設定によっては多少のスクロールが出る場合があります。キオスク端末ではフルスクリーン表示（アドレスバー非表示）を推奨します。

スタイルの詳細は [`css/overrides.css`](css/overrides.css) 後半（`body[data-signage]`）および [`docs/CSS.md`](docs/CSS.md) を参照してください。

### ページ内アンカー（参考）

サイネージとは別に、通常サイトの章ジャンプ用ハッシュとして `#exhibition`・`#event`・`#screening`・`#news` 等があります。ナビやタイムラインからリンクされています。

## お問い合わせ

掲載内容や公開に関するご質問は、**甲南女子大学 文学部 メディア表現学科**までお願いします。
