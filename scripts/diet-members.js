#!/usr/bin/env node
// 国会議員の名簿（site/data/diet-members.js、/letter の「国会議員を名前や会派で探す」）を、
// 衆議院・参議院の公式サイトの議員一覧から作り直す。改選・補欠選挙のあとと、毎月に走らせる（.github/workflows/intake-verify.yml）。
//   node scripts/diet-members.js
// 会派は公式の一覧の略称のまま（例：自民・立憲）。X のアカウントは公式の一覧にないので、前の名簿にあった分だけ引き継ぐ。
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'site', 'data', 'diet-members.js');
const SHU = 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm';
const SAN_INDEX = 'https://www.sangiin.go.jp/jpn/gikai/giin_index.html';

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const sjis = /shift_jis/i.test(r.headers.get('content-type') || '') || /charset=Shift_JIS/i.test(buf.subarray(0, 2000).toString('latin1'));
  return new TextDecoder(sjis ? 'shift_jis' : 'utf-8').decode(buf);
}
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[\s　]+/g, '').trim();
const cells = (tr) => [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);

async function shugiin() {
  const first = await get(SHU);
  const pages = [...new Set([SHU, ...[...first.matchAll(/href=["']?(\d+giin\.htm)/gi)].map((m) => new URL(m[1], SHU).href)])];
  const out = [];
  for (const p of pages) {
    const html = p === SHU ? first : await get(p);
    for (const [tr] of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const c = cells(tr);
      const a = tr.match(/href=['"]([^'"]*profile\/\d+\.html)['"]/i);
      if (c.length < 4 || !a) continue;
      const name = text(c[0]).replace(/君$/, '');
      const d = text(c[3]);
      const m = d.match(/^(.+?)(\d+)$/);
      out.push({ name, kana: text(c[1]), house: '衆', district: d.startsWith('（比）') ? `比例・${d.slice(3)}` : m ? `${m[1]}${m[2]}区` : d, party: text(c[2]), officialUrl: new URL(a[1], p).href });
    }
  }
  return out;
}

async function sangiin() {
  const idx = await get(SAN_INDEX);
  const rel = (idx.match(/href=["']([^"']*kousei\/giin\/\d+\/giin\.htm)["']/i) || [])[1];
  if (!rel) throw new Error('参議院の議員一覧のリンクが見つからない');
  const url = new URL(rel, SAN_INDEX).href;
  const html = await get(url);
  const out = [];
  for (const [tr] of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const c = cells(tr);
    const a = tr.match(/href=["']([^"']*profile\/\d+\.htm)["']/i);
    if (c.length < 5 || !a) continue;
    out.push({ name: text(c[0]), kana: text(c[1]), house: '参', district: text(c[3]), party: text(c[2]), term: text(c[4]), officialUrl: new URL(a[1], url).href });
  }
  return { url, out };
}

async function main() {
  const old = {};
  try { global.window = {}; require(OUT); for (const m of window.DIET_MEMBERS || []) if (m.xHandle) old[m.name] = m.xHandle; } catch { /* 初回 */ }
  const shu = await shugiin();
  const san = await sangiin();
  // 定数（衆465・参248）から大きく外れたら、ページの形が変わったとみて書かない
  if (shu.length < 400 || shu.length > 470 || san.out.length < 200 || san.out.length > 250) {
    throw new Error(`人数がおかしい（衆 ${shu.length}・参 ${san.out.length}）。ページの形が変わったかもしれない`);
  }
  const all = [...shu, ...san.out].map((m) => (old[m.name] ? { ...m, xHandle: old[m.name] } : m));
  const today = new Date().toISOString().slice(0, 10);
  const body = [
    '// 国会議員の名簿。scripts/diet-members.js で公式サイトの議員一覧から作る（手で直さない）。',
    `// 取った日：${today}`,
    `// 出典：衆議院「議員一覧」${SHU} ／ 参議院「議員一覧」${san.url}`,
    '// 会派は公式の一覧の略称のまま。xHandle は前の名簿から引き継いだもの（公式の一覧にはない）。',
    `window.DIET_MEMBERS_AS_OF = '${today}';`,
    'window.DIET_MEMBERS = [',
    ...all.map((m) => `  ${JSON.stringify(m)},`),
    '];',
    '',
  ].join('\n');
  fs.writeFileSync(OUT, body);
  console.error(`衆 ${shu.length} 人・参 ${san.out.length} 人を書いた`);
}
main().catch((e) => { console.error(String(e)); process.exit(1); });
