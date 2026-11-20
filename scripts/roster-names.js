#!/usr/bin/env node
// 議員名簿のページ（site/data/roster.json）から、議員の名前を抜き出す。
//   node scripts/roster-names.js                … 人口の多い順に、まだ抜き出していない議会を100件
//   node scripts/roster-names.js --next 2000    … 件数を変える
//   node scripts/roster-names.js --only 東京都  … その都道府県（と中の市区町村）だけやり直す
//   node scripts/roster-names.js --show 東京都/墨田区  … 1件だけ抜き出して見せる（書かない）
// 結果：site/data/roster/<都道府県>.json（{ "<id>": {names:[...], url, checked_at} }。/letter の郵便番号の結果に出す）
// 抜き出せなかった・人数がおかしいもの：docs/調査/議員の名前を抜き出せなかった議会.md
// 抜き出し方：リンクの文字・表のセル・箇条書きのうち、「姓 名」の形（間に空白）か、すぐ後ろによみがなが付いた形のものを集め、
// いちばん多く集まった並びを名簿とみなす。人数が議員の定数としてありうる範囲（都道府県 30〜130・市区町村 5〜110）でなければ使わない。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const OUT = path.join(DATA, 'roster');
const LOG = path.join(ROOT, 'docs', '調査', '議員の名前を抜き出せなかった議会.md');
const today = () => new Date().toISOString().slice(0, 10);

async function html(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    if (/pdf/i.test(r.headers.get('content-type') || '') || /\.pdf$/i.test(url)) return pdf(buf);
    const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { return { html: new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf) }; } catch { return { html: buf.toString('utf8') }; }
  } catch (e) { return { error: String((e.cause && e.cause.code) || e.name) }; } finally { clearTimeout(timer); }
}

// PDF の名簿は pdftotext（poppler）で文字にする。入っていなければ PDF は飛ばす
const { execFileSync } = require('child_process');
const os = require('os');
function pdf(buf) {
  const f = path.join(os.tmpdir(), `roster-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    fs.writeFileSync(f, buf);
    const t = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', f, '-'], { encoding: 'utf8', timeout: 30000 });
    return { text: t };
  } catch { return { error: 'PDF（文字にできない）' }; } finally { try { fs.unlinkSync(f); } catch { /* なし */ } }
}

const KANJI = '一-龥々〆ヶ㐀-䶵豐﨑髙';
const SEI = `[${KANJI}ぁ-んァ-ヶー]{1,6}`;
const MEI = `[${KANJI}ぁ-んァ-ヶー]{1,6}`;
const SPACED = new RegExp(`^(${SEI})[\\s　]+(${MEI})$`);
const NOSPACE = new RegExp(`^[${KANJI}][${KANJI}ぁ-んァ-ヶー]{1,7}$`);
const KANA = /^[ぁ-んァ-ヶー\s　]{3,20}$/;
// 名前ではない言葉（役職・会派・見出し）
const STOP = /議員|議長|委員|会派|名簿|紹介|一覧|選挙|定数|任期|氏名|住所|電話|所属|当選|年齢|生年|期数|地区|議会|自民|公明|共産|立憲|維新|民主|無所属|クラブ|会$|党$|市$|町$|村$|区$|県$|都$|府$|道$|事務局|ページ|トップ|ホーム|お問い合わせ|サイト|検索|メニュー|政策|活動|報告|日程|本会議|常任|特別|予算|決算|総務|文教|厚生|建設|経済|環境|福祉|産業|交通|教育|農林|観光|広報|議事|請願|陳情|会議録|中継|映像/;

// 表の見出し（「氏　名」「住　所」）や住所（「新宮町 上府北」）を名前とみなさない
const isName = (m) => !STOP.test(`${m[1]}${m[2]}`) && !STOP.test(m[0]) && !/(都|道|府|県|市|町|村|区|郡)$/.test(m[1]) && !(m[1].length === 1 && m[2].length === 1 && /^(氏名|住所|党派|欠員|備考|写真|役職|期数|議席|年齢|性別|職業|現職|新人|定数|会長|議長)$/.test(m[1] + m[2]));
// よみがなを別の要素に書いている名簿では、ひらがなだけの名前と漢字の名前が同じ数ずつ取れる。そのときはひらがなだけのほうを落とす
const dropReadings = (names) => {
  const kana = names.filter((n) => /^[ぁ-んー ]+$/.test(n));
  const other = names.length - kana.length;
  return kana.length >= 3 && other >= 3 && kana.length / other > 0.6 && kana.length / other < 1.4 ? names.filter((n) => !kana.includes(n)) : names;
};
const clean = (s) => s.replace(/<rt>[\s\S]*?<\/rt>|<rp>[\s\S]*?<\/rp>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&')
  .replace(/[（(][^）)]*[）)]/g, '').replace(/(議員|君|さん|氏)$/, '').trim();
const join = (m) => `${m[1]} ${m[2]}`;

function extract(page) {
  const h = page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ');
  // 頭のメニュー・足もとは落とす（main があれば main だけ）
  const body = (h.match(/<main[\s\S]*?<\/main>/i) || h.match(/<div[^>]+id=["'](?:main|contents?|tmp_contents|content-main|mainContents)["'][\s\S]*/i) || [h])[0];
  const groups = { a: [], td: [], li: [], p: [] };
  const take = (key, re) => {
    for (const m of body.matchAll(re)) {
      for (const line of clean(m[1]).split(/\n/)) {
        const t = line.trim();
        const sp = t.match(SPACED);
        if (sp && isName(sp)) groups[key].push(join(sp));
      }
    }
  };
  take('a', /<a\s[^>]*>([\s\S]*?)<\/a>/gi);
  take('td', /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
  take('li', /<li[^>]*>([\s\S]*?)<\/li>/gi);
  take('p', /<(?:p|h\d|dt|dd|span|strong)[^>]*>([\s\S]*?)<\/(?:p|h\d|dt|dd|span|strong)>/gi);
  // 空白なしの名前のすぐ後ろのセルによみがながある表（例：| 逢沢一郎 | あいさわ いちろう |）
  const cells = [...body.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => clean(m[1]).replace(/\s+/g, ' ').trim());
  const kanaPair = [];
  for (let i = 0; i + 1 < cells.length; i++) {
    const n = cells[i].replace(/[\s　]+/g, '');
    if (NOSPACE.test(n) && !STOP.test(n) && KANA.test(cells[i + 1]) && n.length >= 2) {
      const sp = cells[i].match(SPACED);
      kanaPair.push(sp ? join(sp) : n);
    }
  }
  groups.kana = kanaPair;
  const uniq = (xs) => [...new Set(xs.map((x) => x.replace(/[\s　]+/g, ' ')))];
  // 並びごとに集め、名前の多い並びから順に合わせる（名簿が表と箇条書きに分かれていることがある）。
  // 2人未満しか集まらない並びは、見出しなどの拾いすぎとみて使わない
  const ranked = Object.entries(groups).map(([key, xs]) => [key, uniq(xs)]).filter(([, u]) => u.length >= 2).sort((a, b) => b[1].length - a[1].length);
  return { key: ranked.map(([k]) => k).join('+') || null, names: dropReadings(uniq(ranked.flatMap(([, u]) => u))) };
}

function extractText(text) {
  const names = [];
  for (const line of text.split(/\n/)) {
    for (const cell of line.split(/\s{2,}|\t|　{2,}/)) {
      const t = cell.replace(/[（(][^）)]*[）)]/g, '').replace(/(議員|君)$/, '').trim();
      const sp = t.match(SPACED);
      if (sp && isName(sp)) names.push(join(sp));
    }
  }
  return { key: 'pdf', names: dropReadings([...new Set(names)]) };
}

// ページそのものに名前がないときは、ページの中の「議員名簿」「50音順」などのリンク（同じサイト・3つまで）を開いてみる
const SUB = /名簿|一覧|50音|五十音|会派別|議席|選挙区別|議員紹介|議員の紹介|プロフィール/;
// ページに書いてある議員の数（「議員定数 32人」「現員 31名」など）。全員を取れたかの目安にする
const SEATS = /(現員|現在数|議員数|定数)[^0-9０-９。]{0,12}([0-9０-９]{1,3})\s*(人|名)/g;
const seats = (t) => {
  const plain = t.replace(/<[^>]+>/g, ' ').normalize('NFKC');
  const ns = [...plain.matchAll(SEATS)].map((m) => [m[1], Number(m[2])]);
  const cur = ns.find(([k]) => k !== '定数');
  return cur ? cur[1] : ns.length ? ns[0][1] : null;
};
async function read(url, lo, hi) {
  const r = await readRaw(url, lo, hi);
  const n = r.seats;
  // 書いてある人数より多いときは、よみがなが混じっているとみて、ひらがなだけの名前を落としてみる
  if (n && r.names.length > n) r.names = r.names.filter((x) => !/^[ぁ-んー ]+$/.test(x));
  // 書いてある人数の9割に届かなければ、一部しか取れていないとみる（欠員があるので少しの差は認める）
  // ひらがなだけの名前が多いのは、よみがなを拾っている見込みが高い（宛名に使えない）
  const kana = r.names.filter((x) => /^[ぁ-んァ-ヶー ]+$/.test(x)).length;
  if (r.names.length && kana / r.names.length > 0.35) return { ...r, error: 'よみがなを拾っている' };
  if (n && r.names.length < Math.floor(n * 0.9)) return { ...r, error: `${n}人のうち${r.names.length}人しか取れない` };
  if (n && r.names.length > n) return { ...r, error: `${n}人のはずが${r.names.length}人取れた（名前でないものが混じっている）` };
  return r;
}
async function readRaw(url, lo, hi) {
  const p = await html(url);
  if (p.error) return { names: [], error: p.error };
  if (p.text != null) return { ...extractText(p.text), url, seats: seats(p.text) };
  const b = extract(p.html);
  b.seats = seats(p.html);
  if (b.names.length >= lo && b.names.length <= hi) return { ...b, url };
  const subs = [...p.html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, h, t]) => { try { return { href: new URL(h, url).href, text: t.replace(/<[^>]+>/g, '').trim() }; } catch { return null; } })
    .filter((l) => l && SUB.test(l.text) && !/歴代|元議員|報酬|政務活動|資産|委員会/.test(l.text) && l.href !== url && !/twitter|x\.com|facebook|instagram|youtube|line\.me/.test(l.href));
  let best = { ...b, url };
  for (const l of [...new Map(subs.map((x) => [x.href, x])).values()].slice(0, 3)) {
    const q = await html(l.href);
    const c = q.text != null ? extractText(q.text) : q.html ? extract(q.html) : { names: [] };
    const ok = (x) => x.names.length >= lo && x.names.length <= hi;
    c.seats = (q.html || q.text) ? seats(q.html || q.text) || b.seats : b.seats;
    if (ok(c) && (!ok(best) || c.names.length > best.names.length)) best = { ...c, url: l.href };
  }
  return best;
}

const range = (level) => (level === 'pref' ? [30, 130] : [5, 110]);

async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => args.flatMap((a, i) => (args[i - 1] === k ? [a] : []));
  const roster = JSON.parse(fs.readFileSync(path.join(DATA, 'roster.json'), 'utf8'));
  const rows = fs.readFileSync(path.join(DATA, 'intake', 'chinjo.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const level = Object.fromEntries(rows.map((r) => [r.id, r.level]));
  const pop = Object.fromEntries(rows.map((r) => [r.id, r.level === 'pref' ? 1e9 : (r.population || 0)]));

  if (opt('--show').length) {
    const id = opt('--show')[0];
    const [lo, hi] = range(level[id]);
    const b = await read(roster[id].url, lo, hi);
    console.log(b.url || roster[id].url, b.error || '', '定数など:', b.seats, b.key, b.names.length, b.names.join('、'));
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const files = {};
  const load = (pref) => (files[pref] ||= fs.existsSync(path.join(OUT, `${pref}.json`)) ? JSON.parse(fs.readFileSync(path.join(OUT, `${pref}.json`), 'utf8')) : {});
  const failLog = path.join(OUT, '.failed.json');
  const failed = fs.existsSync(failLog) ? JSON.parse(fs.readFileSync(failLog, 'utf8')) : {};
  const only = opt('--only');
  const inOnly = (id) => only.some((o) => id === o || id.startsWith(o.includes('/') ? o : `${o}/`));
  const next = Number(opt('--next')[0] || 100);
  const ids = Object.keys(roster).filter((id) => roster[id].url).sort((a, b) => pop[b] - pop[a]);
  const todo = only.length ? ids.filter(inOnly) : ids.filter((id) => !(id in load(id.split('/')[0])) && !(id in failed)).slice(0, next);
  console.error(`${todo.length} 件の名簿を読む`);
  const queue = [...todo];
  let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let id; (id = queue.shift());) {
      const pref = id.split('/')[0];
      const url = roster[id].url;
      const [lo, hi] = range(level[id]);
      const b = await read(url, lo, hi);
      if (!b.error && b.names.length >= lo && b.names.length <= hi) {
        load(pref)[id] = { names: b.names, url: b.url, seats: b.seats || null, checked_at: today() };
        delete failed[id];
      } else {
        delete load(pref)[id];
        failed[id] = { url, reason: b.error || (b.names.length ? `${b.names.length}人しか（または${b.names.length}人も）取れない` : '名前の形のものが見つからない'), checked_at: today() };
      }
      if (++done % 50 === 0) console.error(`${done}/${todo.length}`);
    }
  }));
  for (const [pref, obj] of Object.entries(files)) {
    const sorted = Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
    fs.writeFileSync(path.join(OUT, `${pref}.json`), JSON.stringify(sorted, null, 0).replace(/,"(?=[^"]+\/)/g, ',\n"') + '\n');
  }
  fs.writeFileSync(failLog, JSON.stringify(failed, null, 1) + '\n');
  const all = fs.readdirSync(OUT).filter((f) => f.endsWith('.json') && !f.startsWith('.')).reduce((n, f) => n + Object.keys(JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))).length, 0);
  const name = (id) => { const [p, m] = id.split('/'); return m === '@' ? `${p}議会` : `${p}${m.replace(/^.+?郡/, '')}議会`; };
  fs.writeFileSync(LOG, [
    '# 議員の名前を抜き出せなかった議会',
    '',
    `\`node scripts/roster-names.js\` が書き出す（最後に走らせた日：${today()}）。議員名簿のページ（site/data/roster.json）は見つかっているが、機械では名前を抜き出せなかった議会。`,
    '名簿が PDF・画像のもの、名前の書き方が変わっているものが多い。このサイトでは、名簿のページへのリンク（議員名簿（公式））だけを出している。',
    '',
    ...Object.entries(failed).sort((a, b) => pop[b[0]] - pop[a[0]]).map(([id, f]) => `- [ ] ${name(id)}（${f.reason}）：[${f.url}](${f.url})`),
    '',
  ].join('\n'));
  console.error(`名前を抜き出せた議会：${all} 件・抜き出せなかった：${Object.keys(failed).length} 件`);
}
main();
