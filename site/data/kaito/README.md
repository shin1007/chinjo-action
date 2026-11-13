# 自治体に寄せられた意見と回答のデータベース

自治体（知事・市区町村長）が公開している「寄せられた意見（市民の声）と回答」を集めたもの。
Supabase は容量に限りがあるので、ここ（リポジトリ）に置く。1行1件の JSON Lines。

| ファイル | 中身 |
|---|---|
| `lists.jsonl` | 自治体ごとの、回答の一覧のページ。1行1自治体 |
| `items.jsonl` | 一覧から集めた個別の回答。1行1件。選んだ項目に関係がないものも全部入れる |

作り方：`node scripts/kaito-fetch.js`（一覧を探してリンクを集める。手元の `scripts/.intake-cache/kaito/` に置く）→ `node scripts/kaito-build.js`（jsonl と作成画面用の `site/data/kaito.js` を書き出す）。
関係のある項目（`asks`）は、題名に言い換えの語（scripts/search-words.js）があるものを、手元の Ollama（qwen3:8b）に「同じ話題か」を聞いて決める。日付は関係のあるものだけ、ページを開いて読み取る。

将来「どの自治体でどんな要望・陳情が通ったか」を検索できるようにするため、陳情の結果（採択・不採択）もこの `items.jsonl` に `kind: "chinjo"` で足す前提にしている。

## lists.jsonl の1行

```json
{"muni": "大阪府/大阪市", "kind": "yobo", "url": "...", "title": "ページの題名",
 "found_at": "2026-11-13", "route": "auto_extract", "checked": false}
```

## items.jsonl の1行

```json
{"muni": "大阪府/大阪市",        // site/data/intake/*.jsonl の id と同じ
 "kind": "yobo",                  // yobo 首長への意見・要望／chinjo 議会への陳情（これから）
 "title": "路上喫煙を禁止する区域を大阪市内全域に拡大しました【環境局】",
 "url": "...",
 "date": "2026-01-28",            // 年月日。読み取れなければ null
 "date_kind": "掲載",             // 回答／受付／掲載（掲載・更新・見出しの後の日付）
 "result": "reflected",           // reflected 施策に反映した（題名から推し量った）／陳情では adopted 採択・rejected 不採択など／null
 "asks": ["kenko/l_smoke_free"],  // 関係のある項目（テーマ/項目ID）
 "found_at": "2026-11-13",
 "route": "auto_extract",         // auto_extract 機械で集めた／official_site 人が公式サイトで確かめた
 "checked": false}                // true にした行は kaito-build.js が上書きしない
```

## わかっている限界（2026-11-13）

- 回答を月ごとの PDF・エクセルにまとめて載せている自治体（例：世田谷区）は、個別の回答を取り出せていない。一覧のページへのリンクだけを出す。
- 一覧を JavaScript で表示しているサイト（例：福岡市）は、個別の回答を取り出せていない。
- 一覧の見つけ方は題名の言葉で選んでいるので、違うページを選んでいることがある。計画案への意見・世論調査・意見交換会・SNSの案内などは、題名で外している（kaito-build.js の LIST_BAD）。
- `items.jsonl` の `checked: true` は、関係のある項目（`asks`）を人が題名で確かめたもの（2026-11-14、関係ありとされた85件を見て、26件を外した）。回答の中身までは読んでいない。
- PDF・エクセルの中身を手元の生成AIで読むのは、CPU だけでは1ページ1分ほどかかるので、`node scripts/kaito-build.js --files` を付けたときだけにした。
- 一覧が見つからない自治体のサイト内検索は、Yahoo! JAPAN の検索を使う（DuckDuckGo はすぐ断る、Bing は site: を無視する）。Yahoo! も続けて使うと断る（429）ので、`SEARCH_GAP_MS=90000 node scripts/kaito-fetch.js --retry` のように間をあけて何日かに分けて進める。
