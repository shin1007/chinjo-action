#!/usr/bin/env node
// 都道府県・市区町村の議会の「議員名簿」のページを、公式サイトのリンクをたどって探す。
//   node scripts/roster-find.js                 … 都道府県と、人口の多い順に市区町村をまだ探していない分だけ
//   node scripts/roster-find.js --next 200      … 市区町村は人口の多い順に200件まで（既定は100）
//   node scripts/roster-find.js --only 東京都   … その都道府県（と中の市区町村）だけ探し直す
// 結果：site/data/roster.json（{ "東京都/@": {url, title, found_at}, ... }。/letter の郵便番号の結果に「議員名簿（公式）」として出す）
// 見つからなかったもの：docs/調査/議員名簿のページが見つからない議会.md
// 探し方：陳情の案内ページ・議会のページ・都道府県議会の名簿の URL（pref-assembly-urls.js）・公式サイトを開き、
// 「議員名簿」「議員一覧」「議員紹介」などの文字のリンクを探す。なければ「議会」のリンクを1段たどって同じように探す。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const OUT = path.join(DATA, 'roster.json');
const LOG = path.join(ROOT, 'docs', '調査', '議員名簿のページが見つからない議会.md');
const today = () => new Date().toISOString().slice(0, 10);

const ROSTER = /議員名簿|議員一覧|議員紹介|議員の紹介|議員の一覧|議員の名簿|議員を紹介|所属議員|議員プロフィール|議員情報/;
const NOT = /歴代|元議員|議員報酬|政務活動|資産|辞職|選挙結果|会議録/;
const COUNCIL = /議会/;

async function page(url) {
  // intake-fetch の get はフォームなどのリンクだけ返すので、ここで全部のリンクを取る
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    if (!r.ok || /pdf/i.test(r.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const links = [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map(([, h, t]) => {
      try { return { href: new URL(h, r.url).href, text: t.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1').replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim() }; } catch { return null; }
    }).filter((l) => l && /^https?:/.test(l.href));
    return { url: r.url, title, links };
  } catch { return null; } finally { clearTimeout(timer); }
}

const pick = (p) => p && p.links.find((l) => ROSTER.test(l.text) && !NOT.test(l.text) && l.text.length <= 30);

async function find(starts) {
  const seen = new Set();
  const second = [];
  for (const s of starts) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    const p = await page(s);
    if (!p) continue;
    if (ROSTER.test(p.title) && !NOT.test(p.title)) return { url: p.url, title: p.title };
    const hit = pick(p);
    if (hit) return { url: hit.href, title: hit.text };
    const host = new URL(p.url).host;
    second.push(...p.links.filter((l) => COUNCIL.test(l.text) && l.text.length <= 15 && new URL(l.href).host === host).map((l) => l.href).slice(0, 3));
  }
  for (const s of second) {
    if (seen.has(s)) continue;
    seen.add(s);
    const hit = pick(await page(s));
    if (hit) return { url: hit.href, title: hit.text };
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const ni = args.indexOf('--next');
  const next = ni >= 0 ? Number(args[ni + 1]) : 100;
  const only = args.flatMap((a, i) => (args[i - 1] === '--only' ? [a] : []));
  global.window = {};
  require(path.join(DATA, 'sites.js'));
  require(path.join(DATA, 'pref-assembly-urls.js'));
  const prefUrl = Object.fromEntries((window.PREF_ASSEMBLY_URLS || []).map((p) => [p.pref, p.membersListUrl]));
  const rows = fs.readFileSync(path.join(DATA, 'intake', 'chinjo.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const inOnly = (id) => !only.length || only.some((o) => id === o || id.startsWith(o.includes('/') ? o : `${o}/`));
  const prefs = rows.filter((r) => r.level === 'pref');
  const munis = rows.filter((r) => r.level !== 'pref').sort((a, b) => (b.population || 0) - (a.population || 0));
  const todo = only.length
    ? rows.filter((r) => inOnly(r.id))
    : [...prefs.filter((r) => !(r.id in out)), ...munis.filter((r) => !(r.id in out)).slice(0, next)];
  console.error(`${todo.length} 件を探す`);
  let done = 0;
  const queue = [...todo];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let r; (r = queue.shift());) {
      const key = r.level === 'pref' ? '@' : r.name;
      const s = (window.SITES[r.pref] || {})[key] || [];
      const hit = await find([r.level === 'pref' ? prefUrl[r.pref] : null, s[2], s[1], r.page_url, s[0]]);
      out[r.id] = hit ? { url: hit.url, title: hit.title, found_at: today() } : { url: null, found_at: today() };
      if (++done % 50 === 0) console.error(`${done}/${todo.length}`);
    }
  }));
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  fs.writeFileSync(OUT, JSON.stringify(sorted, null, 0).replace(/,"(?=[^"]+\/)/g, ',\n"') + '\n');
  const miss = Object.entries(sorted).filter(([, v]) => !v.url);
  fs.writeFileSync(LOG, [
    '# 議員名簿のページが見つからない議会',
    '',
    `\`node scripts/roster-find.js\` が書き出す（最後に走らせた日：${today()}）。公式サイトのリンクをたどっても「議員名簿」などのページが見つからなかった議会。`,
    'ブラウザで名簿のページを見つけたら、その URL を伝えてもらえれば site/data/roster.json に足す。',
    '',
    ...miss.map(([id]) => {
      const [p, m] = id.split('/');
      const name = m === '@' ? `${p}議会` : `${p}${m.replace(/^.+?郡/, '')}議会`;
      return `- [ ] ${name}：[検索](https://www.google.com/search?q=${encodeURIComponent(`${name} 議員名簿`)})`;
    }),
    '',
  ].join('\n'));
  const found = Object.values(sorted).filter((v) => v.url).length;
  console.error(`見つかった ${found} 件・見つからない ${miss.length} 件（${path.relative(ROOT, LOG)}）`);
}
main();
