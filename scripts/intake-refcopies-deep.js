#!/usr/bin/env node
// 参考資料の提出部数の記載が、案内ページ本体ではなく、そこからリンクされた手続きのページ・様式・PDF に書かれている議会を探す。
//   node scripts/intake-refcopies-deep.js            案内ページ（chinjo.jsonl の page_url）から、同じサイトの手続き・様式・記載例のリンクを最大3つたどる
// 本文は scripts/.intake-cache/chinjo-deep/（公開しない）に置き、候補（議会・一文・URL）を表示する。
// 取れなかったもの（開けない・PDF が読めない）は docs/調査/参考資料の部数の調査で取れなかったページ.md に書く。
// PDF の本文は pdftotext（poppler）で読む。候補は人が原文を読んで確かめてから chinjo.jsonl に入れる。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { sentences } = require('./intake-refcopies.js');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.intake-cache', 'chinjo-deep');
const LOG = path.join(ROOT, 'docs', '調査', '参考資料の部数の調査で取れなかったページ.md');
const DOC = /(資料|添付|別紙|付属|参考)/;
const NUM = /([0-9０-９]+|[一二三四五六七八九十百]+)\s*(部|通)|(議員|委員|議会)(の)?(人数|定数|数)分|人数分|全議員分|議員分/;
const WANT = /(請願|陳情).{0,8}(手続|提出|様式|出し方|記載例|案内|取扱|取り扱い|方法)|様式|記載例|手引|ガイド|規則|傍聴|議会へのお願い/;
const HEAD = { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' };

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr|td|th|dt|dd)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t　]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const host = (u) => { try { return new URL(u).host.replace(/^www\d?\./, ''); } catch { return ''; } };
const sameSite = (a, b) => host(a).split('.').slice(-3).join('.') === host(b).split('.').slice(-3).join('.');

async function fetchBuf(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: HEAD });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, url: r.url, ct: r.headers.get('content-type') || '', buf };
  } catch (e) { return { status: 0, error: String((e.cause && e.cause.code) || e.name || e) }; } finally { clearTimeout(t); }
}
function htmlOf(r) {
  const cs = (r.ct.match(/charset=([\w-]+)/i) || r.buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  try { return new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(r.buf); } catch { return r.buf.toString('utf8'); }
}
function pdfText(buf) {
  const f = path.join(os.tmpdir(), `rc-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(f, buf);
  try { return execFileSync('pdftotext', ['-layout', f, '-'], { maxBuffer: 20 * 1024 * 1024, timeout: 30000 }).toString('utf8'); } catch { return null; } finally { fs.rmSync(f, { force: true }); }
}
const safe = (s) => s.replace(/[\\/:*?"<>|]/g, '_');

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const rows = fs.readFileSync(path.join(ROOT, 'site', 'data', 'intake', 'chinjo.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    .filter((r) => r.page_url);
  const failed = [];
  const found = [];
  let done = 0;
  const byHost = {};
  for (const r of rows) (byHost[host(r.page_url)] ||= []).push(r);
  const queues = Object.values(byHost);
  async function one(r) {
    const cf = path.join(CACHE, safe(r.id) + '.json');
    let rec;
    if (fs.existsSync(cf)) rec = JSON.parse(fs.readFileSync(cf, 'utf8'));
    else {
      const top = await fetchBuf(r.page_url);
      rec = { id: r.id, url: r.page_url, pages: [] };
      if (top.status !== 200 || /pdf/i.test(top.ct)) { rec.error = top.error || top.status; }
      else {
        const html = htmlOf(top);
        const links = [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(([, h, tx]) => {
          try { return { href: new URL(h, top.url).href, text: strip(tx).slice(0, 80) }; } catch { return null; }
        }).filter((l) => l && /^https?:/.test(l.href) && sameSite(l.href, top.url) && l.href !== top.url && (WANT.test(l.text) || /\.pdf(\?|$)/i.test(l.href) && /(請願|陳情|様式|記載|手続|提出)/.test(l.text)));
        const uniq = [...new Map(links.map((l) => [l.href, l])).values()].slice(0, 3);
        for (const l of uniq) {
          await new Promise((res) => setTimeout(res, 600));
          const p = await fetchBuf(l.href);
          if (p.status !== 200) { rec.pages.push({ url: l.href, text: l.text, error: p.error || p.status }); continue; }
          const isPdf = /pdf/i.test(p.ct) || /\.pdf(\?|$)/i.test(l.href) || p.buf.subarray(0, 4).toString() === '%PDF';
          const text = isPdf ? pdfText(p.buf) : strip(htmlOf(p));
          rec.pages.push(text == null ? { url: l.href, text: l.text, error: 'PDF を読めない' } : { url: p.url, text: l.text, body: text.slice(0, 60000) });
        }
      }
      rec.fetched_at = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(cf, JSON.stringify(rec));
    }
    if (rec.error) failed.push([r.id, r.page_url, rec.error]);
    for (const pg of rec.pages) {
      if (pg.error) { failed.push([r.id, pg.url, pg.error]); continue; }
      const hits = [...new Set(sentences(pg.body).filter((s) => DOC.test(s) && NUM.test(s)))];
      if (hits.length) found.push({ id: r.id, url: pg.url, fetched_at: rec.fetched_at, hits });
    }
  }
  async function worker() {
    for (;;) {
      const q = queues.shift();
      if (!q) return;
      for (const r of q) {
        try { await one(r); } catch (e) { failed.push([r.id, r.page_url, String(e.message || e)]); }
        if (++done % 100 === 0) console.error(`  ${done}/${rows.length}`);
        await new Promise((res) => setTimeout(res, 600));
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  fs.writeFileSync(path.join(CACHE, '_found.json'), JSON.stringify(found, null, 1));
  const head = '# 参考資料の部数の調査で取れなかったページ\n\nscripts/intake-refcopies-deep.js で、案内ページからたどった手続き・様式・PDF のページが取れなかったもの。ブラウザで開けば読めることがある。\n\n| 議会 | URL | 結果 |\n|---|---|---|\n';
  fs.writeFileSync(LOG, head + failed.map(([id, u, e]) => `| ${id} | ${u} | ${e} |`).join('\n') + '\n');
  console.error(`候補のある議会：${found.length}、取れなかった：${failed.length}（${path.relative(ROOT, LOG)}）`);
}
main();
