#!/usr/bin/env node
// 回答の一覧を JavaScript で表示しているサイト（例：福岡市）や、ふつうの取得を断るサイトを、本物のブラウザ（Playwright）で開いて
// リンクを集め直す。scripts/kaito-fetch.js の結果（scripts/.intake-cache/kaito/*.json）の lists を書き換える。
//   node scripts/kaito-render.js [id ...]      … 指定がなければ、一覧のリンクが20より少ないか、一覧を開けなかったものすべて
// Playwright はリポジトリに入れない。PLAYWRIGHT_DIR（既定 ~/.claude/tools/browser）の node_modules から読む。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const PW = process.env.PLAYWRIGHT_DIR || path.join(os.homedir(), '.claude', 'tools', 'browser');
const { chromium } = require(path.join(PW, 'node_modules', 'playwright'));
const CACHE = path.join(__dirname, '.intake-cache', 'kaito');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const dirOf = (u) => { const x = new URL(u); return x.origin + x.pathname.replace(/[^/]*$/, ''); };

async function linksOf(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch { /* 時間切れでも、出ている分は読む */ }
  const title = await page.title().catch(() => '');
  const links = await page.$$eval('a[href]', (as) => as.map((a) => ({ u: a.href.split('#')[0], t: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) }))).catch(() => []);
  return { title, links: links.filter((l) => /^https?:/.test(l.u) && l.t) };
}

async function main() {
  const only = process.argv.slice(2);
  const files = fs.readdirSync(CACHE).map((f) => path.join(CACHE, f));
  const todo = files.map((f) => ({ f, d: JSON.parse(fs.readFileSync(f, 'utf8')) })).filter(({ d }) => {
    if (only.length) return only.includes(d.id);
    const best = (d.candidates || [])[0];
    if (!best || best.s < 3 || /\.pdf/i.test(best.u)) return false;
    const l = (d.lists || [])[0];
    return !l || l.error || (l.items || []).length < 20;
  });
  console.error(`${todo.length} 件をブラウザで開き直す`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ locale: 'ja-JP', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' });
  for (const { f, d } of todo) {
    const best = d.candidates[0];
    const top = await linksOf(page, best.u);
    const same = top.links.filter((l) => host(l.u) === host(best.u));
    const base = dirOf(best.u);
    const list = { u: best.u, t: top.title || best.t, rendered: true, items: same.map((l) => ({ ...l, d: 0 })) };
    const subs = [...new Map(same.filter((l) => l.u.startsWith(base) && l.u !== best.u && !/\.pdf/i.test(l.u) && /年度|年|月|分野|一覧|件|号|回答|ご意見|分類|カテゴリ|・|^[0-9０-９]/.test(l.t)).map((l) => [l.u, l])).values()].slice(0, 15);
    for (const s of subs) {
      await wait(1000);
      const q = await linksOf(page, s.u);
      q.links.filter((l) => host(l.u) === host(best.u)).forEach((l) => list.items.push({ ...l, d: 1, from: s.u }));
    }
    const m = new Map();
    list.items.forEach((l) => { const o = m.get(l.u); if (!o) m.set(l.u, { ...l, n: 1 }); else { o.n += 1; if (l.t.length > o.t.length) o.t = l.t; } });
    list.items = [...m.values()];
    list.pages = 1 + subs.length;
    d.lists = [list, ...(d.lists || []).filter((l) => l.u !== best.u)];
    fs.writeFileSync(f, JSON.stringify(d));
    console.error(`${d.id}\t${list.t}\t${list.items.length}`);
    await wait(1500);
  }
  await browser.close();
}
main();
