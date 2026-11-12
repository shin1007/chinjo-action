# AI エージェント向け作業ルール

## 基本方針

- このリポジトリはビルド不要の静的サイトです。日常の UI・導線改善では、対象の HTML、`site/css/style.css`、`site/css/labels.css`、対象画面に対応する JavaScript だけを読みます。
- まず変更対象をファイル名で特定し、関係のないテーマやデータをまとめて読みません。
- 1回の作業は小さく切ります。例：ヘッダーだけ、ウィザードの進捗表示だけ、1画面の入力導線だけ。
- 既定の除外対象は [.claudeignore](./.claudeignore) と [.cursorignore](./.cursorignore) を参照してください。必要なデータは、対象ファイル名と読む理由をプロンプトに明記して明示的に読みます。

## フォルダ構成

- `site/`：公開するものすべて（Vercel の outputDirectory）。URL は `site/` からの相対（例：`site/js/wizard.js` → `/js/wizard.js`）
  - `site/*.html`・`site/<テーマ>/`：ページ（テーマのページのうち make・labels は `templates/` から `node scripts/pages.js` で作る）
  - `site/js/`：ページの JavaScript、`site/css/`：スタイル
  - `site/data/`：自治体・議会のデータ、`site/themes/`：テーマごとの文面・参考資料
  - `site/fonts/`・`site/vendor/`：PDF用のフォントとライブラリ
- `api/`：Vercel の関数（`/api/...`）
- `templates/`：テーマのページのひな形、`scripts/`：データやページを作る道具、`test/`：テスト
- `ai/`：ほかの AI に渡すための文面データ（`node scripts/export-ai.js`）
- `supabase/`：データベースの定義、`sources/`：保存した資料（Git に入れない）
- `docs/確認用/`：オーナーが読む・確かめるもの（文面の見本、未確認の資料、TODO、ほかの AI への依頼）
- `docs/作業メモ/`：AI が作業に使う設計・方針・訳

## 通常読んでよいファイル

- 画面：対象の `*.html`、`site/css/style.css`、`site/css/labels.css`
- UI・フロー：`site/js/` の `app.js`、`common.js`、`petition.js`、`wizard.js`、`places.js`、`shop.js`、`postage.js`、`report.js`
- テーマの見た目・定型文：対象テーマの `theme.js`、`template.js`、`shop.js`
- 仕様・編集案内：`site/data/README.md`、`docs/作業メモ/` の対象資料、`package.json`

## 通常読まないファイル

- 大きな自動生成データ：`site/data/councils.js`、`sites.js`、`tel.js`、`offices.js`、`access.js`、`kana.js`
- 長いテーマ別文面：`site/themes/*/asks-national.js`、`site/themes/*/asks-local.js`
- 実行時ライブラリ：`site/vendor/`
- 上記は構造確認や特定データの修正など、必要な作業で対象を明示された場合だけ読みます。構造の概要は [docs/作業メモ/data-structure.md](./docs/作業メモ/data-structure.md) を先に参照します。

## データファイルを変更するとき

- `site/data/*.js` のうち自動生成ファイルは、原則として手で編集せず、対応する `scripts/` の生成処理を使います。
- `site/themes/*/asks-*.js` は実際の文面データです。`id` を変えず、各項目の形式、末尾のカンマ、文字列の引用符を保ちます。根拠や数字を追加・変更するときは、一次資料を確認できたものを基本とし、信頼のおける二次資料（国会の調査室・国会図書館の解説、公的機関の委託調査、査読のある系統的レビュー、国際機関・専門機関の報告など）は原文を開いて確かめたうえで、refs に `secondary: true` を付けて加えます。出どころのはっきりしない記事やまとめサイトは使いません。報道機関・個人のサイトを参照したとき（docs を含む）は、消えたときの証拠として `node scripts/archive.js <URL> "<題名>"` で保存します（本文は Git に入れない sources/archive/、記録は site/data/archive-index.json）。
- データを変更したら `npm test` を実行し、必要に応じて対象画面を最後まで操作して生成結果を確認します。データの全量をコンテキストに載せるのではなく、対象のキーや先頭コメントなど必要な範囲だけを読みます。
- 本番で読み込むデータファイルは、トークン節約のためだけに分割・圧縮・形式変更しません。

## プロンプトの書き方

- 対象ファイルを明示します。例：「`site/js/wizard.js` と `templates/make.html` の進捗表示だけを変更する」。
- 作業範囲を1つに絞り、変更しない範囲も書きます。例：「データファイルと他テーマは変更しない」。
- データが必要な場合は、対象ファイル、必要なキー・範囲、確認したい目的を指定します。

## 確認

- JavaScript の変更は `npm test` と `npm run lint` を基本にします。
- 変更が UI の場合は、対象画面の操作確認も行います。
