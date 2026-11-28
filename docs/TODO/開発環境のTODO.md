# 開発環境の TODO

> **やることの正本は GitHub Issues**（[ラベルの一覧](https://github.com/shin1007/chinjo-action/labels)）。このファイルは背景・経緯・決めたことのメモで、やることの一覧は持たない（2026-11-28 から）。

2026-11-22 にユーザーが求めた。

## lint（`npm run lint`）が動かない

- やること・進み具合は GitHub の Issue [#731](https://github.com/shin1007/chinjo-action/issues/731) で管理する。
- 2026-11-22 時点：`npm test`（116件）は通っている。lint は変更前から動いていなかったので、今回の変更とは関係ない。
- 2026-11-23：Windows（core.autocrlf=true）で取り出すと site/data/intake.js・coverage.json が CRLF になり、書き出し済みかのテストが落ちていた。テストで改行の違いを比べないようにした。
