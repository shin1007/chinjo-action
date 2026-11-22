# 開発環境の TODO

2026-11-22 にユーザーが求めた。

## lint（`npm run lint`）が動かない

- [ ] `npm run lint` が `Cannot find module 'globals'`（`eslint.config.js` の3行目）で止まる。`globals` は `package.json` の devDependencies にあるが、この作業環境には `node_modules/` が入っていなかった（`node_modules/` は Git に入れない）。`npm ci` で入れて、lint が通るか確かめる。
- [ ] 通らないときは、出た警告を直す。作業環境の初期化（setup script）に `npm ci` を足すかも決める。
- 2026-11-22 時点：`npm test`（116件）は通っている。lint は変更前から動いていなかったので、今回の変更とは関係ない。
