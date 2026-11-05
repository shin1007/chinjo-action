// 市民が役所（市長の側）に意見を送れるページ（「市長への手紙」「市民の声」など）の候補を、各自治体の公式サイトから探す。
// 公式サイトは data/sites.js のものを使い、トップページのリンクと、そこから1段たどった「お問い合わせ」などのページのリンクを見る。
// ページのタイトルか見出しに言葉があるものだけを残し、data/candidates/opinion-unverified.csv に書き出す。
// 自動で見つけたものなので、サイトで使う前に1件ずつ確かめる。
//   node scripts/opinion.js            … 全部の自治体（ページをキャッシュするので、途中で止めても続きから進む）
//   node scripts/opinion.js 福岡県     … 1つの都道府県だけ
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data/candidates/opinion-unverified.csv');
const CACHE = path.join(ROOT, 'scripts/.opinion-cache.json');
const onlyPref = process.argv[2];

const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/sites.js'), 'utf8'), ctx, { filename: 'data/sites.js' });

// 意見を送るページの名前。パブリックコメントは期間と案件が決まっているので入れない
const WORDS = /市長への(手紙|提案|メール|ご意見)|知事への(手紙|提案|メール|ご意見)|町長への(手紙|提案)|村長への(手紙|提案)|区長への(手紙|提案)|(市民|町民|村民|区民|県民|府民|都民|道民)の(声|ご意見|意見)|ご意見・ご提案|ご意見・ご要望|意見・提案|ご意見箱|提案箱|ＷＥＢ提案箱/;
// 1段たどる入口になりやすいリンク
const HUBS = /お問い合わせ|お問合せ|ご意見|広聴|広報・広聴|市政への参加|町政への参加|村政への参加|県政への参加|市民参加|サイトマップ/;
const NOT = /パブリックコメント|パブコメ|議会|陳情|請願|アンケート結果|回答一覧|公表|ご紹介|紹介します/;

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
let unsaved = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Shift_JIS や EUC-JP のサイトがまだあるので、ヘッダーか meta の文字コードで読む
async function get(url) {
  if (url in cache) return cache[url];
  let html = null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (chinjo opinion-page finder)' } });
    if (r.ok && /html/.test(r.headers.get('content-type') || 'text/html')) {
      const buf = Buffer.from(await r.arrayBuffer());
      const head = buf.subarray(0, 2048).toString('latin1');
      const cs = ((r.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || head.match(/charset=["']?([\w-]+)/i) || [, 'utf-8'])[1];
      try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = new TextDecoder().decode(buf); }
    }
  } catch { /* つながらないサイトは飛ばす */ }
  cache[url] = html;
  if (++unsaved >= 20) save();
  await sleep(500);
  return html;
}
function save() { fs.writeFileSync(CACHE, JSON.stringify(cache)); unsaved = 0; }

const strip = (s) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s+/g, ' ').trim();
function links(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = strip(m[2]) || (m[2].match(/alt=["']([^"']*)/) || [, ''])[1];
    try { out.push({ url: new URL(m[1].replace(/&amp;/g, '&'), base).href, text }); } catch { /* 壊れたリンク */ }
  }
  return out;
}
const heading = (html) => strip([html.match(/<title[^>]*>([\s\S]*?)<\/title>/i), html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)].map((m) => (m ? m[1] : '')).join(' / '));
const sameSite = (a, b) => new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '');

async function find(site) {
  const top = await get(site);
  if (!top) return null;
  const all = links(top, site).filter((l) => sameSite(l.url, site));
  let hits = all.filter((l) => WORDS.test(l.text) && !NOT.test(l.text));
  if (!hits.length) {
    for (const hub of all.filter((l) => HUBS.test(l.text)).slice(0, 3)) {
      const h = await get(hub.url);
      if (h) hits.push(...links(h, hub.url).filter((l) => sameSite(l.url, site) && WORDS.test(l.text) && !NOT.test(l.text)));
      if (hits.length) break;
    }
  }
  for (const l of [...new Map(hits.map((x) => [x.url, x])).values()].slice(0, 3)) {
    const h = await get(l.url);
    const title = h && heading(h);
    if (title && WORDS.test(title) && !NOT.test(title)) return { url: l.url, title };
  }
  return null;
}

(async () => {
  const rows = [['都道府県', '市区町村', 'URL', 'ページの見出し']];
  let n = 0, found = 0;
  for (const [pref, cities] of Object.entries(ctx.SITES)) {
    if (onlyPref && pref !== onlyPref) continue;
    for (const [city, [site]] of Object.entries(cities)) {
      n++;
      const hit = site && await find(site);
      if (hit) { found++; rows.push([pref, city === '@' ? pref : city, hit.url, hit.title]); }
    }
    console.log(`${pref}：ここまでに ${found}/${n}`);
  }
  save();
  const csv = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  fs.writeFileSync(OUT, rows.map((r) => r.map(csv).join(',')).join('\n') + '\n');
  console.log(`${found}/${n} の自治体で見つかりました → ${path.relative(ROOT, OUT)}`);
})();
