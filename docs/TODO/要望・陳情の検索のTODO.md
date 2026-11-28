# 「どの自治体でどんな要望・陳情が通ったか」を検索できるようにする（将来のTODO）

> **やることの正本は GitHub Issues**（[ラベルの一覧](https://github.com/shin1007/chinjo-action/labels)）。このファイルは背景・経緯・決めたことのメモで、やることの一覧は持たない（2026-11-28 から）。

2026-11-13 にユーザーが求めた。今はデータを貯める段階で、検索の画面はまだ作らない。

## いまあるもの

- `site/data/kaito/items.jsonl`：自治体が公開している「寄せられた意見と回答」の個別のページ（1行1件）。選んだ項目に関係がないものも全部入れている。`result: "reflected"` は題名から「施策に反映した」と推し量ったもの。
- `site/data/kaito/lists.jsonl`：自治体ごとの回答の一覧のページ。
- 作成画面は、このうち一覧のページと、選んだ項目に関係のある回答だけを `site/data/kaito.js` で読み込む。
- 形と作り方は [site/data/kaito/README.md](../../site/data/kaito/README.md)。

## やること

- やること・進み具合は GitHub の Issue [#726](https://github.com/shin1007/chinjo-action/issues/726) で管理する。
