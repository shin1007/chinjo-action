#!/usr/bin/env node
// 調査の進み具合（わかっている段階の数字）を site/data/progress.json に書く。/coverage の「ほかの調査の進み具合」に出す。
//   node scripts/progress.js
// 数字は、このリポジトリのデータ（roster.json・roster/・intake/・各テーマの項目・採択例）を数えただけ。調べていないところは「不明」に入れる。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const jsonl = (f) => read(f).split('\n').filter(Boolean).map(JSON.parse);

const chinjo = jsonl('site/data/intake/chinjo.jsonl');
const yobo = jsonl('site/data/intake/yobo.jsonl');
const pop = Object.fromEntries(chinjo.map((r) => [r.id, r.population || 0]));
const isMuni = (id) => !id.endsWith('/@');
const sum = (ids) => ids.reduce((a, id) => a + (pop[id] || 0), 0);
// 都道府県（47）と市区町村（人口は市区町村だけで数える。都道府県の人口を足すと二重になるため）に分ける
const allIds = chinjo.map((r) => r.id);
const muniIds = allIds.filter(isMuni);
const prefIds = allIds.filter((id) => !isMuni(id));
const stat = (ids) => ({
  pref: { n: ids.filter((id) => !isMuni(id)).length, of: prefIds.length },
  muni: { n: ids.filter(isMuni).length, of: muniIds.length, pop: sum(ids.filter(isMuni)), total: sum(muniIds) },
});

// 議員名簿のページ・議員の名前
const roster = JSON.parse(read('site/data/roster.json'));
const found = allIds.filter((id) => roster[id] && roster[id].url);
const names = new Set();
for (const f of fs.readdirSync(path.join(DATA, 'roster'))) {
  if (f.startsWith('.') || !f.endsWith('.json')) continue;
  for (const [id, v] of Object.entries(JSON.parse(read(`site/data/roster/${f}`)))) if (v.names && v.names.length) names.add(id);
}
const rosterPage = stat(found);
const rosterNames = stat(allIds.filter((id) => names.has(id)));

// 陳情：案内ページ・郵送の扱い（住民）
const chinjoPage = chinjo.filter((r) => r.page_url).map((r) => r.id);
const mailKnown = chinjo.filter((r) => (r.methods.mail || {}).resident !== 'unknown').map((r) => r.id);
const mailReviewed = chinjo.filter((r) => ['review', 'accept'].includes((r.methods.mail || {}).resident)).map((r) => r.id);
// 要望：郵送で受け付ける
const yoboMail = yobo.filter((r) => ['accept', 'review'].includes((r.methods.mail || {}).resident)).map((r) => r.id);

// 各テーマの項目の数と、採択例の数
const themes = {};
for (const id of ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota']) {
  let n = 0;
  let l = 0;
  for (const [file, key] of [['asks-national.js', 'n'], ['asks-local.js', 'l']]) {
    const t = read(`site/themes/${id}/${file}`);
    const c = (t.match(/^\s*(?:\{\s*)?id: '[a-z_0-9]+'/gm) || []).length;
    if (key === 'n') n = c; else l = c;
  }
  const top = fs.existsSync(path.join(ROOT, `templates/parts/theme/${id}-top.html`)) ? read(`templates/parts/theme/${id}-top.html`) : '';
  const list = (top.match(/<ul class="adopted-list">[\s\S]*?<\/ul>/) || [''])[0];
  themes[id] = { national: n, local: l, adopted: (list.match(/<li>/g) || []).length };
}

const out = {
  asOf: new Date().toISOString().slice(0, 10),
  population_as_of: (chinjo[0] || {}).population_as_of,
  roster: { page: rosterPage, names: rosterNames },
  chinjo: { page: stat(chinjoPage), mailKnown: stat(mailKnown), mailReviewed: stat(mailReviewed) },
  yobo: { mailAccepted: stat(yoboMail) },
  themes,
};
fs.writeFileSync(path.join(DATA, 'progress.json'), JSON.stringify(out) + '\n');
console.log(JSON.stringify(out, null, 1));
