# 陳情アクション

地方議会への陳情書・自治体への要望書を、だれでも無料でつくれるサイトです。テーマを選び、住んでいる自治体を選ぶと、議会あての陳情書と、宛名・封筒・参考資料までを印刷用にまとめて出します。

- サイト：<https://chinjo-action.vercel.app/>
- 運営：個人（開発は運営者と生成AI）。改善の提案（Issue）・修正（プルリクエスト）を歓迎します。始め方は [CONTRIBUTING.md](CONTRIBUTING.md)

## しくみ

ビルド不要の静的サイトです。`site/` をそのまま Vercel で配信し、データは JavaScript のファイルとして読み込みます。サーバーの処理は `api/` の関数2つと、Supabase（ご意見・提出の報告の受け付け）だけです。

```sh
npm ci
npm test        # データの形・文面・画面の処理のテスト
npm run lint
npx serve site  # 手元で見る（ほかの静的サーバーでも可）
```

## フォルダ

| フォルダ | 中身 |
|---|---|
| [site/](site/) | 公開するものすべて。URL は `site/` からの相対（`site/js/wizard.js` → `/js/wizard.js`） |
| [site/js/](site/js/) | 画面の処理。作成画面は `wizard.js`・`petition.js`（文面を組み立てる）・`places.js`（自治体を選ぶ） |
| [site/themes/](site/themes/) | テーマごとの陳情の文面と参考資料（`asks-national.js`：国への意見書、`asks-local.js`：自治体あて） |
| [site/data/](site/data/) | 自治体・議会のデータ。多くは `scripts/` で作る。直し方は [site/data/README.md](site/data/README.md) |
| [templates/](templates/) | テーマのページのひな形。`node scripts/pages.js` で `site/<テーマ>/make.html`・`labels.html` を作る |
| [scripts/](scripts/) | データやページを作る道具 |
| [test/](test/) | `node --test` のテスト |
| [api/](api/) | Vercel の関数（`/api/...`） |
| [supabase/](supabase/) | データベースの定義（`schema.sql`） |
| [ai/](ai/) | ほかの AI に渡すための文面データ（`node scripts/export-ai.js`） |
| [docs/](docs/) | 設計・調査の記録・TODO・文面の見本。案内は [docs/README.md](docs/README.md) |

AI エージェントで作業するときのきまりは [AGENTS.md](AGENTS.md) と [CLAUDE.md](CLAUDE.md) にあります。
