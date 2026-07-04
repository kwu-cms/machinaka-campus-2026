# スタイルガイド（まちなかキャンパス 2026）

実装の単一のソースは [`css/tokens.css`](../css/tokens.css) の `:root` 変数です。ここではトークンの意味と更新時の指針をまとめます。

## 甲南女子大学公式パレット

大学 Web（Adobe Color）の5色を `--uni-*` で保持し、イベント用 `--brand-*` にマッピングしています。

| トークン | HEX | 用途の目安 |
|----------|-----|------------|
| `--uni-burgundy` | `#8C2034` | ソーシャルデザイン（案A）など |
| `--uni-red` | `#C6171D` | WS・リンク、`--brand-magenta` |
| `--uni-navy` | `#034C8C` | レクチャー、`--brand-blue` |
| `--uni-lime` | `#88E56E` | 担当分野案Bのみ（参照: design-theme.html） |
| `--uni-grey` | `#F2F2F2` | パネル・`body` 下地 |

## サーフェス・テキスト

| トークン | 値（現在） | 用途 |
|----------|------------|------|
| `--bg-main` | `#0f1115` | ヒーロー背景などダーク面 |
| **`--bg-light`** | **`#F2F2F2`**（`--uni-grey`） | **プログラム／開催概要／アクセス**の `.container` パネル背景。白カードと区別 |
| `--brand-surface` | `#F2F2F2` | `body` の下地色。`--bg-light` と揃える |
| `--bg-light-rgb` | `242, 242, 242` | `rgba(var(--bg-light-rgb), α)` で半透明トーンに利用 |
| `--text-dark` | `#0d0d0d` | 本文・見出しの基準色（フライヤー「黒」に準拠） |
| `--text-light` | `#fff` | ダーク背景上のテキスト |
| `--rule` | `rgba(13,13,13,0.12)` | 区切り線 |
| `--dim` | `rgba(13,13,13,0.45)` | 補助テキスト |

パネル色を変えるときは **`--bg-light` / `--brand-surface` / `--uni-grey` を同じ値に保ち、`--bg-light-rgb` / `--uni-grey-rgb` を合わせる**こと。

## 担当分野（3分野）カラーリング案

カリキュラムの **ヴィジュアルカルチャー / クリエイション／AI / ソーシャルデザイン** 向け配色（サイト現行の `.ev-domain` は中立色のまま）は [`docs/design-theme.html`](design-theme.html) の「担当分野（3分野）カラーリング案」を参照。

案A: 赤 / 紺 / ワインレッド（大学3色）。案B: ライム / 明るい紺 / 深ワインレッド。

## ブランドカラー（大学色マッピング）

| トークン | HEX | 大学色 | 用途の目安 |
|----------|-----|--------|------------|
| `--brand-black` | `#0d0d0d` | — | 展示のアクセント（フライヤー黒） |
| `--brand-blue` | `#034C8C` | `--uni-navy` | トーク／講義（lecture）、フォーカスリング |
| `--brand-magenta` | `#C6171D` | `--uni-red` | ワークショップ、リンク（`--accent`） |
| `--brand-purple` | `#4C4784` | —（イベント従来色） | 上映・元町映画館まわり |
| `--brand-*-rgb` | 同上 | — | `rgba(var(--brand-*-rgb), α)` |

互換用：`--accent`（赤）、`--accent-2`（紺）、`--accent-3`（ワインレッド）。変数名 `magenta` / `purple` は歴史的互換のため維持。

## その他

- **地図ピン**：`--venue-pin-a`（まちづくり会館＝赤）、`--venue-pin-b`（元町映画館＝紫）
- **タイポグラフィ**：本文 Noto Sans JP、見出き明朝／DM Mono は HTML と `css/` 以下のクラスに準拠

パネル底色は **大学公式グレー `#F2F2F2`**。フライヤー由来の黒・4色アクセントはプログラム種別用として継続利用。

## UI 刷新（2026）

- **編集デザイン B**: ダークヒーロー + 明るいセクション面（`--surface-elevated`）。`body` の全面テクスチャは [`css/motion.css`](../css/motion.css) 読込時にオフ
- **モーション**: 振幅は `--hero-parallax-max`（既定 36px）。サイネージ・`prefers-reduced-motion` では演出なし（[`docs/CSS.md`](./CSS.md) 参照）
- **モーダル**: `.immersive-dialog` — 95dvh（モバイルは全画面）。View Transitions は対応ブラウザのみ
