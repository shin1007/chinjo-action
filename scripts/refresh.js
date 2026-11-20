#!/usr/bin/env node
// 名簿の取り直しと出典の照合を、手元でまとめて走らせる（GitHub Actions の intake-verify と同じ中身）。
//   npm run refresh                          … 国会議員の名簿を取り直し、出典を照合する（30日以内に取ったページは取り直さない）
//   npm run refresh -- --only 東京都          … 改選のあった都道府県（その中の市区町村も）の出典だけ取り直す。--only はいくつでも
//   npm run refresh -- --only 大阪府/堺市     … 市区町村ひとつだけ
//   npm run refresh -- --no-diet              … 国会議員の名簿は取り直さない（地方選挙のあとなど）
//   npm run refresh -- --roster --only 東京都 … 議員名簿のページ（site/data/roster.json）と、そこからの議員の名前（site/data/roster/）も取り直す（改選のあとに）
//   npm run refresh -- --pr                   … 終わったらブランチを切ってコミットし、プルリクエストを作る
// 国会議員の名簿は公式の一覧を丸ごと取っても十数ページなので、選挙区で絞らない。
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const run = (cmd, a) => execFileSync(cmd, a, { cwd: ROOT, stdio: 'inherit' });
const out = (cmd, a) => execFileSync(cmd, a, { cwd: ROOT, encoding: 'utf8' }).trim();
const FILES = ['site/data/diet-members.js', 'site/data/roster.json', 'site/data/roster', 'docs/調査/議員の名前を抜き出せなかった議会.md', 'docs/調査/議員名簿のページが見つからない議会.md', 'site/data/intake/verify.json', 'site/data/verify-summary.json', 'docs/調査/出典を確かめられなかったもの.md'];

if (!args.includes('--no-diet')) run(process.execPath, ['scripts/diet-members.js']);
if (args.includes('--roster')) {
  const o = args.filter((a, i) => a === '--only' || args[i - 1] === '--only');
  run(process.execPath, ['scripts/roster-find.js', ...o]);
  run(process.execPath, ['scripts/roster-names.js', ...(o.length ? o : ['--next', '0'])]);
}
run(process.execPath, ['scripts/intake-verify.js', ...args.filter((a, i) => a === '--only' || args[i - 1] === '--only' || a === '--refetch')]);

if (args.includes('--pr')) {
  if (!out('git', ['status', '--porcelain', '--', ...FILES])) { console.error('変わったところがないので、プルリクエストは作らない'); process.exit(0); }
  const day = new Date().toISOString().slice(0, 10);
  const only = args.filter((a, i) => args[i - 1] === '--only');
  const what = only.length ? `（${only.join('・')}）` : '';
  run('git', ['checkout', '-b', `verify/${day}-${Date.now() % 100000}`, 'main']);
  run('git', ['add', '--', ...FILES]);
  run('git', ['commit', '-m', `名簿の取り直しと出典の照合${what}（${day}）`]);
  run('git', ['push', '-u', 'origin', 'HEAD']);
  run('gh', ['pr', 'create', '--fill', '--body', '手元で npm run refresh を走らせた結果。一文が見つからなかったもの・開けなかったものは docs/調査/出典を確かめられなかったもの.md にある。']);
}
