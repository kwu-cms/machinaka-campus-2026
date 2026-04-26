# 学科学外イベント Web（まちなかキャンパス 2026）

サイトの入口は **`2026-04-26/index.html`** です。CSS / JS / 画像はすべて `2026-04-26/` 以下の相対パスで参照されています。

## ローカルで確認

```bash
cd 2026-04-26
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080/` を開いてください（`file://` では地図等が動かない場合があります）。

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
