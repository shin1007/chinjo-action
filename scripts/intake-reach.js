// 「陳情が議員に届くと確かめられた議会」の数を、受け付け方のデータベースから数える（/coverage#reach と紹介動画の台本の数字の元）。
//   node scripts/intake-reach.js
// 数え方：住民の陳情について、持参・郵送・メール・フォーム・FAX のどれかが
//   review（審査する）なら「審査」、そうでなくどれかが distribute（配付・閲覧だけ）なら「配付だけ」に数える（1議会は1つにだけ数える）。
//   さらに、その値の根拠（fields が methods.*）に、公式サイトの引用で confidence が confirmed のものがあるかも数える。
const fs = require('fs');
const path = require('path');

const rows = fs.readFileSync(path.join(__dirname, '..', 'site', 'data', 'intake', 'chinjo.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

function classify(r) {
  const vals = Object.values(r.methods).map((m) => m.resident);
  if (vals.includes('review')) return 'review';
  if (vals.includes('distribute')) return 'distribute';
  return 'other';
}
function confirmed(r) {
  return (r.sources || []).some((s) => s.confidence === 'confirmed' && s.route !== 'auto_extract' && (s.fields || []).some((f) => f.startsWith('methods.')));
}

const out = { total: rows.length, review: 0, distribute: 0, reviewConfirmed: 0, distributeConfirmed: 0 };
for (const r of rows) {
  const c = classify(r);
  if (c === 'other') continue;
  out[c]++;
  if (confirmed(r)) out[c + 'Confirmed']++;
}
out.reach = out.review + out.distribute;
out.reachConfirmed = out.reviewConfirmed + out.distributeConfirmed;
if (require.main === module) console.log(JSON.stringify(out, null, 2));
module.exports = out;
