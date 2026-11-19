---
name: jichitai-research
description: 議会・自治体の情報（陳情・請願の案内ページ、郵送・メール・電子申請・住民以外の扱い、首長への要望の出し方、寄せられた意見と回答）を公式サイトで調べ、site/data/intake/*.jsonl などに一次資料つきで足す。「〇〇県の議会を調べて」「郵送の扱いを埋めて」「受け付け方を調べて」「案内ページを探して」「まだ調べていない自治体」「intake」と言われたときに使う。
---

# 議会・自治体の受け付け方を調べて足す

手伝う人向けの説明は [docs/調査/受け付け方の調べ方.md](../../../docs/調査/受け付け方の調べ方.md)、データの形は [site/data/intake/README.md](../../../site/data/intake/README.md)。このスキルはその手順を、Claude が同じ質でくり返せるようにまとめたもの。

## 守ること（いちばん大事）

1. **根拠は公式サイトの案内ページだけ。** 議会・自治体の公式サイト（`*.lg.jp`、`city.*.jp` など）の「請願・陳情」「市長への手紙」「市民の声」などのページ。まとめサイト・報道・AI の答え・検索結果の抜粋は根拠にしない
2. **書いていないことは推し量らない。** はっきり書いていなければ `unknown` のまま。「郵送可」とあっても、住民以外の扱いが書いていなければ `nonresident` は `unknown`
3. **原文をそのまま写す。** `sources[].quote` は案内ページの文をそのまま（要約しない）。値を `unknown` から変えたら、`sources` を必ず1つ足す
4. **機械で読んだものと、人が読んだものを分ける。** 自分で原文を読んで確かめたものは `confidence: "confirmed"`。スクリプトや決まった言い回しで読み取っただけなら `likely`。`confirmed` の値をスクリプトで上書きしない
5. **取れなかったことは必ず残す。** ボットの拒否・メンテナンス・タイムアウト・ページが見つからないときは、その自治体・URL・日付・理由を `docs/調査/` の該当ファイルに書く（下の表）。ユーザーがあとでブラウザで確かめられるように
6. **個人情報を書かない。** 電話で聞いた結果は `route: "office_reply"` と日付だけ。担当者の名前は書かない
7. 案内ページの本文は著作物なので、全文は `scripts/.intake-cache/`（Git に入れない）にだけ置く。リポジトリに入れるのは `quote` の一文だけ

## 手順

### 1. 調べる自治体を決める

```sh
node scripts/intake.js todo page        [都道府県]   # 陳情の案内ページが見つかっていない
node scripts/intake.js todo mail        [都道府県]   # 郵送で出した陳情を審査するか
node scripts/intake.js todo online      [都道府県]   # メール・電子申請で出せるか
node scripts/intake.js todo nonresident [都道府県]   # 住民以外の陳情の扱い
node scripts/intake.js todo yobo        [都道府県]   # 首長あての要望の出し方
node scripts/intake.js stats                         # どこまで埋まったか
```

人口の多い順に出る。1回に1つの都道府県か、10自治体くらいまでにする。

### 2. ページを探して取る（機械でできる分）

```sh
node scripts/intake-find.js [--apply]          # 案内ページ（page_url）がない議会を、公式サイトのリンクから探す
node scripts/intake-fetch.js chinjo|yobo       # 案内ページの本文を scripts/.intake-cache/ に取る
node scripts/intake-extract.js chinjo|yobo     # 決まった言い回しで読み取れる分を数える（書かない）
node scripts/intake-extract.js chinjo --show 東京都/墨田区   # 1件の読み取り結果と根拠の一文
node scripts/intake-extract.js chinjo|yobo --apply           # unknown の項目だけ likely で埋める
```

### 3. 原文を読んで確かめる（人の目の分）

- 機械で読めなかった自治体、`likely` のままの自治体は、案内ページを実際に開いて原文を読む。WebFetch で開けないときは `browser-drive` スキル（手元の Chromium）で開く
- 読んだら `site/data/intake/chinjo.jsonl`（議会への陳情）か `yobo.jsonl`（首長への要望）の、その自治体の1行だけを直す
- 住民以外の扱いをまとめて入れるときは `node scripts/intake-nonresident.js <spec.jsonl>`（形はスクリプトの先頭のコメント）

### 4. 書き出して確かめる

```sh
node scripts/intake.js check          # 形を確かめる
node scripts/intake.js export         # 作成画面用の site/data/intake.js を作り直す
node scripts/split-pref-data.js       # 作成画面が都道府県ごとに読む site/data/pref/*.js・council-mail.js を作り直す（忘れると npm test が落ちる）
node scripts/intake.js report         # 人が読む一覧（docs/調査/陳情・要望の受け付け方の一覧.md）
npm test
```

`site/data/sites.js`・`tel.js`・`offices.js`・`access.js`・`councils.js`・`mail.js`・`kaito.js`・`request-pages.js` を作り直したときも、`split-pref-data.js` を流す。

### 5. 作成画面で見え方を確かめる

`browser-drive` スキルで `/kodomo/make` を開き、調べた議会を選んで「印刷・提出」まで進め、足した情報（郵送の扱い・電子申請・案内ページへのリンク）が出ることを見る。

### 6. 記録とページの更新

- 取れなかった自治体を、下の表のファイルに足す
- `site/trouble.html`（困っていること）の「情報が足りない自治体」の数と、`site/roadmap.html` の「議会ごとの受け付け方の情報を増やす」を実態に合わせる
- プルリクエストには、調べた自治体・見たページの URL・取れなかった自治体を書く

## 取れなかったときに書く場所

| 何が取れなかったか | 書くファイル |
|---|---|
| 陳情・要望の案内ページが開けない | `docs/調査/受け付け方の案内ページを取得できなかった自治体.md` |
| 陳情の案内ページが見つからない | `docs/調査/陳情の案内ページが見つからない議会.md` |
| 要望書の出し方のページが見つからない | `docs/調査/要望書の出し方のページが見つからない自治体.md` |
| 寄せられた意見と回答の一覧が取れない | `docs/調査/回答の一覧を取得できなかった自治体.md` |
| 郵送の扱いがわからない | `docs/調査/郵送の扱いが不明な議会.csv` |
| 法令・統計・論文などの一次資料に当たれない | `docs/調査/一次資料に当たれていない資料.md` |

## 寄せられた意見と回答（kaito）

首長あての要望で、過去の意見と回答を公開しているページを集める流れは別にある：`node scripts/kaito-fetch.js` → `node scripts/kaito-build.js`（手元の Ollama を使う。`--no-llm` で使わずに作れる）。形は `site/data/kaito/README.md`。

## 消えそうなページを証拠として残す

報道や個人のサイトなど、消えるおそれのあるページは `node scripts/archive.js <URL> "<題名（発行元・日付）>"`。ボットに拒否されたら、Chrome で保存して `--file` で登録する。
