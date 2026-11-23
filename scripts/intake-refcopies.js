#!/usr/bin/env node
// 陳情書に参考資料を添えるときの提出部数の記載を、取ってきた案内ページ（scripts/.intake-cache/chinjo/）から拾って、候補の一覧を出す。
//   node scripts/intake-refcopies.js            候補（議会・一文）を表示する
//   node scripts/intake-refcopies.js --json     JSON で出す
// 先に node scripts/intake-fetch.js chinjo で本文を取っておくこと。
// 拾うのは「資料・添付・別紙」と「n部・n通・議員の人数分」が同じ文にあるものだけ。候補は人が原文を読んで確かめてから、
// chinjo.jsonl の ref_copies（整数）と copies（原文の文）に入れる（確かめるまで入れない）。
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '.intake-cache', 'chinjo');
const DOC = /(資料|添付|別紙|付属|参考)/;
const NUM = /([0-9０-９]+|[一二三四五六七八九十百]+)\s*(部|通)|(議員|委員|議会)(の)?(人数|定数|数)分|人数分|全議員分|議員分|各議員/;
// 陳情書・請願書そのものの提出部数（1部・正副2部など）の文は、資料の語がなければ拾わない

function sentences(text) {
  return text.replace(/\r/g, '').split(/(?<=[。！？])|\n/).map((s) => s.trim()).filter((s) => s.length >= 8 && s.length <= 260);
}

function candidates() {
  const out = [];
  if (!fs.existsSync(DIR)) return out;
  for (const f of fs.readdirSync(DIR)) {
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { continue; }
    if (!p.text) continue;
    const hits = [...new Set(sentences(p.text).filter((s) => DOC.test(s) && NUM.test(s)))];
    if (hits.length) out.push({ id: p.id, url: p.url, fetched_at: p.fetched_at, hits });
  }
  return out;
}

if (require.main === module) {
  const c = candidates();
  if (process.argv.includes('--json')) console.log(JSON.stringify(c, null, 1));
  else {
    console.log(`候補のある議会：${c.length}`);
    for (const x of c) { console.log(`\n■ ${x.id}\n  ${x.url}`); x.hits.slice(0, 6).forEach((h) => console.log(`  ・${h}`)); }
  }
}
module.exports = { candidates, sentences };
