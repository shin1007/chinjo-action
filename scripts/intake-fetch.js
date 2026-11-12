#!/usr/bin/env node
// 受け付け方のデータベース（site/data/intake/）を埋めるために、案内ページの本文を取ってきて手元に置く。
//   node scripts/intake-fetch.js chinjo|yobo [--refetch]
// 陳情は site/data/intake/chinjo.jsonl の page_url（なければ sites.js の陳情・請願の案内ページ）、要望は yobo.jsonl の page_url。
// 本文は scripts/.intake-cache/<kind>/<id>.json に置く（著作物なので公開しない。.gitignore 済み）。
// 取れなかったものは docs/確認用/受け付け方の案内ページを取得できなかった自治体.md に書く。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const CACHE = path.join(__dirname, '.intake-cache');

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr|td|th|dt|dd)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[ \t　]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

const fileOf = (kind, id) => path.join(CACHE, kind, id.replace(/[\\/:*?"<>|]/g, '_') + '.json');

async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    if (/pdf/i.test(ct)) return { status: r.status, error: 'PDF', finalUrl: r.url };
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const body = (html.match(/<main[\s\S]*?<\/main>/i) || html.match(/<div[^>]+id=["'](?:main|contents?|tmp_contents)["'][\s\S]*/i) || [html])[0];
    const links = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, h, tx]) => ({ href: new URL(h, r.url).href, text: strip(tx).slice(0, 80) }))
      .filter((l) => /^mailto:|form|shinsei|e-?apply|graffer|logoform|enquete|apply|request/i.test(l.href) || /フォーム|送信|投稿|電子申請|オンライン|メール|入力/.test(l.text))
      .slice(0, 30);
    return { status: r.status, finalUrl: r.url, title, text: strip(body).slice(0, 30000), links, hasForm: /<form[\s>][\s\S]*?<textarea/i.test(html) };
  } catch (e) {
    return { status: 0, error: String(e.cause && e.cause.code || e.name || e) };
  } finally { clearTimeout(t); }
}

async function main() {
  const [kind, opt] = process.argv.slice(2);
  if (!['chinjo', 'yobo'].includes(kind)) { console.error('使い方: node scripts/intake-fetch.js chinjo|yobo [--refetch]'); process.exit(1); }
  global.window = {};
  require(path.join(DATA, 'sites.js'));
  const rows = fs.readFileSync(path.join(DATA, 'intake', `${kind}.jsonl`), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const items = rows.map((r) => {
    const key = r.level === 'pref' ? '@' : r.name;
    const site = ((window.SITES[r.pref] || {})[key]) || [];
    return { id: r.id, url: r.page_url || (kind === 'chinjo' ? site[1] : '') || '' };
  }).filter((x) => x.url);
  fs.mkdirSync(path.join(CACHE, kind), { recursive: true });
  const todo = items.filter((x) => opt === '--refetch' || !fs.existsSync(fileOf(kind, x.id)));
  console.error(`${kind}: ${items.length} 件のうち ${todo.length} 件を取る`);
  // 同じサイトに続けて行かないよう、ホストごとに順番に、全体は並行で
  const byHost = {};
  for (const x of todo) (byHost[new URL(x.url).host] ||= []).push(x);
  const queues = Object.values(byHost);
  let done = 0;
  async function worker() {
    for (;;) {
      const q = queues.shift();
      if (!q) return;
      for (const x of q) {
        const p = await get(x.url);
        fs.writeFileSync(fileOf(kind, x.id), JSON.stringify({ id: x.id, url: x.url, fetched_at: new Date().toISOString().slice(0, 10), ...p }));
        if (++done % 100 === 0) console.error(`  ${done}/${todo.length}`);
        await new Promise((res) => setTimeout(res, 800));
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  // 取れなかったものの記録
  const failed = items.map((x) => { try { return JSON.parse(fs.readFileSync(fileOf(kind, x.id), 'utf8')); } catch { return null; } })
    .filter((p) => p && (p.error || p.status >= 400 || !p.text));
  const log = path.join(ROOT, 'docs', '確認用', '受け付け方の案内ページを取得できなかった自治体.md');
  const head = '# 受け付け方の案内ページを取得できなかった自治体\n\nscripts/intake-fetch.js で取ろうとして取れなかったもの。ブラウザで開けば読めることが多い（ボット拒否・PDF・タイムアウトなど）。\n\n';
  const old = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : head;
  const section = `## ${kind === 'chinjo' ? '陳情（議会）' : '要望（首長）'}\n\n| 自治体 | 結果 | URL | 取得日 |\n|---|---|---|---|\n` +
    failed.map((p) => `| ${p.id} | ${p.error || p.status || '本文なし'} | ${p.url} | ${p.fetched_at} |`).join('\n') + '\n\n';
  const re = new RegExp(`## ${kind === 'chinjo' ? '陳情（議会）' : '要望（首長）'}[\\s\\S]*?(?=\\n## |$)`);
  fs.writeFileSync(log, re.test(old) ? old.replace(re, section.trimEnd() + '\n') : old + section);
  console.error(`取れなかった：${failed.length} 件（${path.relative(ROOT, log)}）`);
}
main();
