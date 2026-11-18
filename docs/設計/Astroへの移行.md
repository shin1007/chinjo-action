# Astro への移行の計画

## ねらい

- **ユーザーから見た中身と速さは変えない。** Astro はページを静的な HTML として書き出すので、届くものはいまの手書きの HTML と同じ形になる。JavaScript も、いまの `site/js/*.js` をそのまま読み込む。
- **コントリビューターが直しやすくする。** いまはヘッダー・テーマの切り替えメニュー・フッターなどが 43 ページそれぞれにコピーされていて、1か所を直すのに全ページを書き換えている。テーマごとのページは `scripts/pages.js` と `templates/` で作っているが、対象は2種類だけ。これを Astro の部品（コンポーネント）とレイアウトにまとめる。
- **フレームワークは Astro 1つにそろえる。** React・Vue などの UI ライブラリは入れない。

## 変えないこと

- URL（`/kodomo/make` など）。`vercel.json` の `cleanUrls` と転送の設定もそのまま
- `site/js/`・`site/data/`・`site/css/`・`site/vendor/`・`site/fonts/` の中身。Astro の `public/` に置いて、そのまま配る
- Content-Security-Policy（`script-src 'self'`）。Astro にインラインのスクリプトを出させない設定にする
- データを作るスクリプト（`scripts/*.js`）とテスト（`npm test`）の考え方

## 手順

1. **土台を作る**：`astro` を devDependencies に足し、`src/pages/`・`src/layouts/`・`src/components/` を作る。`public/` は `site/` の静的なファイルを指すようにする。Vercel の出力先を Astro の `dist/` に変える。この段階ではページは移さない
2. **共通部品を作る**：ヘッダー（テーマの切り替えメニューつき）、フッター、`<head>` の共通部分（OGP・CSS・favicon）
3. **ページを移す**：小さいページ（/roadmap・/trouble・/about など）から始め、1回に数ページずつ。移したページは、移す前と書き出された HTML を比べて、意図しない違いがないことを確かめる
4. **テーマごとのページ**：`templates/` と `scripts/pages.js` を、テーマの一覧をもとにページを作る Astro のページ（`src/pages/[theme]/make.astro` など）に置き換える
5. **テストを直す**：いま `site/**/*.html` を読んでいるテストは、書き出した `dist/` を読むようにする。CI で `astro build` を流す
6. **片付け**：`templates/`・`scripts/pages.js` を消し、README と CONTRIBUTING に新しい書き方を書く

各段階で Lighthouse（スマホ想定）と、陳情書をつくる画面をブラウザで最後まで進める確認をする。点数が下がったら、その段階は取り込まない。
