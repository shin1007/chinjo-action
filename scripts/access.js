// 議会事務局（なければ本庁舎）の位置と最寄り駅（data/access.js）を作る。
// 住所の位置は国土地理院の住所検索 API で調べ、駅は国土数値情報 鉄道データ（N02）を使う。
// 実行：node scripts/access.js <N02-xx_Station.geojson> [位置のキャッシュ.json]
//   住所を直したときや、駅のデータを新しくしたときに実行する。1自治体ごとに少し待つので、全部で30分ほどかかる。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const [stationFile, cacheFile = path.join(ROOT, 'scripts/.geocode-cache.json')] = process.argv.slice(2);
if (!stationFile) throw new Error('使い方：node scripts/access.js <N02-xx_Station.geojson>');

const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['data/prefs.js', 'data/municipalities.js', 'data/offices.js', 'data/councils.js', 'js/places.js']) {
  vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
}

// ---------- 駅：同じ名前で近くにあるもの（路線違い）は1つにまとめる ----------
const raw = JSON.parse(fs.readFileSync(stationFile, 'utf8')).features;
const stations = [];
for (const f of raw) {
  const c = f.geometry.coordinates;
  const lng = c.reduce((s, p) => s + p[0], 0) / c.length;
  const lat = c.reduce((s, p) => s + p[1], 0) / c.length;
  const name = f.properties.N02_005;
  const line = f.properties.N02_003;
  const same = stations.find((s) => s.name === name && dist(s, { lat, lng }) < 500);
  if (same) { if (!same.lines.includes(line)) same.lines.push(line); } else stations.push({ name, lat, lng, lines: [line] });
}

function dist(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.round(Math.sqrt(x * x + y * y) * R);
}

// ---------- 住所 → 位置 ----------
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function geocode(address) {
  if (address in cache) return cache[address];
  const r = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`);
  const j = r.ok ? await r.json() : [];
  // 細かく一致しないと、市区町村や都道府県の代表点が返ることがあるので、見つかった住所も残して確かめる
  cache[address] = j.length ? [...j[0].geometry.coordinates.map((v) => Math.round(v * 1e5) / 1e5), j[0].properties.title] : null;
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  await sleep(300);
  return cache[address];
}

(async () => {
  const out = {};
  let miss = 0;
  let rough = 0;
  const addr = (pl) => ctx.Places.office(pl.pref, pl.key).address.replace(/\s.*$/, '')
    // 「○○郡○○郡」と重なっている住所がある
    .replace(/(..郡)\1/, '$1');
  // 1件に数秒かかるので、4件ずつ並べて問い合わせる
  const todo = [...new Set(ctx.Places.all().map(addr).filter((a) => a && !(a in cache)))];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (todo.length) {
      await geocode(todo.shift());
      if (todo.length % 100 === 0) console.log('残り', todo.length);
    }
  }));
  for (const pl of ctx.Places.all()) {
    const { address } = ctx.Places.office(pl.pref, pl.key);
    // 見つかった住所に市区町村名が入っていなければ、別の場所に当たっている。市区町村の代表点で代える
    // 見つかった住所には郡名が入らず、ヶとケなどの書き方も違うので、そろえてから住所の市区町村名で比べる
    const norm = (t) => t.replace(/ヶ/g, 'ケ').replace(/檮/g, '梼').replace(/惠/g, '恵');
    const muni = norm((addr(pl).replace(pl.pref, '').replace(/^.+?郡/, '').match(/^.+?[市区町村]/) || [''])[0]);
    let pos = address && cache[addr(pl)];
    if (pos && !norm(pos[2]).includes(muni)) {
      console.warn('住所が細かく当たらない：', pl.pref, pl.key, addr(pl), '→', pos[2]);
      pos = await geocode(pl.pref + pl.key);
      rough++;
    }
    if (!pos) { miss++; console.warn('位置が分からない：', pl.pref, pl.key, address); continue; }
    const p = { lng: pos[0], lat: pos[1] };
    let best = null;
    for (const s of stations) { const d = dist(p, s); if (!best || d < best.d) best = { s, d }; }
    (out[pl.pref] ||= {})[pl.key] = [p.lat, p.lng, best.s.name, best.s.lines.join('・'), best.d];
  }
  const body = JSON.stringify(out).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"');
  fs.writeFileSync(path.join(SITE, 'data/access.js'), `// 自動で作ったファイル（node scripts/access.js）。手で直さない。
// 議会事務局（なければ本庁舎）の位置と最寄り駅。キーは data/offices.js と同じ。
// → [緯度, 経度, 最寄り駅, 路線, 駅からの直線距離(m)]
// 出典：位置は国土地理院の住所検索（地理院地図）、駅は国土数値情報（鉄道データ N02-24）国土交通省 を加工して作成
window.ACCESS = ${body};
`);
  console.log('できた。位置が分からなかった自治体：', miss, '／市区町村の代表点で代えた自治体：', rough);
})();
