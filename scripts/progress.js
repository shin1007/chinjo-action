#!/usr/bin/env node
// 調査の進み具合（わかっている段階の数字）を site/data/progress.json に書く。/coverage の「ほかの調査の進み具合」に出す。
//   node scripts/progress.js        … 書いて、項目ごとの埋まり具合（数と人口の割合）を表で出す（DB を直したらいつでも流してよい）
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
  pref: { n: ids.filter((id) => !isMuni(id)).length, of: prefIds.length, pop: sum(ids.filter((id) => !isMuni(id))), total: sum(prefIds) },
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

// 受け付け方のデータ（intake.js）から、項目ごとに「確かめられた自治体の数」を数える（都道府県は 都道府県/@）
global.window = {};
require(path.join(DATA, 'intake.js'));
const INTAKE = window.INTAKE;
const has = (kind, field) => stat(Object.entries(INTAKE[kind]).filter(([, v]) => v[field]).map(([id]) => id));
const kaitoLists = new Set(jsonl('site/data/kaito/lists.jsonl').map((r) => r.muni));
const intake = {
  chinjo: Object.fromEntries(['page_url', 'mail', 'deadline', 'name_published', 'result_notice', 'copies', 'form', 'email'].map((f) => [f, has('chinjo', f)])),
  yobo: Object.fromEntries(['page_url', 'mail', 'pubcom_url', 'eligible', 'reply', 'form', 'email', 'anonymous_ok'].map((f) => [f, has('yobo', f)])),
  // 運営が問い合わせ・提出に使う項目（DB の生の値から数える）
  extra: {
    chinjo_email_addr: stat(chinjo.filter((r) => r.email_addr).map((r) => r.id)),
    chinjo_nonresident: stat(chinjo.filter((r) => r.nonresident_rule || r.anyone_can_submit === 'yes' || Object.values(r.methods).some((m) => m.nonresident !== 'unknown')).map((r) => r.id)),
    chinjo_form_nonresident_ok: stat(chinjo.filter((r) => ['review', 'distribute', 'accept'].includes(r.methods.form.nonresident)).map((r) => r.id)),
    yobo_email_addr: stat(yobo.filter((r) => r.email_addr).map((r) => r.id)),
    yobo_nonresident: stat(yobo.filter((r) => r.eligible || Object.values(r.methods).some((m) => m.nonresident !== 'unknown')).map((r) => r.id)),
    yobo_form_nonresident_ok: stat(yobo.filter((r) => r.methods.form.nonresident === 'accept').map((r) => r.id)),
  },
  kaito: stat([...kaitoLists].filter((id) => pop[id] !== undefined)),
};

const out = {
  asOf: new Date().toISOString().slice(0, 10),
  population_as_of: (chinjo[0] || {}).population_as_of,
  roster: { page: rosterPage, names: rosterNames },
  chinjo: { page: stat(chinjoPage), mailKnown: stat(mailKnown), mailReviewed: stat(mailReviewed) },
  yobo: { mailAccepted: stat(yoboMail) },
  intake,
  themes,
};
fs.writeFileSync(path.join(DATA, 'progress.json'), JSON.stringify(out) + '\n');
// 表で出す（都道府県・市区町村の数と、人口の割合。市区町村の人口は全国の人口とほぼ同じ）
const pc = (x) => (x.total ? (100 * x.pop / x.total).toFixed(1) : '0.0').padStart(5) + '%';
const line = (label, x) => console.log(`${label.padEnd(17, '　')} 都道府県 ${String(x.pref.n).padStart(2)}/${x.pref.of}（人口${pc(x.pref)}）  市区町村 ${String(x.muni.n).padStart(4)}/${x.muni.of}（人口${pc(x.muni)}）`);
console.log(`項目ごとの埋まり具合（${out.asOf}。人口は${out.population_as_of}現在）`);
const C = intake.chinjo, Y = intake.yobo, E = intake.extra;
[['陳情：案内ページ', C.page_url], ['陳情：郵送の扱い', C.mail], ['陳情：住民以外の扱い', E.chinjo_nonresident], ['陳情：電子申請・フォーム', C.form], ['陳情：メールの扱い', C.email],
 ['陳情：締切', C.deadline], ['陳情：部数', C.copies], ['陳情：氏名の公開', C.name_published], ['陳情：結果の通知', C.result_notice], ['陳情：問い合わせのメール', E.chinjo_email_addr], ['陳情：住民以外もフォームで出せる', E.chinjo_form_nonresident_ok],
 ['要望：案内ページ', Y.page_url], ['要望：郵送', Y.mail], ['要望：住民以外の扱い', E.yobo_nonresident], ['要望：フォーム', Y.form], ['要望：メール', Y.email], ['要望：回答', Y.reply], ['要望：匿名', Y.anonymous_ok], ['要望：問い合わせのメール', E.yobo_email_addr], ['要望：住民以外もフォームで出せる', E.yobo_form_nonresident_ok],
 ['パブコメの一覧', Y.pubcom_url], ['議員名簿のページ', rosterPage], ['議員の名前', rosterNames], ['意見と回答の一覧', intake.kaito]].forEach(([l, x]) => line(l, x));
