#!/usr/bin/env node
// 陳情の案内ページ（page_url）がまだない議会について、議会のページ（なければ市区町村の公式サイト）から
// 「陳情」「請願」のリンクをたどって探し、見つかったら site/data/intake/chinjo.jsonl の page_url に入れる。
//   node scripts/intake-find.js [--apply]
// 探した結果は scripts/.intake-cache/find.json に残す（公開しない）。見つからなかった議会は
// docs/調査/陳情の案内ページが見つからない議会.md に書く（あとでブラウザで探せるように）。
// 見つけたページは「陳情」「請願」の語を本文に含むものだけ。出し方の読み取りは intake-fetch.js → intake-extract.js で行う。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const CACHE = path.join(__dirname, '.intake-cache');
const OUT = path.join(CACHE, 'find.json');

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    const ct = r.headers.get('content-type') || '';
    if (r.status >= 400 || /pdf|zip|octet/i.test(ct)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    const links = [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(([, h, tx]) => {
      try { return { href: new URL(h, r.url).href, text: strip(tx).slice(0, 100) }; } catch { return null; }
    }).filter(Boolean);
    return { url: r.url, text: strip(html), links, title: strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') };
  } catch { return null; } finally { clearTimeout(t); }
}

const PET = /陳情|請願/;
const BADTEXT = /会議録|議案|一般質問|傍聴|議員名簿|委員会名簿|審議結果|結果一覧|採択|不採択|[令平]和\d+年.*(陳情|請願)(一覧|文書表)|文書表/;
const sameSite = (a, b) => { try { const x = new URL(a).host.replace(/^www\d?\./, ''), y = new URL(b).host.replace(/^www\d?\./, ''); return x.split('.').slice(-3).join('.') === y.split('.').slice(-3).join('.'); } catch { return false; } };

async function findFor(starts) {
  const seen = new Set();
  let budget = 14;
  const score = (l) => {
    let s = 0;
    if (/(陳情|請願).{0,6}(の(出し方|提出|手続|方法|受付|受け付け|流れ)|について|を(出|提出)|する(方|場合)|案内)/.test(l.text) || /(出し方|提出|手続).{0,8}(陳情|請願)/.test(l.text)) s += 6;
    if (PET.test(l.text)) s += 3;
    if (PET.test(l.href) || /chinjo|seigan/i.test(l.href)) s += 2;
    if (BADTEXT.test(l.text)) s -= 5;
    if (/\.(pdf|docx?|xlsx?)(\?|$)/i.test(l.href)) s -= 9;
    return s;
  };
  const toVisit = starts.filter(Boolean).map((u) => ({ u, d: 0 }));
  while (toVisit.length && budget > 0) {
    const { u, d } = toVisit.shift();
    if (seen.has(u)) continue;
    seen.add(u); budget--;
    const p = await get(u);
    if (!p) continue;
    // このページ自体が出し方の案内か
    if (d > 0 && PET.test(p.title) && !BADTEXT.test(p.title) && /提出|受け付け|受付|出し方|手続/.test(p.text.slice(0, 4000))) return { url: p.url, title: p.title };
    // 傍聴・議会のしくみなどのページに、陳情・請願の出し方の文があればそのページ
    if (d > 0 && p.text.split(/(?<=。)/).some((x) => PET.test(x) && /(提出|受け付け|受付|出す|出し)/.test(x) && /(でき|ください|します|いたします|必要|議長|議会)/.test(x) && x.length < 300) && !/会議録|議案第|文書表/.test(p.title)) return { url: p.url, title: p.title };
    const ranked = p.links.filter((l) => sameSite(l.href, p.url) && !seen.has(l.href)).map((l) => ({ ...l, s: score(l) })).filter((l) => l.s >= 3).sort((a, b) => b.s - a.s);
    // 点の高いリンクは先に確かめる
    for (const l of ranked.slice(0, 3)) toVisit.unshift({ u: l.href, d: d + 1 });
    if (d === 0 && !ranked.length) {
      // 議会のトップへ（議会のページから見つからないとき）
      const g = p.links.filter((l) => sameSite(l.href, p.url) && !seen.has(l.href) && /議会(事務局)?$|^議会|市議会|町議会|村議会|区議会|県議会|議会について|議会のページ|議会トップ/.test(l.text) && !/傍聴|中継|会議録|議員/.test(l.text)).slice(0, 2);
      for (const l of g) toVisit.push({ u: l.href, d: 0.5 });
    }
    if (d === 0.5 && !ranked.length) {
      const g = p.links.filter((l) => sameSite(l.href, p.url) && !seen.has(l.href) && /議会に(ついて|関する)|請願|陳情|傍聴|議会のしくみ|仕組み|ご利用案内|議会案内|よくある|Q&A|手続|くらし|市民|町民|村民|区民/.test(l.text)).slice(0, 2);
      for (const l of g) toVisit.push({ u: l.href, d: 0.75 });
    }
  }
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  global.window = {};
  require(path.join(DATA, 'sites.js'));
  const file = path.join(DATA, 'intake', 'chinjo.jsonl');
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  fs.mkdirSync(CACHE, { recursive: true });
  const found = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const todo = rows.filter((r) => {
    const s = ((window.SITES[r.pref] || {})[r.level === 'pref' ? '@' : r.name]) || [];
    return !r.page_url && !s[1] && !(r.id in found);
  });
  console.error(`探す議会：${todo.length}`);
  const queue = todo.slice();
  let n = 0;
  async function worker() {
    for (;;) {
      const r = queue.shift();
      if (!r) return;
      const s = ((window.SITES[r.pref] || {})[r.level === 'pref' ? '@' : r.name]) || [];
      const res = await findFor([s[2], s[0]]);
      found[r.id] = res || null;
      if (++n % 40 === 0) { console.error(`  ${n}/${todo.length}`); fs.writeFileSync(OUT, JSON.stringify(found)); }
    }
  }
  await Promise.all(Array.from({ length: 24 }, worker));
  fs.writeFileSync(OUT, JSON.stringify(found));
  const hit = rows.filter((r) => found[r.id]);
  console.error(`見つかった：${hit.length} / 見つからない：${rows.filter((r) => r.id in found && !found[r.id]).length}`);
  if (apply) {
    for (const r of hit) if (!r.page_url) r.page_url = found[r.id].url;
    fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const miss = rows.filter((r) => !r.page_url && !(((window.SITES[r.pref] || {})[r.level === 'pref' ? '@' : r.name]) || [])[1]);
    const md = '# 陳情の案内ページが見つからない議会\n\nscripts/intake-find.js が、議会のページ（なければ市区町村の公式サイト）から「陳情」「請願」のリンクを探したが、見つからなかったもの。ブラウザで議会のサイトを開いて、出し方の案内ページを探して、site/data/intake/chinjo.jsonl の page_url に入れる。\n\n| 自治体 | 議会のページ（なければ公式サイト） |\n|---|---|\n' +
      miss.map((r) => { const s = ((window.SITES[r.pref] || {})[r.level === 'pref' ? '@' : r.name]) || []; return `| ${r.id} | ${s[2] || s[0] || ''} |`; }).join('\n') + '\n';
    fs.writeFileSync(path.join(ROOT, 'docs', '調査', '陳情の案内ページが見つからない議会.md'), md);
    console.error(`page_url を ${hit.length} 件入れた`);
  }
}
main();
