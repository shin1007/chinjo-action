# 参加のしかた

Issue・プルリクエストを歓迎します。日本語で書いてください（英語でも読みます）。

## 何から手を付けるか

- [good first issue](https://github.com/shin1007/chinjo-action/labels/good%20first%20issue) の印が付いた Issue
- サイトの [これからの予定](https://chinjo-action.vercel.app/roadmap) と [困っていること](https://chinjo-action.vercel.app/trouble)
- **自治体の受け付け方を調べる**（郵送・電子申請・住民以外の扱いなど）。手順は [docs/調査/受け付け方の調べ方.md](docs/調査/受け付け方の調べ方.md)。コードを書かなくても手伝えます
- 調べきれていない自治体・資料の一覧：[docs/調査/](docs/調査/)（たとえば [陳情の案内ページが見つからない議会](docs/調査/陳情の案内ページが見つからない議会.md)、[一次資料に当たれていない資料](docs/調査/一次資料に当たれていない資料.md)）

## 手元で動かす

Node.js 20 以上。

```sh
npm ci
npm test
npm run lint
npx serve site
```

プルリクエストでは GitHub Actions が `npm run lint` と `npm test` を実行します。

## 変更の種類ごとの注意

### 画面・JavaScript
- ビルドの道具は入れません。`site/` の中のファイルがそのまま配信されます。
- `site/<テーマ>/make.html`・`labels.html` は `templates/` から作るファイルです。直すときは `templates/` を直して `node scripts/pages.js` を実行してください。
- ヘッダーのテーマ切り替えメニューと、フッターの GitHub への案内は、全ページ共通の部品です。HTML を1ページずつ直さず、`scripts/pages.js` の `themeNav`・`primaryNav`（テーマのページの「つくる・出し方」）・`GITHUB`・`SKIP`（本文へ移動）・`THEME_COLOR` を直して `node scripts/pages.js` を実行してください（食い違うと `npm test` で分かります）。
- 外部のスクリプト・フォントは読み込みません（`vercel.json` の Content-Security-Policy で止めています）。

### 陳情の文面・数字・参考資料（`site/themes/*/asks-*.js`）
- 事実・数字・条文は、**一次資料**（法令の原文、官公庁・自治体・裁判所・国際機関の公式資料、論文の原文）で確かめたものだけを書きます。プルリクエストには、確かめた資料の URL と、どこに書いてあったか（ページ・条・表）を書いてください。
- 国会図書館・国会の調査室の解説や査読のある系統的レビューなど、信頼できる二次資料を使うときは、原文を開いて確かめ、refs に `secondary: true` を付けます。報道・まとめサイトだけを根拠にしたものは取り込みません。
- 各項目の `id` は変えないでください。文の中の半角の `'` は全角の「’」にします。
- 文面の見本 [docs/見本/](docs/見本/) は `node scripts/samples.js` で作り直します（`npm test` で食い違いを知らせます）。

### 自治体・議会のデータ（`site/data/`）
- 自動で作るファイル（`councils.js`・`sites.js`・`tel.js` など）は手で直さず、`scripts/` の道具を使います。詳しくは [site/data/README.md](site/data/README.md)。
- 議会の受け付け方（郵送で審査されるか など）を足すときは、議会の公式の案内ページの URL と確かめた日を付けてください。

## ライセンス

プルリクエストを送ると、その変更を [LICENSE-CONTENT.md](LICENSE-CONTENT.md) の同じ区分のライセンス（プログラムは MIT、陳情の文面は CC0、データと説明文は CC BY 4.0）で公開することに同意したものとします。

## やらないこと
- 特定の政党・候補者の応援になる変更、個人の名前・住所を載せる変更は取り込みません。
- 陳情のテーマ・主張そのものの変更の提案は、プルリクエストではなく、まず Issue かサイトの [ご意見](https://chinjo-action.vercel.app/feedback) で相談してください。
