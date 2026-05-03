# 学科学外イベント Web（まちなかキャンパス 2026）

サイトの入口は **`2026-04-26/index.html`** です。CSS は `css/`、JS は `js/`、データ（CSV / JSON）は `data/`、画像は `images/` に置き、`index.html` から相対パスで参照されています。

- **公開用アセット**は `2026-04-26/` のみです（GitHub Actions はこのフォルダの中身だけを Pages に載せます）。
- **ドラフト・構成メモ**はリポジトリルートの **`_draft/`** にあります（公開サイトには含まれません）。
- **`data/events.csv`** は実行時には使わず（イベント一覧は Google スプレッドシートを `js/main.js` の `SITE_CONFIG.eventsCsvUrl` から取得）、編集用・バックアップ用として同梱している場合があります。

## GitHub Pages で公開（プロジェクトサイト）

`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開する想定です。

1. GitHub リポジトリの **Settings → Pages** で、**Build and deployment** の Source を **GitHub Actions** に変更します。
2. `main` へ push すると [`.github/workflows/pages.yml`](.github/workflows/pages.yml) が動き、`2026-04-26/` の内容だけが artifact としてデプロイされます（リポジトリルートに `index.html` を置く必要はありません）。
3. ワークフローはデプロイ直前に [`2026-04-26/index.html`](2026-04-26/index.html) 内の **`__SITE_ORIGIN__`** を、オーナー名とリポジトリ名から組み立てた  
   `https://<owner>.github.io/<repository>/`  
   に置換し、`og:image` / `twitter:image` を絶対 URL にします（具体的には `.github/workflows/pages.yml` 内の `sed` を参照）。
4. **ローカル**で `index.html` を開くときは `__SITE_ORIGIN__` は置換されないため、OGP 用メタは本番と異なります（プレビュー検証は公開 URL かデバッガで行ってください）。

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

- GitHub Pages 以外でホストする場合も、配信のドキュメントルートには **`2026-04-26/` の中身** を載せれば、相対パスはそのまま動きます。
- Google Maps API キーは [`2026-04-26/js/main.js`](2026-04-26/js/main.js) の **`SITE_CONFIG.googleMapsApiKey`** にあります。公開リポジトリでは Cloud Console のリファラー制限の見直し・必要ならキーのローテーションを推奨します。
