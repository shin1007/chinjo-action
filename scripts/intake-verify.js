#!/usr/bin/env node
// 受け付け方のデータベース（site/data/intake/*.jsonl）の根拠（sources）の一文が、いまも出典のページに本当に載っているかを確かめる。
// 定期的に（毎月と、議員の改選のあと）走らせる。
//   node scripts/intake-verify.js                  … 全部の出典を取り直して照合する（取ってから30日以内のものは取り直さない）
//   node scripts/intake-verify.js --refetch        … 全部取り直す
//   node scripts/intake-verify.js --limit 50       … 試しに50件だけ
//   node scripts/intake-verify.js --only 東京都 --only 大阪府/堺市  … 改選のあった自治体だけ取り直す（ほかは前に取った本文で照合し直す）
//   node scripts/intake-verify.js --file <URL> <保存したHTMLかテキスト>  … 自動で取れなかったページを、手で保存したファイルで照合する
// 結果：
//   site/data/intake/verify.json … URL ごとの照合の結果（公開）
//   site/data/verify-summary.json … 件数と日付（/coverage の「出典の照合」に出す）
//   docs/調査/出典を確かめられなかったもの.md … 取れなかった・一文が見つからなかったもの。直リンクと、一文を検索するリンクつき
// 本文の置き場所：scripts/.intake-cache/verify/（著作物なので公開しない）
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { strip } = require('./intake-fetch.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'site', 'data', 'intake');
const CACHE = path.join(__dirname, '.intake-cache', 'verify');
const OUT = path.join(DIR, 'verify.json');
const LOG = path.join(ROOT, 'docs', '調査', '出典を確かめられなかったもの.md');
const MAX_AGE = 30 * 864e5;
const today = () => new Date().toISOString().slice(0, 10);
const cacheOf = (url) => path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex') + '.json');

// 空白・記号の違いで外れないよう、全角半角をそろえ、空白と句読点・括弧を落として比べる
const ent = (s) => String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const norm = (s) => ent(s).normalize('NFKC').replace(/[\s、。，．・「」『』（）()［］\[\]【】〈〉《》"'“”‘’:：;；!！?？\-‐－―ー〜~…]/g, '');
// 「…」で省いた引用は、かたまりごとに全部載っていれば一致とみなす
// c は取ったページ（text・hrefs・hasForm）。機械で付けた「（このページに入力フォームがある）」「（フォームへのリンク：URL）」はページの作りで確かめる
const found = (quote, c) => {
  const q = String(quote);
  if (/^（このページに入力フォームがある）$/.test(q)) return !!c.hasForm;
  const link = q.match(/^（フォームへのリンク[:：]\s*(\S+?)）$/);
  if (link) return (c.hrefs || '').split(' ').includes(link[1]);
  const t = norm(`${c.text} ${c.hrefs || ''} ${c.linkText || ''}`);
  // 途中で切れた文字参照（&#105 など）は落とす
  quote = q.replace(/&#x?[\da-f]*$/i, '');
  // 「リンク：〇〇」はリンクの文字（またはメールアドレス）を引いたもの
  const parts = String(quote).replace(/^リンク[:：]\s*/, '').split(/…|\.\.\.|（略）|〔略〕/).map(norm).filter((p) => p.length >= 4);
  return parts.length > 0 && parts.every((p) => t.includes(p));
};

async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || '';
    if (/pdf/i.test(ct) || /\.pdf($|\?)/i.test(url)) return { status: r.status, error: 'PDF' };
    if (!r.ok) return { status: r.status, error: `HTTP ${r.status}` };
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    return { status: r.status, text: strip(html),
      hrefs: [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => { try { return /^mailto:/i.test(m[1]) ? m[1].slice(7).split('?')[0] : new URL(ent(m[1]), r.url).href; } catch { return ''; } }).join(' '),
      // リンクの文字（画像の alt も含む）
      linkText: [...html.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => strip(m[1].replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1'))).join(' '),
      hasForm: /<form[\s>][\s\S]*?<(textarea|input)/i.test(html) };
  } catch (e) {
    return { status: 0, error: String((e.cause && e.cause.code) || e.name || e) };
  } finally { clearTimeout(timer); }
}

function load() {
  const items = new Map(); // url → [{kind, id, quote, fields}]
  for (const kind of ['chinjo', 'yobo']) {
    for (const line of fs.readFileSync(path.join(DIR, `${kind}.jsonl`), 'utf8').split('\n').filter(Boolean)) {
      const r = JSON.parse(line);
      for (const s of r.sources || []) {
        if (!s.url || !s.quote || !/^https?:/.test(s.url)) continue;
        if (!items.has(s.url)) items.set(s.url, []);
        items.get(s.url).push({ kind, id: r.id, quote: s.quote, fields: s.fields || [] });
      }
    }
  }
  return items;
}

function readCache(url) {
  try { return JSON.parse(fs.readFileSync(cacheOf(url), 'utf8')); } catch { return null; }
}

async function main() {
  const args = process.argv.slice(2);
  fs.mkdirSync(CACHE, { recursive: true });
  if (args[0] === '--file') {
    const [, url, file] = args;
    if (!url || !file) { console.error('使い方: node scripts/intake-verify.js --file <URL> <保存したファイル>'); process.exit(1); }
    const raw = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(cacheOf(url), JSON.stringify({ url, fetched_at: today(), via: 'manual', status: 200, text: /<html|<body/i.test(raw) ? strip(raw) : raw }));
    console.error(`${url} を手で保存したファイルで登録した。もう一度 node scripts/intake-verify.js を走らせると照合する`);
    return;
  }
  const refetch = args.includes('--refetch');
  const li = args.indexOf('--limit');
  const limit = li >= 0 ? Number(args[li + 1]) : Infinity;
  const items = load();
  const urls = [...items.keys()].slice(0, limit);
  const only = args.flatMap((a, i) => (args[i - 1] === '--only' ? [a] : []));
  const hit = (u) => !only.length || items.get(u).some((q) => only.some((o) => q.id === o || q.id.startsWith(o.includes('/') ? o : `${o}/`)));
  const todo = urls.filter(hit).filter((u) => {
    const c = readCache(u);
    return refetch || (only.length && c && c.via !== 'manual') || !c || (c.via !== 'manual' && (c.error || Date.now() - Date.parse(c.fetched_at) > MAX_AGE));
  });
  console.error(`出典 ${urls.length} 件のうち ${todo.length} 件を取る`);
  // 同じサイトに続けて行かないよう、ホストごとに順番に、全体は並行で
  const byHost = {};
  for (const u of todo) (byHost[new URL(u).host] ||= []).push(u);
  let done = 0;
  // 一度に開くのは8つのサイトまで（多すぎると手元の回線で時間切れになる）
  const queue = Object.values(byHost);
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let list; (list = queue.shift());) for (const u of list) {
      const r = await fetchText(u);
      fs.writeFileSync(cacheOf(u), JSON.stringify({ url: u, fetched_at: today(), via: 'auto', ...r }));
      if (++done % 100 === 0) console.error(`${done}/${todo.length}`);
      await new Promise((ok) => setTimeout(ok, 800));
    }
  }));

  const result = {};
  const failed = { fetch: [], quote: [] };
  for (const u of urls) {
    const c = readCache(u) || { error: '未取得' };
    const qs = items.get(u);
    if (c.error) {
      result[u] = { checked_at: c.fetched_at || today(), ok: null, error: c.error };
      failed.fetch.push({ url: u, error: c.error, qs });
      continue;
    }
    const miss = qs.filter((q) => !found(q.quote, c));
    result[u] = { checked_at: c.fetched_at, ok: miss.length === 0, quotes: qs.length, missing: miss.length, via: c.via };
    if (miss.length) failed.quote.push({ url: u, qs: miss });
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 0).replace(/,"(?=https?:)/g, ',\n"') + '\n');

  const google = (q, u) => `https://www.google.com/search?q=${encodeURIComponent(`"${String(q).split(/…/)[0].slice(0, 40)}" site:${new URL(u).host}`)}`;
  const who = (qs) => [...new Set(qs.map((q) => `${q.kind === 'chinjo' ? '陳情' : '要望'}・${q.id}`))].join('、');
  const lines = [
    '# 出典を確かめられなかったもの',
    '',
    `\`node scripts/intake-verify.js\` が書き出す（最後に走らせた日：${today()}）。site/data/intake/*.jsonl の根拠の一文が、出典のページにいまも載っているかを機械で照合した結果のうち、確かめられなかったもの。`,
    '',
    '直し方：',
    '- **ページを取れなかった**：リンクをブラウザで開いて保存し、`node scripts/intake-verify.js --file <URL> <保存したファイル>` で登録する（保存したファイルの場所を伝えてもらえれば、こちらで登録する）。',
    '- **一文が見つからなかった**：ページが書き換わったか、移ったかもしれない。「検索」のリンクで一文を探し、見つかった新しいページの URL を伝えてもらえれば、こちらで出典を直す。見つからなければ、その値は unknown に戻す。',
    '',
    `## ページを取れなかった（${failed.fetch.length} 件）`,
    '',
    ...failed.fetch.map((f) => `- [ ] ${who(f.qs)}（${f.error}）：[${f.url}](${f.url}) ・ [検索](${google(f.qs[0].quote, f.url)})`),
    '',
    `## 一文が見つからなかった（${failed.quote.length} 件）`,
    '',
    ...failed.quote.map((f) => `- [ ] ${who(f.qs)}：[${f.url}](${f.url}) ・ [検索](${google(f.qs[0].quote, f.url)})\n  - 「${String(f.qs[0].quote).slice(0, 120)}」`),
    '',
  ];
  fs.writeFileSync(LOG, lines.join('\n'));
  const ok = Object.values(result).filter((r) => r.ok).length;
  fs.writeFileSync(path.join(ROOT, 'site', 'data', 'verify-summary.json'), JSON.stringify({ checked_at: today(), total: urls.length, ok, missing: failed.quote.length, unreachable: failed.fetch.length }) + '\n');
  console.error(`一致 ${ok} 件・一文が見つからない ${failed.quote.length} 件・取れない ${failed.fetch.length} 件（${path.relative(ROOT, LOG)}）`);
}
if (require.main === module) main();
module.exports = { found, norm };
