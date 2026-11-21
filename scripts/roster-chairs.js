// 議員の名簿（site/data/roster/<都道府県>.json）の公式ページを開き直し、「議長」と書かれたすぐそばの名前を議長として足す。
//   node scripts/roster-chairs.js            … 全部の議会
//   node scripts/roster-chairs.js --only 東京都  … その都道府県だけ
//   node scripts/roster-chairs.js --show 東京都/墨田区 … 1件だけ見せる（書かない）
// 結果：各議会の行に chair（名簿の names のうちの1人）と chair_checked_at を書く。見つからない・2人以上の候補があるときは書かない。
// 議長は選挙や交代で変わるので、作成画面では「名簿から自動で読み取り。確かめてください」と出す。
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'site', 'data', 'roster');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const only = arg('--only');
const show = arg('--show');

async function get(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    if (!r.ok || /pdf/i.test(r.headers.get('content-type') || '')) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { return new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
  } catch { return ''; } finally { clearTimeout(timer); }
}

// 本文を1行の文字にする（空白は消して、名前を空白なしで探す）
const flatten = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
  .replace(/<rt>[\s\S]*?<\/rt>|<rp>[\s\S]*?<\/rp>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/[\s　]+/g, '');

function findChair(text, names) {
  const flat = names.map((n) => [n, n.replace(/ /g, '')]);
  const hits = new Map();
  // 「議長」（副議長・議長選挙などは除く）のすぐ後ろ15字か、すぐ前8字にある名前
  for (const m of text.matchAll(/議長/g)) {
    const i = m.index;
    if (text[i - 1] === '副' || /^議長(選|室|あて|宛|へ|の|が|は|交際|会|記者|挨拶|あいさつ|就任|として|職)/.test(text.slice(i, i + 5))) continue;
    const after = text.slice(i + 2, i + 17);
    const before = text.slice(Math.max(0, i - 8), i);
    for (const [n, f] of flat) {
      if (after.replace(/^[：:）)】-]{0,2}/, '').startsWith(f) || before.endsWith(f)) hits.set(n, (hits.get(n) || 0) + 1);
    }
  }
  return [...hits.keys()];
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let found = 0; let total = 0;
  for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('.'))) {
    const pref = file.replace(/\.json$/, '');
    if (only && pref !== only) continue;
    if (show && !show.startsWith(`${pref}/`)) continue;
    const p = path.join(DIR, file);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [id, r] of Object.entries(data)) {
      if (show && id !== show) continue;
      if (!r.url || !(r.names || []).length) continue;
      total++;
      const h = await get(r.url);
      const c = h ? findChair(flatten(h), r.names) : [];
      if (show) { console.log(id, r.url, c); continue; }
      if (c.length === 1) { r.chair = c[0]; r.chair_checked_at = today; found++; } else { delete r.chair; delete r.chair_checked_at; }
    }
    if (!show) fs.writeFileSync(p, `${JSON.stringify(data).replace(/,"(?=[^"]+\/)/g, ',\n"')}\n`);
    if (!show) console.log(pref, `${found}/${total}`);
  }
})();
