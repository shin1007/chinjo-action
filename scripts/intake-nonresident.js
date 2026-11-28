// 住民以外（自治体の外に住む人）の陳情の扱いを、案内ページの原文で確かめて chinjo.jsonl に書き込む。
//   node scripts/intake-nonresident.js <spec.jsonl>
// spec の1行：{"id","url","quote","checked_at","who","methods":["mail"]|["all"],"effect","unless","set":{"mail":"distribute",...},"note"}
//   effect：distribute 審査せず配付・回覧だけ／not_reviewed 審査しない（配付するかは書いていない）／may_distribute 議長などの判断で審査しないことがある／as_request 要望書として扱う／no 受け付けない
//   set：methods.<出し方>.nonresident に入れる値（はっきり書いてあるときだけ）
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'site/data/intake/chinjo.jsonl');
const rows = fs.readFileSync(FILE, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const byId = new Map(rows.map((r) => [r.id, r]));
const specs = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('//')).map((l) => JSON.parse(l));
let n = 0;
for (const s of specs) {
  const r = byId.get(s.id);
  if (!r) { console.error('ない：' + s.id); process.exitCode = 1; continue; }
  r.nonresident_rule = { who: s.who, methods: s.methods, effect: s.effect, ...(s.unless ? { unless: s.unless } : {}) };
  const fields = ['nonresident_rule'];
  for (const [m, v] of Object.entries(s.set || {})) { r.methods[m].nonresident = v; fields.push(`methods.${m}.nonresident`); }
  if (s.resident) for (const [m, v] of Object.entries(s.resident)) { r.methods[m].resident = v; fields.push(`methods.${m}.resident`); }
  r.sources = (r.sources || []).filter((x) => x.from !== 'intake-nonresident');
  r.sources.push({ fields, quote: s.quote, url: s.url, checked_at: s.checked_at, route: 'official_site', confidence: s.confidence || 'confirmed', from: 'intake-nonresident' });
  if (s.note) r.note = r.note && !r.note.includes(s.note) ? `${r.note} ${s.note}` : s.note;
  n++;
}
fs.writeFileSync(FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`${n} 件を書き込んだ`);

// --anyone：案内ページ（scripts/.intake-cache/chinjo）に「どなたでも提出できます」などとある議会に anyone_can_submit: "yes" を付ける。
// 「出せる」と書いてあるだけで、住民以外の陳情も審査するとは限らない（nonresident_rule がある議会には付けない）。
if (process.argv.includes('--anyone')) {
  const CACHE = path.join(__dirname, '.intake-cache', 'chinjo');
  const RE = /(どなたでも|誰でも|だれでも|住所.{0,10}(を問わ|に関係な|にかかわらず))/;
  let m = 0;
  for (const r of rows) {
    if (r.nonresident_rule || r.anyone_can_submit) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(CACHE, r.id.replace('/', '_') + '.json'), 'utf8')); } catch { continue; }
    if (!j.text) continue;
    const s = j.text.replace(/\s+/g, ' ').split(/(?<=。)/).map((x) => x.trim()).find((x) => RE.test(x) && /陳情/.test(x) && x.length < 200);
    if (!s) continue;
    const q = s.slice(Math.max(0, s.search(RE) - 60)).trim();
    r.anyone_can_submit = 'yes';
    r.sources.push({ fields: ['anyone_can_submit'], quote: q, url: j.finalUrl || j.url, checked_at: j.fetched_at, route: 'official_site', confidence: 'likely', from: 'intake-nonresident --anyone' });
    m++;
  }
  fs.writeFileSync(FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`anyone_can_submit を ${m} 件に付けた`);
}
