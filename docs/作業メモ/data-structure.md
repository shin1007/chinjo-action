# データ構造の概要

この文書は、実データを読まずに参照関係を把握するための要約です。値の一覧は各 JavaScript ファイルにあります。

## 読み込み

各データファイルは ES Modules ではなく、ブラウザーで読み込まれる `window` のプロパティを定義します。テーマの文面は `window.ASKS` に追加されます。HTML が読み込む順序は画面ごとに異なるため、変更時は対象 HTML の `<script>` タグを確認します。

## `data/`

| ファイル | グローバル変数 | 構造の要約 |
|---|---|---|
| `prefs.js` | `PREFS` | 都道府県名の配列 |
| `municipalities.js` | `MUNICIPALITIES` | 都道府県名から自治体名配列への対応 |
| `offices.js` | `OFFICES` | 都道府県・自治体（`@` は都道府県庁）から `[郵便番号, 住所]` への対応 |
| `sites.js` | `SITES` | 同じキーから `[公式サイト, 陳情・請願案内, 議会ページ]` への対応 |
| `councils.js` | `COUNCILS` | 同じキーから議会情報オブジェクトへの対応。住所、郵送・市外提出・締切の注記などを含む |
| `mail.js` | `MAIL` | 同じキーから郵送時の取扱い情報への対応 |
| `tel.js` | `TEL` | 同じキーから電話種別・番号・出典ページへの対応 |
| `access.js` | `ACCESS` | 同じキーから `[緯度, 経度, 最寄り駅, 路線, 距離]` への対応 |
| `kana.js` | `KANA` | 同じキーから自治体名のカタカナ読みへの対応 |

`councils.js`、`sites.js`、`tel.js`、`offices.js`、`access.js`、`kana.js` は大きな生成・収集済みデータです。編集や検証で必要なキーだけを明示して読みます。生成元や注意事項は [data/README.md](../data/README.md) を確認してください。

## `themes/`

各テーマの `asks-national.js` と `asks-local.js` は、`window.ASKS` に項目オブジェクトを追加します。主な項目は `id`、`scope`、`category`、`label`、`title`、`text`、`reason`、`refs`、`recommended`、`defaultOn` です。`id` は保存データや画面処理から参照されるため変更しません。

`template.js` は定型文、`theme.js` はテーマ設定、`shop.js` などはテーマ固有の表示・選択肢を持ちます。

## 作業時の最小単位

- 見た目：対象 HTML と CSS、必要なら対象テーマの `theme.js`
- ウィザード：`wizard.js` と対象の `make.html`
- 文面：対象テーマの `asks-*.js` の該当項目だけ
- 自治体情報：対象自治体のキーだけを指定し、生成元と出典を確認
