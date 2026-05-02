# 学科学外イベント Web（まちなかキャンパス 2026）

サイトの入口は **`2026-04-26/index.html`** です。CSS / JS / 画像はすべて `2026-04-26/` 以下の相対パスで参照されています。

## ローカルで確認

```bash
cd 2026-04-26
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080/` を開いてください（`file://` では地図等が動かない場合があります）。

## パフォーマンステスト（Lighthouse）

[Google Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/) を **headless Chrome** で実行し、Performance スコアと監査結果の HTML / JSON を `.lighthouse/` に出力します（Node.js とネットワークがあれば `npx` で取得、追加の `npm install` は不要です）。

1. 別ターミナルでサイトを配信する:

   ```bash
   cd 2026-04-26
   python3 -m http.server 8080
   ```

2. リポジトリルートで:

   ```bash
   chmod +x scripts/perf-lighthouse.sh
   ./scripts/perf-lighthouse.sh
   ```

   - 既定 URL は `http://127.0.0.1:8080/`（第 1 引数で変更可）
   - 第 2 引数に `mobile` を付けるとモバイル相当の計測になります（例: `./scripts/perf-lighthouse.sh http://127.0.0.1:8080/ mobile`）
   - レポート: `.lighthouse/last-run.report.html`（都度タイムスタンプ付きの `run-*.report.*` も保存）
   - 計測が終わると **既定のブラウザで HTML レポートを自動で開きます**（macOS は `open`、Linux は `xdg-open`、どちらも無い場合は `python3 -m webbrowser` を試します）。自動で開きたくないときは `NO_OPEN=1 ./scripts/perf-lighthouse.sh` を使ってください。
   - Cursor の内蔵ターミナルで `open` が効かない場合は、ターミナル.app や iTerm で同じコマンドを実行するか、Finder で `プロジェクト/.lighthouse/last-run.report.html` をダブルクリックして開いてください。

ブラウザの DevTools（Performance パネル）で手動録画する方法とも併用できます。

## Gitea へ初回 push

リポジトリルートは本ディレクトリです。Gitea で空リポジトリを作成したあと、次のいずれかで push できます（`<URL>` は HTTPS または SSH の clone URL に置き換え）。

```bash
./scripts/push-gitea.sh <URL>
```

または手動で:

```bash
git remote add origin <URL>
git push -u origin main
```

既に `origin` がある場合は `git remote set-url origin <URL>` を利用するか、`push-gitea.sh` が URL を上書き設定してから push します。

### 注意

- ホスティングで「リポジトリのルート＝公開ドキュメントルート」とする場合は、`2026-04-26` の中身をデプロイ先にコピーするか、サブパス公開の設定が必要です。
- `main.js` 内の Google Maps API キーは公開リポジトリに push する前に、Cloud Console でリファラー制限の見直し・必要ならキーのローテーションを推奨します。
- SNS 用 OGP（`og:image` / `twitter:image`）は、本番公開時に **`https://` 始まりの絶対 URL** に差し替えると Facebook / X 等でのプレビューが安定しやすいです（`2026-04-26/index.html` 内のコメント参照）。
