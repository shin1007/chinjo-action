// テーマの項目の refs と data/archive-index.json の URL が開けるかを確かめ、結果を書き出す。
//   node scripts/check-links.js            … すべて確かめる
//   node scripts/check-links.js --theme kenko … 1つのテーマだけ
// 結果：scripts/.link-check.md（Git には入れない）。403 などのボット拒否は「要ブラウザ確認」として分ける。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const arg = process.argv.indexOf('--theme');
const only = arg > 0 ? process.argv[arg + 1] : null;
const THEMES = fs.readdirSync(path.join(SITE, 'themes')).filter((d) => (!only || d === only) && fs.existsSync(path.join(SITE, 'themes', d, 'asks-national.js')));

const urls = new Map(); // url -> 使っている場所
const add = (url, where) => { if (!/^https?:/.test(url || '')) return; if (!urls.has(url)) urls.set(url, []); urls.get(url).push(where); };
for (const theme of THEMES) {
  const window = {};
  for (const f of ['asks-national.js', 'asks-local.js']) {
    const p = path.join(SITE, 'themes', theme, f);
    if (fs.existsSync(p)) new Function('window', fs.readFileSync(p, 'utf8'))(window);
  }
  for (const a of window.ASKS || []) for (const r of a.refs || []) add(r.url, `${theme}/${a.id}`);
}
if (!only) for (const p of JSON.parse(fs.readFileSync(path.join(SITE, 'data/archive-index.json'), 'utf8')).pages || []) add(p.url, 'archive-index');

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (link-check)' } });
      if (res.ok || method === 'GET') return String(res.status);
    } catch (e) { if (method === 'GET') return `ERR ${e.cause?.code || e.name}`; }
  }
}

(async () => {
  const list = [...urls.keys()];
  const results = [];
  for (let i = 0; i < list.length; i += 8) {
    const batch = list.slice(i, i + 8);
    results.push(...await Promise.all(batch.map(async (u) => [u, await check(u)])));
    process.stdout.write(`\r${Math.min(i + 8, list.length)}/${list.length}`);
  }
  const isBroken = (s) => s === '404' || s === '410' || s.startsWith('ERR');
  const broken = results.filter(([, s]) => isBroken(s));
  const blocked = results.filter(([, s]) => !/^2/.test(s) && !isBroken(s));
  const line = ([u, s]) => `- ${s} ${u}（${urls.get(u).join('、')}）`;
  const md = [`# リンクの確認（${new Date().toISOString().slice(0, 10)}、${list.length}件）`, '',
    `## 開けない（404・410・接続できない）：${broken.length}件`, ...broken.map(line), '',
    `## 要ブラウザ確認（403・5xx など）：${blocked.length}件`, ...blocked.map(line), ''].join('\n');
  fs.writeFileSync(path.join(__dirname, '.link-check.md'), md);
  console.log(`\n開けない ${broken.length}件、要ブラウザ確認 ${blocked.length}件 → scripts/.link-check.md`);
})();
