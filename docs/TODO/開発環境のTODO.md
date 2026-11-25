# 開発環境の TODO

2026-11-22 にユーザーが求めた。

## lint（`npm run lint`）が動かない

- [ ] 作業環境の初期化（setup script）に `npm ci` を足すか決める。（2026-11-23：`npm ci` のある環境では lint は通る）
- 2026-11-22 時点：`npm test`（116件）は通っている。lint は変更前から動いていなかったので、今回の変更とは関係ない。
- 2026-11-23：Windows（core.autocrlf=true）で取り出すと site/data/intake.js・coverage.json が CRLF になり、書き出し済みかのテストが落ちていた。テストで改行の違いを比べないようにした。
