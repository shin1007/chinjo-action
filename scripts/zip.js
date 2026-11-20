// 日本郵便の郵便番号データ（utf_ken_all.csv）から、郵便番号 → 自治体の表を作る。
//   node scripts/zip.js <utf_ken_all.csv>
// 出典：日本郵便「郵便番号データダウンロード」 https://www.post.japanpost.jp/zipcode/download.html
// 書き出し先：site/data/zip/<上3けた>.json … { "下4けた": "都道府県/自治体の鍵（data/municipalities.js と同じ）" }
// 1つの郵便番号が2つ以上の自治体にまたがるときは「|」でつなぐ。作成画面は、入れた郵便番号の上3けたのファイルだけを読む。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site', 'data', 'zip');
const window = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'site', 'data', 'municipalities.js'), 'utf8'))(window);
const M = window.MUNICIPALITIES;

const csv = process.argv[2];
if (!csv) { console.error('使い方：node scripts/zip.js <utf_ken_all.csv>'); process.exit(1); }
const map = new Map();
const miss = new Set();
for (const line of fs.readFileSync(csv, 'utf8').split(/\r?\n/)) {
  if (!line) continue;
  const f = line.split(',').map((s) => s.replace(/^"|"$/g, ''));
  const [zip, pref, city] = [f[2], f[6], f[7]];
  const list = M[pref] || [];
  // 表記のゆれ（ケ・ヶ、惠・恵）と、伊豆諸島の「三宅島三宅村」のような島名つきの名前をそろえる
  const norm = (x) => x.replace(/[ケヶ]/g, 'ケ').replace(/惠/g, '恵');
  const find = (x) => list.find((m) => norm(m) === norm(x));
  // 政令指定都市の行政区は市にまとめる（東京23区はそのまま）
  const key = find(city) || find((city.match(/^(.+?市).+区$/) || [])[1] || '') || find(city.replace(/^.+島(?=.+[町村]$)/, ''));
  if (!key) { miss.add(`${pref}${city}`); continue; }
  const v = `${pref}/${key}`;
  const s = map.get(zip) || new Set();
  s.add(v); map.set(zip, s);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const files = {};
for (const [zip, s] of [...map].sort()) (files[zip.slice(0, 3)] ||= {})[zip.slice(3)] = [...s].join('|');
for (const [k, o] of Object.entries(files)) fs.writeFileSync(path.join(OUT, `${k}.json`), JSON.stringify(o));
// 頭2けた → 都道府県（郵便番号を2けた入れた段階で郵送の扱いの一覧を絞るため）
const p2 = {};
for (const [k, o] of Object.entries(files)) for (const v of Object.values(o)) for (const pk of v.split('|')) (p2[k.slice(0, 2)] ||= new Set()).add(pk.split('/')[0]);
fs.writeFileSync(path.join(OUT, 'p2.json'), JSON.stringify(Object.fromEntries(Object.entries(p2).sort().map(([k, s]) => [k, [...s]]))));
console.log(`${map.size}件の郵便番号を${Object.keys(files).length}ファイルに書き出しました`);
if (miss.size) console.log(`自治体の一覧にない市区町村（${miss.size}）：${[...miss].join('、')}`);
