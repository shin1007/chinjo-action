# 陳情・要望の受け付け方のデータベース

| ファイル | 中身 |
|---|---|
| `chinjo.jsonl` | 議会への陳情（請願は対象外）。1行1議会 |
| `yobo.jsonl` | 首長（知事・市区町村長）への要望・市民の声。1行1自治体 |

どちらも 47都道府県＋全市区町村の 1787 行。ここが本体で、手で（またはAIで）1行ずつ書き足していく。
`node scripts/intake.js check` で形を確かめる（`npm test` でも走る）。`stats` で埋まり具合を数える。
`export` で作成画面用の site/data/intake.js を書き出す（公式サイト・事務局の回答を根拠にした値だけ。npm test で書き出し忘れを見つける）。
`population` で人口を `municipality-populations.json` から入れ直す。
`migrate` は最初に今あるデータ（mail.js・mail-policy.js・councils.js・request-pages.js・docs/確認用/郵送の扱いが不明な議会.csv）から作ったときのもので、`--force` を付けると手で足した分が消える。

## 1行の形

```json
{
  "id": "北海道/札幌市",          // 都道府県/市区町村（都道府県は "@"）
  "pref": "北海道", "name": "札幌市", "level": "municipality",   // level: pref | municipality
  "population": 1954588, "population_as_of": "2026-01-01",       // 総務省 住民基本台帳人口。不明は null
  "to": "札幌市議会",             // 宛先
  "methods": {                    // 出し方ごとに、住民／住民以外の扱い
    "hand":  {"resident": "review", "nonresident": "unknown"},   // 持参
    "mail":  {...},               // 郵送
    "email": {...},               // メール
    "form":  {...},               // Webフォーム・電子申請
    "fax":   {...}                // FAX
  },
  "page_url": "...",              // 出し方の案内ページ（要望は page_title も）
  "form_url": "...", "email_addr": "...",                        // あれば
  "deadline": "...",              // 締切（案内の一文）
  "copies": "...", "format": "...",                              // 部数、様式・署名か押印か
  "anonymous_ok": "no",           // 匿名で出せるか（yes/no/unknown）
  "name_published": "yes",        // 氏名が会議録・文書表などで公開されるか
  "statement": "yes",             // 陳情者が意見陳述（趣旨説明）できるか ※陳情のみ
  "result_notice": "yes",         // 結果を知らせてくれるか ※陳情のみ
  "reply": "yes",                 // 回答をくれるか ※要望のみ
  "resubmit": "...",              // 同じ趣旨の出し直しの決まり
  "unresolved": "...",            // 調べたが判定できなかった理由
  "note": "...",
  "sources": [                    // 根拠。値を unknown 以外にしたら必ず1つ以上
    {"fields": ["methods.mail"], "quote": "案内ページの一文", "url": "...",
     "checked_at": "2026-11-05",
     "route": "official_site",    // official_site 公式サイト／office_reply 事務局への問い合わせの回答／user_tip 利用者からの情報（未確認）／auto_extract 機械で読み取っただけ
     "confidence": "confirmed",   // confirmed はっきり書いてある／likely 文面から推し量った／unknown
     "from": "mail.js:ok"}        // どのデータから来たか（任意）
  ]
}
```

### methods の値
- 陳情：`review` 審査する／`distribute` 配付・閲覧だけ／`accept` 受け付けるが扱いは書いていない／`no` 受け付けない／`unknown`
- 要望：`accept` 受け付ける／`no` 受け付けない／`unknown`

例：「持参のみ」は hand=review・mail=no、「住民以外の郵送は配付だけ」は mail={review, distribute}。

## 移したときの読み替え（2026-11-12）
- mail.js `ok` → mail 両方 review。`outside` → mail 住民 review・住民以外 distribute。`jisan` → mail 両方 distribute・hand 住民 review。`none` → mail・hand とも distribute。
- councils.js の `denshi` → form 住民 accept（route は auto_extract。公式サイトで確かめ直す）。`deadline`・`yusoNote`・`outsideNote` は sources に auto_extract として残した。
- request-pages.js → 要望の page_url・page_title（auto_extract）。出し方はまだ全部 unknown。
- 人口が入っていないもの（人口のデータにない）：外ケ浜町・龍ケ崎市・鎌ケ谷市・袖ケ浦市・須恵町。

## まだ反映していないもの
- サイト（wizard.js など）はまだ mail.js・councils.js を読んでいる。こちらへ切り替えるのは別の作業。
- Supabase の `council_tips` に届いた情報は、取り込むときに route を `user_tip` にする。

## 案内ページから埋める（2026-11-12〜）
1. `node scripts/intake-fetch.js chinjo|yobo`：案内ページの本文を `scripts/.intake-cache/` に取る（公開しない）。取れなかったものは [docs/確認用/受け付け方の案内ページを取得できなかった自治体.md](../../../docs/確認用/受け付け方の案内ページを取得できなかった自治体.md) に書く。
2. `node scripts/intake-extract.js chinjo|yobo [--list|--apply]`：本文を決まった言い回しで読み取り、`unknown` の項目だけ埋める。根拠の一文を sources に `route: official_site, confidence: likely, from: intake-extract` で残す。読み取りが食い違ったものは note に書いて値は入れない。
3. `node scripts/intake.js report`：一覧表 [docs/確認用/陳情・要望の受け付け方の一覧.md](../../../docs/確認用/陳情・要望の受け付け方の一覧.md) を作り直す。

機械の読み取りには間違いが混じる（例：住民の扱いだけ書いてあって住民以外は「?」のまま、内容の制限を受付の制限と取り違える）。原文を読んで確かめたら、その sources の confidence を confirmed にする。
要望の「受け付けません」は営業・誹謗中傷など内容の制限がほとんどなので、読み取りでは「不可」にしない（「市民に限る」などの書き方だけ住民以外を「不可」にする）。
