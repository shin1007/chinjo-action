// 要望書の出し方のページ（知事・市長への手紙、市民の声など）を、自治体の公式サイトからたどって探し、data/request-pages.js に書き出す。
// 対象：47都道府県・20の政令指定都市・それ以外で人口の多い市区町村300（data/municipality-populations.json の順）
//   node scripts/request-pages.js            … 探して書き出す（手で直した data/request-pages.js の値は MANUAL に置くと残る）
// 見つからなかった・開けなかった自治体は docs/要望書の出し方のページが見つからない自治体.md に残す
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data/sites.js'));
const POP = require(path.join(ROOT, 'data/municipality-populations.json')).populations;

const DESIGNATED = ['札幌市', '仙台市', 'さいたま市', '千葉市', '横浜市', '川崎市', '相模原市', '新潟市', '静岡市', '浜松市', '名古屋市', '京都市', '大阪市', '堺市', '神戸市', '岡山市', '広島市', '北九州市', '福岡市', '熊本市'];
const TOP = 300;

// 自動で見つけたページが違っていたとき、手で確かめたページに置き換える（キー：都道府県/市区町村。"@" は都道府県）
const MANUAL = require('./request-pages-manual.js');

// 要望書を出すページらしい言葉。強いものほど点が高い
const GOOD = [
  [/(知事|市長|区長|町長|村長)(への|に)(手紙|メール|提言|ひとこと|メッセージ|ご?意見|e-?mail)/i, 10],
  [/(県民|都民|道民|府民|市民|区民|町民|村民|みんな)の(声|こえ|ご?意見)/, 9],
  [/(県政|都政|道政|府政|市政|区政|町政|村政)(への|に)?(ご|御)?(意見|提案|提言)/, 9],
  [/(ご|御)意見(・|、|と)?(ご|御)?(提案|要望)/, 7],
  [/(ご|御)?意見(箱|ポスト|フォーム|募集箱)|提案箱|目安箱/, 7],
  [/広聴/, 5],
  [/(ご|御)意見(・|、)?(お問い?合わせ|お問合せ)/, 4],
];
// 要望書を出すページではないもの（県や市が国へ出した要望書の一覧、パブリックコメント、議会など）
const BAD = /分析|公表|DX|ＤＸ|デジタル|マイナンバー|ふるさと納税|観光|パブ|意見提出手続|水道|病院|広報広聴推進会議|要領|受付状況|年度|事例|寄せられた|回答|集計|報告|サイトへの|ホームページへの|ウェブサイトへの|若者|学校|教育委員会|選挙管理|消防|区役所|区の|イベント|講座|要望活動|要望書|国への|政府への|国に対する|政府要望|施策提案|パブリック|パブコメ|意見公募|意見募集|募集中|記者会見|議会|陳情|請願|統計|調査結果|アンケート|審議会|計画|選挙|入札|監査|情報公開|個人情報|オンブズ|行政相談|苦情処理|人権|子ども(の|へ)|職員採用|English/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (request-pages checker)', 'Accept-Language': 'ja' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const head = buf.subarray(0, 3000).toString('latin1');
    const cs = ((r.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || head.match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let text;
    try { text = new TextDecoder(cs.toLowerCase().replace(/^(x-)?sjis$|^shift-jis$/, 'shift_jis')).decode(buf); } catch { text = buf.toString('utf8'); }
    return { ok: r.ok, status: r.status, url: r.url, text };
  } catch (e) {
    return { ok: false, status: String(e.name || e), url, text: '' };
  } finally { clearTimeout(t); }
}
const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function links(page) {
  const out = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(page.text))) {
    const alt = (m[2].match(/alt=["']([^"']+)/) || [])[1] || '';
    const text = (strip(m[2]) || alt).slice(0, 80);
    let href;
    try { href = new URL(m[1].replace(/&amp;/g, '&'), page.url).href; } catch { continue; }
    if (!/^https?:/.test(href)) continue;
    out.push({ href, text });
  }
  return out;
}
const score = (text) => (BAD.test(text) ? 0 : GOOD.reduce((a, [re, n]) => (re.test(text) ? Math.max(a, n) : a), 0));
const titleOf = (t) => strip((t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s*[|｜\-－–].*$/, '').trim();
const sameSite = (a, b) => { try { const h = (u) => new URL(u).hostname.replace(/^www\./, '').split('.').slice(-3).join('.'); return h(a) === h(b); } catch { return false; } };

// そのページに、出し方（フォーム・郵送・メールなど）が書いてあるか
function howTo(text) {
  const s = strip(text);
  return /送信|フォーム|郵送|はがき|ハガキ|ファクス|ファックス|FAX|電子メール|メール|投函|入力/.test(s) && /(手紙|意見|提案|提言|声)/.test(s);
}

async function find(name, site) {
  const top = await get(site);
  if (!top.ok) return { error: `公式サイトを開けなかった（${top.status}）` };
  const cands = new Map();
  const add = (l, bonus = 0) => {
    if (!sameSite(l.href, top.url) && !/form|graffer|e-tumo|shinsei|logoform/i.test(l.href)) return;
    if (/\/gikai\/|\/kugikai\/|\/shigikai\/|\.pdf$/i.test(l.href)) return;
    const s = score(l.text);
    if (!s) return;
    const prev = cands.get(l.href);
    if (!prev || prev.s < s + bonus) cands.set(l.href, { ...l, s: s + bonus });
  };
  const first = links(top);
  first.forEach((l) => add(l, 1));
  const hubs = first.filter((l) => sameSite(l.href, top.url) && /お問い?合わせ|お問合せ|ご意見|広聴|広報|(県政|都政|道政|府政|市政|区政|町政|村政)(情報)?$|サイトマップ|行政情報|くらし|暮らし/.test(l.text) && !BAD.test(l.text));
  // サイトマップも入口に加える（多くの CMS は /sitemap.html にある）
  hubs.push({ href: new URL('/sitemap.html', top.url).href, text: 'サイトマップ' });
  for (const h of [...new Map(hubs.map((l) => [l.href, l])).values()].slice(0, 9)) {
    const p = await get(h.href);
    if (p.ok) links(p).forEach((l) => add(l));
    await sleep(200);
  }
  const tried = new Set();
  let fallback = null;
  // 題で確かめる。題が「広聴」のような入口なら、その中のリンクも候補に足してもう一度
  for (let round = 0; round < 3; round += 1) {
    const ranked = [...cands.values()].filter((c) => !tried.has(c.href)).sort((a, b) => b.s - a.s).slice(0, 6);
    if (!ranked.length) break;
    for (const c of ranked) {
      tried.add(c.href);
      const p = await get(c.href);
      await sleep(200);
      if (!p.ok) continue;
      const title = titleOf(p.text) || c.text;
      if (BAD.test(title)) continue;
      // 「広聴」「広報・広聴」や課の紹介のような入口のページは、出し方のページではないので候補にしない（中のリンクはたどる）
      const hub = /^(広報・?広聴|広聴|行政広聴|市の広聴|広聴・広報|集団広聴|広聴活動)(\s|／|\/|$)|^そのほか|概要|あらまし|課(\s|\/|／|$)|グループ$|係(\s|\/|／|$)|業務$|記事一覧|まとめ|紹介します/.test(title);
      const ts = score(title.replace(name, ''));
      if (!hub && ts >= 7 && howTo(p.text)) return { url: p.url, title };
      if (ts >= 4 || c.s >= 7) {
        links(p).forEach((l) => add(l, 2));
        // 首長あてのページがない自治体は、市政へのご意見を受け付けるフォーム・お問い合わせのページを使う
        if (!hub && howTo(p.text) && (!fallback || fallback.ts < ts)) fallback = { url: p.url, title, ts };
      }
    }
  }
  if (fallback && (fallback.ts >= 4 || /form|enquete|inquiry|mail/i.test(fallback.url))) return fallback;
  const best = [...cands.values()].sort((a, b) => b.s - a.s).slice(0, 3);
  return { error: best.length ? `候補はあったが、出し方の書いてあるページか確かめられなかった（${best.map((c) => `${c.text} ${c.href}`).join(' / ')}）` : '公式サイトのトップと入口のページに、それらしいリンクが見つからなかった' };
}

function targets() {
  const prefs = Object.keys(window.SITES);
  const list = prefs.map((p) => [p, '@']);
  const rest = Object.entries(POP).filter(([k]) => !k.endsWith('|都道府県議会')).sort((a, b) => b[1] - a[1]).map(([k]) => k.split('|'));
  rest.filter(([, n]) => DESIGNATED.includes(n)).forEach((x) => list.push(x));
  rest.filter(([, n]) => !DESIGNATED.includes(n)).slice(0, TOP).forEach((x) => list.push(x));
  return list;
}

(async () => {
  const list = targets();
  const out = {};
  const fails = [];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const [pref, key] = list[i++];
      const id = `${pref}/${key}`;
      const label = key === '@' ? pref : `${pref}${key}`;
      if (MANUAL[id]) { out[id] = MANUAL[id]; continue; }
      const [site] = (window.SITES[pref] || {})[key] || [];
      if (!site) { fails.push([label, '公式サイトが data/sites.js にない']); continue; }
      const r = await find(label, site);
      if (r.url) out[id] = [r.url, r.title];
      else fails.push([label, r.error, site]);
      process.stdout.write(`${r.url ? '○' : '×'} ${label} ${r.url || r.error}\n`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  const sorted = Object.fromEntries(list.map(([p, k]) => `${p}/${k}`).filter((id) => out[id]).map((id) => [id, out[id]]));
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  fs.writeFileSync(path.join(ROOT, 'data/request-pages.js'), `// 要望書の出し方のページ（知事・市長への手紙、市民の声など）。scripts/request-pages.js で作る。
// キー：都道府県名/市区町村名（data/sites.js と同じ表記。"@" は都道府県）→ [ページのURL, ページの題]
// 対象：47都道府県・政令指定都市・それ以外で人口の多い市区町村${TOP}。${today} に公式サイトのリンクをたどって見つけ、
// ページに出し方（フォーム・郵送・メールなど）が書いてあることを確かめた。県や市が国へ出した要望書の一覧などは除いた。
window.REQUEST_PAGES = {
${Object.entries(sorted).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
};
`);
  const order = new Map(list.map(([p, k], n) => [k === '@' ? p : `${p}${k}`, n]));
  fails.sort((a, b) => order.get(a[0]) - order.get(b[0]));
  fs.writeFileSync(path.join(ROOT, 'docs/要望書の出し方のページが見つからない自治体.md'), `# 要望書の出し方のページが見つからない自治体

scripts/request-pages.js で、公式サイトから「知事・市長への手紙」「市民の声」などのページを自動でたどったが、見つからなかった・開けなかった自治体（${today}）。
かんたん作成の画面では、これらの自治体は Google の検索結果に案内する。ページが分かったら scripts/request-pages-manual.js に書き足して、スクリプトを流し直す。

| 自治体 | 理由 | 公式サイト |
| --- | --- | --- |
${fails.map(([l, e, s]) => `| ${l} | ${String(e).replace(/\|/g, '／')} | ${s || ''} |`).join('\n')}
`);
  console.log(`\n見つかった ${Object.keys(sorted).length} / ${list.length}、見つからない ${fails.length}`);
})();
