#!/usr/bin/env node
// 首長あての要望・市民の声で、過去に寄せられた意見と回答を公開しているページ（回答の一覧）を探し、
// その一覧と、一覧からたどれる下のページ（年度別・分野別）のリンクを手元に集める。
//   node scripts/kaito-fetch.js [--refetch] [id ...]
// 出発点は site/data/intake/yobo.jsonl の page_url（要望の案内ページ）。
// 結果は scripts/.intake-cache/kaito/<id>.json（ページ本文は置かない。リンクの文字とURLだけ）。
// 取れなかったものは docs/確認用/回答の一覧を取得できなかった自治体.md に書く。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.intake-cache', 'kaito');
const fileOf = (id) => path.join(CACHE, id.replace(/[\\/:*?"<>|]/g, '_') + '.json');

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    const ct = r.headers.get('content-type') || '';
    if (!/html/i.test(ct)) return { status: r.status, error: ct.split(';')[0] || 'not html', finalUrl: r.url };
    const buf = Buffer.from(await r.arrayBuffer());
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ');
    const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const links = [];
    for (const [, h, tx] of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      try {
        const u = new URL(h.trim(), r.url);
        if (!/^https?:$/.test(u.protocol)) continue;
        const text = strip(tx).slice(0, 120);
        if (text) links.push({ u: u.href, t: text });
      } catch { /* 壊れたリンク */ }
    }
    return { status: r.status, finalUrl: r.url, title, links };
  } catch (e) {
    return { status: 0, error: String(e.cause && e.cause.code || e.name || e) };
  } finally { clearTimeout(t); }
}

// 回答の一覧らしいリンクの文字
const VOICE = /声|こえ|意見|提案|提言|要望|ご質問|手紙|メール|はがき|ポスト|広聴|対話/;
const PUBLISHED = /寄せられ|いただい|頂い|公表|公開|紹介|主な|回答|事例|Q&A|Ｑ＆Ａ|と市の考え|と区の考え|と町の考え|と村の考え|と県の考え|への考え方|対応状況|一覧|お答え|提言集|意見集|回答集|とその回答|への回答|に活か|にいかし|を活か|をいかし|に反映/;
const NOT = /募集|パブリック|子ども議会|審議会|アンケート|入力|送信|フォーム|様式|受付|投稿する|お問い合わせ先|個人情報|サイトマップ|English|ふりがな|文字サイズ|ログイン/;
const score = (t) => (VOICE.test(t) && PUBLISHED.test(t) && !NOT.test(t) ? 2 + (/回答|考え|お答え/.test(t)) + (/寄せられ|いただい|頂い|公表|公開|紹介/.test(t)) + (/一覧|事例|改善|Q&A|Ｑ＆Ａ|から生まれた|集$|集（|集\(/.test(t)) : 0);

const sameSite = (a, b) => {
  try { return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, ''); } catch { return false; }
};
const dirOf = (u) => { const x = new URL(u); return x.origin + x.pathname.replace(/[^/]*$/, ''); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let lastSearch = 0;
const GAP = +(process.env.SEARCH_GAP_MS || 30000);
const NOSEARCH = process.argv.includes('--no-search');
async function search(url, name) {
  let host;
  try { host = new URL(url).hostname; } catch { return []; }
  const out = [];
  for (const q of [`site:${host} 寄せられた 意見 回答`, `site:${host} 提案 回答 公開`]) {
    // 断られたら（429）、同じ検索を20分あけてやり直す（3回まで）。Yahoo! は1分に数回より速いと断る
    for (let tries = 0; ; tries++) {
    const w = GAP - (Date.now() - lastSearch);
    lastSearch = Date.now() + Math.max(0, w);
    if (w > 0) await wait(w);
    try {
      // DuckDuckGo はすぐ断るので、Yahoo! JAPAN の検索を使う（2026-11-13）
      const r = await fetch(`https://search.yahoo.co.jp/search?p=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'ja' }, signal: AbortSignal.timeout(20000) });
      const h = await r.text();
      if (!r.ok || !/sw-Card|一致する情報は見つかりませんでした/.test(h)) throw new Error('blocked');
      for (const [, u, t] of h.matchAll(/href="(https?:\/\/[^"]+)" class="sw-Card__titleInner"[^>]*>([\s\S]*?)<div/g)) {
        const real = u.replace(/&amp;/g, '&');
        if (sameSite(real, url)) out.push({ u: real, t: strip(t).replace(/\s*[-|｜]\s*[^-|｜]*$/, '') });
      }
      break;
    } catch {
      if (tries >= 2) { out.failed = true; break; }
      console.error(`検索を断られた（${host}）。20分あける`);
      lastSearch = Date.now() + 1200000;
    }
    }
    if (out.failed) break;
    if (out.some((x) => score(x.t) >= 3)) break;
  }
  return out;
}

async function crawl(row) {
  let searched = null;
  const start = row.start;
  const first = await get(start);
  if (!first.links) {
    // 出発のページが開けなくても、検索で見つかることがある
    const found = await search(start, row.name);
    if (!found.length) return { id: row.id, start, error: first.error || `HTTP ${first.status}` };
    first.links = []; first.finalUrl = start; first.title = '';
  }
  // 出発のページ自体が一覧のこともある
  const cands = [];
  const seen = new Set();
  const add = (u, t, s, via) => { if (!seen.has(u) && s > 0) { seen.add(u); cands.push({ u, t, s, via }); } };
  if (score(first.title) >= 2) add(first.finalUrl, first.title, score(first.title) + 1, 'start');
  first.links.filter((l) => sameSite(l.u, first.finalUrl)).forEach((l) => add(l.u, l.t, score(l.t), 'start'));
  // 「広聴」の入口のページにありがちなので、意見・広聴のリンクを1段だけたどって探す
  const hubs = first.links.filter((l) => sameSite(l.u, first.finalUrl) && /広聴|市民の声|区民の声|町民の声|村民の声|県民の声|都民の声|道民の声|府民の声|ご意見|こえ/.test(l.t) && !seen.has(l.u)).slice(0, 4);
  // 案内ページの1つ上・2つ上のフォルダ（「広聴」の入口のことが多い）も見る
  const up1 = dirOf(first.finalUrl).replace(/[^/]+\/$/, '');
  const up2 = up1.replace(/[^/]+\/$/, '');
  for (const u of [dirOf(first.finalUrl), up1, up2]) if (/^https?:\/\/[^/]+\/./.test(u) && !hubs.some((h) => h.u === u) && u !== first.finalUrl) hubs.push({ u, t: 'フォルダ' });
  for (const h of hubs) {
    await wait(800);
    const p = await get(h.u);
    if (!p.links) continue;
    if (score(p.title) >= 2) add(p.finalUrl, p.title, score(p.title), 'hub');
    p.links.filter((l) => sameSite(l.u, p.finalUrl)).forEach((l) => add(l.u, l.t, score(l.t), 'hub'));
  }
  // 見つからなければ、検索エンジン（DuckDuckGo の HTML 版）でそのサイトの中を探す
  if (!NOSEARCH && !cands.some((c) => c.s >= 3)) {
    const found = await search(first.finalUrl || start, row.name);
    searched = found.failed ? 'failed' : 'ok';
    for (const r of found) add(r.u, r.t, score(r.t), 'search');
  }
  cands.sort((a, b) => b.s - a.s);
  const out = { id: row.id, start, candidates: cands.slice(0, 8), lists: [], searched };
  // 上位2つの一覧を開き、同じフォルダの下のページ（年度別・分野別）を1段たどってリンクを集める
  for (const c of cands.slice(0, 2)) {
    if (/\.pdf($|\?)/i.test(c.u)) { out.lists.push({ u: c.u, t: c.t, pdf: true, items: [] }); continue; }
    await wait(800);
    const p = await get(c.u);
    if (!p.links) { out.lists.push({ u: c.u, t: c.t, error: p.error || `HTTP ${p.status}`, items: [] }); continue; }
    const base = dirOf(p.finalUrl);
    const items = p.links.filter((l) => sameSite(l.u, p.finalUrl) && l.u !== p.finalUrl);
    const list = { u: p.finalUrl, t: p.title, items: items.map((l) => ({ ...l, d: 0 })) };
    const subs = items.filter((l) => l.u.startsWith(base) && /年度|年|月|分野|一覧|件|号|回答|ご意見|分類|カテゴリ|^[0-9０-９]/.test(l.t) && !/\.pdf/i.test(l.u)).slice(0, 25);
    for (const s of subs) {
      await wait(700);
      const q = await get(s.u);
      if (!q.links) continue;
      q.links.filter((l) => sameSite(l.u, q.finalUrl) && l.u !== q.finalUrl).forEach((l) => list.items.push({ ...l, d: 1, from: s.u }));
    }
    // 同じリンクはまとめる
    const m = new Map();
    // n は、そのリンクが載っていたページの数（どのページにもあるのはメニュー）
    list.items.forEach((l) => {
      const o = m.get(l.u);
      if (!o) m.set(l.u, { ...l, n: 1 });
      else { o.n += 1; if (l.t.length > o.t.length) o.t = l.t; }
    });
    list.pages = 1 + subs.length;
    list.items = [...m.values()];
    out.lists.push(list);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const refetch = args.includes('--refetch');
  const only = args.filter((a) => !a.startsWith('--'));
  global.window = {};
  require(path.join(ROOT, 'site', 'data', 'sites.js'));
  const rows = fs.readFileSync(path.join(ROOT, 'site', 'data', 'intake', 'yobo.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .map((r) => ({ ...r, start: r.page_url || ((window.SITES[r.pref] || {})[r.level === 'pref' ? '@' : r.name] || [])[0] || '' }))
    .filter((r) => r.start && (!only.length || only.includes(r.id)))
    .sort((a, b) => (b.population || 0) - (a.population || 0));
  fs.mkdirSync(CACHE, { recursive: true });
  // --retry：前に一覧が見つからなかった（点が3より下の）ものだけ、探し方を広げて調べ直す
  const weak = (r) => { try { const d = JSON.parse(fs.readFileSync(fileOf(r.id), 'utf8')); return (!d.candidates || !d.candidates.length || d.candidates[0].s < 3) && (NOSEARCH || d.searched !== 'ok'); } catch { return true; } };
  const todo = rows.filter((r) => refetch || !fs.existsSync(fileOf(r.id)) || (args.includes('--retry') && weak(r)));
  console.error(`${rows.length} 件のうち ${todo.length} 件を調べる`);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const r = todo[i++];
      const res = await crawl(r).catch((e) => ({ id: r.id, start: r.page_url, error: String(e) }));
      res.fetched_at = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(fileOf(r.id), JSON.stringify(res));
      console.error(`${r.id}\t${res.error || (res.lists[0] ? res.lists[0].t + ' ' + res.lists[0].items.length : '候補なし')}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}
main();
