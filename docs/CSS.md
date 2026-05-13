# CSS 構成とブレークポイント

サイトは **静的 HTML** 用に、次の順でスタイルを読み込みます（カスケード順を変えないでください）。

## 読み込み順（[`index.html`](../index.html)）

| 順 | ファイル | 主な内容 |
|----|----------|----------|
| 1 | [`css/tokens.css`](../css/tokens.css) | カラー・间距・`--shell-*` など CSS 変数 |
| 2 | [`css/base.css`](../css/base.css) | リセット、`html` / `body`、`.container` |
| 3 | [`css/nav-hero.css`](../css/nav-hero.css) | ナビ、ヒーロー、`.section-title` 等の共通見出し |
| 4 | [`css/sections-news.css`](../css/sections-news.css) | お知らせ（`#news`） |
| 5 | [`css/sections-program-core.css`](../css/sections-program-core.css) | プログラム共通パネル、`#program` 記事骨格、開催概要内タイムライン（`#about .about-schedule`）、共通 `.program-timeline*`、上映ヒーローレイアウト〜スライド枠 |
| 6 | [`css/sections-movies-events-dialogs.css`](../css/sections-movies-events-dialogs.css) | 上映リスト／映画モーダル、イベント一覧・モーダル、展示カルーセル、テストページ notice |
| 7 | [`css/sections-about-access.css`](../css/sections-about-access.css) | `#about` 本文グリッド、`#access` 会場・地図 |
| 8 | [`css/access-footer.css`](../css/access-footer.css) | アクセス周辺・フッター（既存） |
| 9 | [`css/overrides.css`](../css/overrides.css) | メディアクエリ差分、`#news` の表示切替、サイネージ専用など |

旧来の単一 `css/sections.css` は廃止し、上記 4 断片に分割しています（各ファイル先頭にバナーあり）。

## 主要メディアクエリ（目安）

これらは **`sections-*` と [`overrides.css`](../css/overrides.css) の両方**に分散しているため、変更時は両方を確認してください。

| 条件 | 代表的な用途 |
|------|----------------|
| **`max-width: 900px`** | ヒーローマーキー非表示、上映 2 列→1 列、フッター 1 列など（`overrides.css`）。`#news` 用のスタイル調整（`sections-news.css`） |
| **`min-width: 901px`** | `#news` セクション非表示（デスクトップはマーキーのみ）（`overrides.css`） |
| **`max-width: 1024px`** | 開催概要スケジュールのタイムラインを縦積み・バー全幅化（`overrides.css` の `#about .about-schedule`） |
| **`max-width: 1180px`** | `#about` 内イベントグリッドを 1 列化（`sections-program-core.css`） |
| **`min-width: 1181px`** | 7/18 土曜のみワイド用 3 列オフセット（`sections-program-core.css`） |
| **`max-width: 640px`** | モバイルナビ、`#news` 1 列（`overrides.css` + `sections-news.css`） |
| **`max-width: 520px`** | イベントカード 1 列など（`sections-movies-events-dialogs.css`） |
| **`prefers-reduced-motion: reduce`** | アニメーション無効化（各ファイル） |

## BODY 属性

- **`body[data-signage="screening"|"event"]`** … 縦型サイネージ。多くのルールは [`overrides.css`](../css/overrides.css) 後半にあります。

## 関連

- 掲載テキスト・データの更新場所: [`CONTENT.md`](./CONTENT.md)
