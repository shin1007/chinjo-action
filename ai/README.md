# AI連携用データ

[`petitions.json`](./petitions.json) は、陳情のテーマ、項目、文面、理由、参考資料を一つにまとめた機械可読データです。ほかのAIに渡すときは、必要なテーマまたは `items[].id` だけを抜き出してください。

- `wording`：陳情の「求める事項」
- `reason`：陳情の理由
- `references[].sourceId`：[`data/source-index.json`](../data/source-index.json) の一次資料ID
- `templates`：件名・趣旨などの定型文

本文を毎回AIへ送らず、必要な資料だけ保存・確認します。

```powershell
node scripts/export-ai.js
node scripts/source.js --list
node scripts/source.js src-xxxxxxxxxx
```

`export-ai.js` は `themes/*/asks-*.js` と `template.js` から再生成します。資料を保存した後に再生成しても、`fetchedAt` と `localPath` は保持されます。`sources/cache/` の保存物は、公開や共有の前に利用条件を確認してください。
