#!/usr/bin/env node
// 陳情の項目（site/themes/*/asks-*.js）の文面と根拠（refs）を点検する。
//   node scripts/asks-audit.js          … 点検の一覧を出す
//   node scripts/asks-audit.js --strict … 「直す」の点があれば終了コード1（「見直し」は警告だけ。npm test で確かめる）
// 点検するのは形だけです（事実が正しいかは、人が一次資料で確かめる）。ルールは docs/設計/陳情の文面を足すときのルール.md
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const THEMES = ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota'];
const NUM = /[0-9０-９]+\s*(人|件|％|%|割|倍|年|か所|ヶ所|校|園|億|万|円|日|時間|歳)/g;

function load(theme) {
  const window = {};
  for (const scope of ['national', 'local']) {
    new Function('window', fs.readFileSync(path.join(SITE, 'themes', theme, `asks-${scope}.js`), 'utf8'))(window);
  }
  return window.ASKS || [];
}

function audit(theme, a) {
  const out = [];
  const refs = a.refs || [];
  const withUrl = refs.filter((r) => r.url);
  const primary = withUrl.filter((r) => !r.secondary);
  const nums = ((a.reason || '').match(NUM) || []);
  const fix = (m) => out.push({ level: '直す', msg: `${theme}/${a.id}：${m}` });
  const look = (m) => out.push({ level: '見直し', msg: `${theme}/${a.id}：${m}` });
  if (!refs.length) fix('根拠（refs）がない');
  else if (refs.some((r) => !r.url)) fix('URL のない根拠がある');
  if (nums.length && !primary.length) fix(`数字（${nums.slice(0, 3).join('・')}）があるのに、一次資料の根拠がない`);
  if (refs.length && withUrl.length && !primary.length) fix('根拠が二次資料だけ');
  if (!a.text) fix('求める事項（text）が空');
  if ((a.reason || '').length > 900) look(`理由が長い（${a.reason.length}字）。読まれにくい`);
  if ((a.text || '').length > 400) look(`求める事項が長い（${a.text.length}字）`);
  if (/[。]\s*また|および.*および|ならびに.*ならびに/.test(a.text || '')) look('求める事項が2点以上に見える（1件＝1通・1〜2点に絞る）');
  if (a.scope === 'local' && !(a.forStaff || a.yoboText)) look('自治体向けなのに、担当課の進め方（forStaff）がない');
  return out;
}

let problems = [];
let total = 0;
for (const t of THEMES) {
  for (const a of load(t)) { total++; problems = problems.concat(audit(t, a)); }
}
const fixes = problems.filter((p) => p.level === '直す');
console.log(`項目 ${total} 件を点検。直す ${fixes.length} 件・見直し ${problems.length - fixes.length} 件`);
for (const p of problems) console.log(`- 【${p.level}】${p.msg}`);
if (process.argv.includes('--strict') && fixes.length) process.exit(1);
