#!/usr/bin/env node
// 議員名簿のページ（site/data/roster.json）から、議員の名前を抜き出す。
//   node scripts/roster-names.js                … 人口の多い順に、まだ抜き出していない議会を100件
//   node scripts/roster-names.js --next 2000    … 件数を変える
//   node scripts/roster-names.js --only 東京都  … その都道府県（と中の市区町村）だけやり直す
//   node scripts/roster-names.js --retry --next 600 … 前に抜き出せなかった議会もやり直す
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
    let t = '';
    try { t = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', f, '-'], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* 下で PyMuPDF を試す */ }
    // 日本語の字体の表（CMap）が入っていない pdftotext では、日本語の PDF が文字にならない。PyMuPDF があればそちらで読む
    if (!/[一-龥ぁ-ん]/.test(t)) {
      try { t = execFileSync('python', ['-I', '-c', 'import sys,fitz\nd=fitz.open(sys.argv[1])\nsys.stdout.buffer.write("\\n".join(p.get_text() for p in d).encode("utf-8"))', f], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* なし */ }
    }
    if (!t.trim()) return { error: 'PDF（文字にできない）' };
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
const STOP = /名前|ふりがな|フリガナ|よみがな|議員|議長|委員|会派|名簿|紹介|一覧|選挙|定数|任期|氏名|住所|電話|所属|当選|年齢|生年|期数|地区|議会|自民|公明|共産|立憲|維新|民主|無所属|クラブ|会$|党$|市$|町$|村$|区$|県$|都$|府$|道$|事務局|ページ|トップ|ホーム|お問い合わせ|サイト|検索|メニュー|政策|活動|報告|日程|本会議|常任|特別|予算|決算|総務|文教|厚生|建設|経済|環境|福祉|産業|交通|教育|農林|観光|広報|議事|請願|陳情|会議録|中継|映像/;

// 表の見出し（「氏　名」「住　所」）や住所（「新宮町 上府北」）を名前とみなさない
// 名字は漢字だけ・ひらがなだけ・カタカナだけのどれか（「裕う」のように混ざるのは PDF の文字の並びが崩れたもの）
const oneScript = (x) => new RegExp(`^[${KANJI}ヶノ之]+$`).test(x) || /^[ぁ-ん]+$/.test(x) || /^[ァ-ヶー]+$/.test(x);
const isName = (m) => oneScript(m[1]) && !/及/.test(m[0]) && !/(郡|市)$/.test(m[2]) && !/(会|党|団)$/.test(m[1]) && !/(選出|会派)$/.test(m[2]) && !/(課|係|局)$/.test(m[1]) && !/(課|係|室|局)$/.test(m[2]) && !STOP.test(`${m[1]}${m[2]}`) && !STOP.test(m[0]) && !/(都|道|府|県|市|町|村|区|郡)$/.test(m[1]) && !(m[1].length === 1 && m[2].length === 1 && /^(氏名|住所|党派|欠員|備考|写真|役職|期数|議席|年齢|性別|職業|現職|新人|定数|会長|議長|職名|期別|役職|会派|当選|回数|順位)$/.test(m[1] + m[2]));
// よみがなを別の要素に書いている名簿では、ひらがなだけの名前と漢字の名前が同じ数ずつ取れる。そのときはひらがなだけのほうを落とす
const dropReadings = (names) => {
  const kana = names.filter((n) => /^[ぁ-んー ]+$/.test(n) || /^[ァ-ヶー ]+$/.test(n));
  const other = names.length - kana.length;
  return kana.length >= 3 && other >= 3 && kana.length / other > 0.6 && kana.length / other < 1.4 ? names.filter((n) => !kana.includes(n)) : names;
};
// 空白なしの名前を見分けるための名字の一覧。これまでに「姓 名」の形で取れた名前と、国会議員の名簿から作る
const SURNAMES = new Set(fs.readFileSync(path.join(__dirname, 'surnames.txt'), 'utf8').split(/\r?\n/).filter((x) => x && !x.startsWith('#')));
const hasSurname = (flat) => [4, 3, 2, 1].some((k) => flat.length - k >= 1 && flat.length - k <= 4 && SURNAMES.has(flat.slice(0, k)));
const MENU = /選出|について|情報|手続|結果|取り組み|取組|標準|拡大|縮小|中文|隠す|English|한국|閉じる|戻る|もっと|詳細|お知らせ|新着|募集|申請|案内|制度|計画|予算|子育て|健康|医療|防災|観光|文化|環境|税|ごみ|住まい|仕事|施設|地図|リンク|イベント|カレンダー|サイト|ログイン|一覧|名簿|紹介/;
const clean = (s) => s.replace(/<rt>[\s\S]*?<\/rt>|<rp>[\s\S]*?<\/rp>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&')
  .replace(/[（(][^）)]*[）)]/g, '').replace(/(議員|君|さん|氏)$/, '').trim();
const YOMI = new RegExp(`(?:^|[ 、|｜.．0-9０-９])([${KANJI}][${KANJI}ぁ-んァ-ヶー]{0,4}(?: [${KANJI}ぁ-んァ-ヶー]{1,4})?) ?[（(] ?([ぁ-んー]+ [ぁ-んー]+) ?[)）]`, 'g');
const join = (m) => `${m[1]} ${m[2]}`.normalize('NFC');

function extract(page, min = 2) {
  const h = page.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ');
  // 頭のメニュー・足もとは落とす（main があれば main だけ）
  const body = (h.match(/<main[\s\S]*?<\/main>/i) || h.match(/<div[^>]+id=["'](?:main|contents?|tmp_contents|content-main|mainContents)["'][\s\S]*/i) || [h])[0];
  const groups = { a: [], td: [], li: [], p: [] };
  const take = (key, re) => {
    for (const m of body.matchAll(re)) {
      for (const line of clean(m[1]).split(/\n/)) {
        const t = line.trim().normalize('NFC').replace(/^(氏[ 　]*名|名[ 　]*前|議員名)[ 　:：]+/, '');
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
    // 「藤川隆夫 |（注1）| フジカワ タカオ」のような注のセルは飛ばす
    const note = /^([（(]注\d*[)）]|※\d*)$/;
    const c0 = cells[i].replace(/[（(]注\d*[)）]|※\d*/g, '').trim();
    const n = c0.replace(/[\s　]+/g, '');
    const next = note.test(cells[i + 1]) ? cells[i + 2] || '' : cells[i + 1];
    if (NOSPACE.test(n) && !STOP.test(n) && KANA.test(next) && n.length >= 2) {
      const sp = c0.match(SPACED);
      kanaPair.push(sp ? join(sp) : n);
    }
  }
  groups.kana = kanaPair;
  // 見出しが「氏名」「名前」「議員名」の列（空白なしの名前でもよい）
  const col = [];
  for (const [table] of body.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const trs = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(([tr]) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => clean(m[1]).replace(/[\s　]+/g, ' ').trim()));
    const hi = trs.findIndex((r) => r.some((c) => /^(氏 ?名|名 ?前|議員名|議員氏名)$/.test(c)));
    if (hi < 0) continue;
    const ci = trs[hi].findIndex((c) => /^(氏 ?名|名 ?前|議員名|議員氏名)$/.test(c));
    for (const r of trs.slice(hi + 1)) {
      const t = (r[ci] || '').split(' ').length > 2 ? '' : (r[ci] || '');
      const flat = t.replace(/ /g, '');
      if (flat.length >= 2 && flat.length <= 8 && NOSPACE.test(flat) && !STOP.test(flat) && !MENU.test(flat) && !/(都|道|府|県|市|町|村|区|郡|課|係|室|局)$/.test(flat) && (t.includes(' ') || hasSurname(flat))) col.push(t);
    }
  }
  groups.col = col;
  // 名前のすぐ後ろに（よみがな）が付いた書き方（例：赤木一雄（あかぎ かずお））
  // ruby のよみがな（<rt>）は（よみがな）として残す
  const plainBody = body.replace(/<rp>[\s\S]*?<\/rp>/gi, '').replace(/<rt>([\s\S]*?)<\/rt>/gi, '($1)').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').normalize('NFC').replace(/[\s　]+/g, ' ');
  groups.yomi = [...plainBody.matchAll(YOMI)].map((m) => m[1].trim().replace(/^\S+(区|市|郡|党|会) /, ''))
    .filter((t) => { const f = t.replace(/ /g, ''); return f.length >= 2 && f.length <= 8 && !STOP.test(f) && !MENU.test(f) && !/(都|道|府|県|市|町|村|区|郡|課|係|室|局)$/.test(f); });
  // 一人ずつのページへのリンクが同じ場所（同じフォルダ）に並んでいる名簿：リンクの文字が名前（空白なしでもよい）
  const byDir = {};
  for (const m of body.matchAll(/<a\s[^>]*href=["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const t = clean(m[2]).replace(/[\s　]+/g, ' ').trim();
    const flat = t.replace(/ /g, '');
    if (flat.length < 2 || flat.length > 8 || !NOSPACE.test(flat) || STOP.test(flat) || MENU.test(flat) || /(都|道|府|県|市|町|村|区|郡|行|課|室|会|党|局|館|所|園|表|書|集|版|式|案|法|等|中)$/.test(flat)) continue;
    const dir = m[1].replace(/[^/]*$/, '');
    (byDir[dir] ||= []).push(t);
  }
  // 名字の一覧にある名字で始まるものが7割以上の並びだけを名簿とみなす
  const prof = Object.values(byDir).map((xs) => [...new Set(xs)]).filter((xs) => xs.filter((x) => x.includes(' ') || hasSurname(x)).length >= xs.length * 0.7)
    .sort((a, b) => b.length - a.length)[0] || [];
  if (prof.length >= 5) groups.prof = prof;
  // 「中川 崇」と「中川崇」は同じ人。空白のあるほうを残す
  const uniq = (xs) => {
    const m = new Map();
    for (const x of xs.map((y) => y.replace(/[\s　]+/g, ' ').trim())) { const k = x.replace(/ /g, ''); if (!m.has(k) || (x.includes(' ') && !m.get(k).includes(' '))) m.set(k, x); }
    return [...m.values()];
  };
  // 並びごとに集め、名前の多い並びから順に合わせる（名簿が表と箇条書きに分かれていることがある）。
  // 2人未満しか集まらない並びは、見出しなどの拾いすぎとみて使わない
  const ranked = Object.entries(groups).map(([key, xs]) => [key, uniq(xs)]).filter(([, u]) => u.length >= min).sort((a, b) => b[1].length - a[1].length);
  // 「いそべ 尚哉」の「尚哉」だけのように、ほかの名前の後ろの部分だけのものは落とす
  const all = uniq(ranked.flatMap(([, u]) => u));
  const flat = all.map((x) => x.replace(/ /g, ''));
  const names = all.filter((x, i) => x.includes(' ') || !flat.some((y, j) => j !== i && y.length > flat[i].length && y.endsWith(flat[i])));
  return { key: ranked.map(([k]) => k).join('+') || null, names: dropReadings(names), withReading: new Set(groups.kana || []) };
}

function extractText(text) {
  const names = [];
  for (const line of text.split(/\n/)) {
    for (const cell of line.split(/\s{2,}|\t|　{2,}/)) {
      const t = cell.normalize('NFC').replace(/[（(][^）)]*[）)]/g, '').replace(/(議員|君)$/, '').trim();
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
// 名簿の入口のページでは名前が取れず、名前が並ぶページが別にある議会（目で見て確かめたもの）
// 文字列はそのページを読む。{ url, follow } は、そのページの follow に合う文字のリンク（会派別・選挙区別など）を全部開いて合わせる
const PAGES = {
  '東京都/@': 'https://www.gikai.metro.tokyo.lg.jp/membership/',
  '新潟県/新潟市': 'https://www.city.niigata.lg.jp/shigikai/index_meibo/meibo_02kaihabetsu.html',
  '大阪府/大阪市': { url: 'https://www.city.osaka.lg.jp/shikai/page/0000002245.html', follow: /議員団$/ },
  '宮城県/仙台市': { url: 'https://www.gikai.city.sendai.jp/list/district/index.html', follow: /^(青葉|宮城野|若林|太白|泉)区$/ },
  '北海道/@': { url: 'https://www.gikai.pref.hokkaido.lg.jp/meibo/pdf-index.html', follow: /^[あかさたなはまやらわ]～/ },
  '神奈川県/横浜市': 'https://www.city.yokohama.lg.jp/shikai/giin/50on.html',
  '京都府/京都市': 'https://www2.city.kyoto.lg.jp/shikai/meibo/gojuon.html',
  '岡山県/岡山市': 'https://www.city.okayama.jp/gikai/0000015787.html',
  '埼玉県/@': 'https://www.pref.saitama.lg.jp/e1601/gikai-member-50on.html',
  '福岡県/@': 'https://www.gikai.pref.fukuoka.lg.jp/site/giin/all.html',
  '沖縄県/@': 'https://www.pref.okinawa.jp/kensei/gikai/1017039/1029763/1029769.html',
  '石川県/@': 'https://www.pref.ishikawa.lg.jp/gikai/meibo/20150430.html',
  '兵庫県/@': 'https://web.pref.hyogo.lg.jp/gikai/giinshokai/shokai/50on/50on_ichiran23.html',
  // ページの「11人」は会派の人数なので、定数を書く
  '佐賀県/@': { url: 'https://www.pref.saga.lg.jp/gikai/kiji00366725/index.html', seats: 38 },
  '群馬県/@': 'https://www.pref.gunma.jp/site/gikai/25703.html',
  '宮崎県/宮崎市': 'https://www.city.miyazaki.miyazaki.jp/fs/8/8/7/1/8/7/_/______R8.7.1___.pdf',
  '神奈川県/相模原市': 'https://www.sagamihara-shigikai.jp/doc/2013122400014/',
  '東京都/足立区': 'https://www.gikai-adachi.jp/g07_giinlist.asp?Hmode=20',
  '大阪府/@': 'https://www.pref.osaka.lg.jp/o170010/gikai_somu/sugatami20/index50.html',
  '熊本県/@': 'https://www.pref.kumamoto.jp/site/gikai/51859.html',  // 全議員名簿（会派別）
  '栃木県/@':'https://www.pref.tochigi.lg.jp/p01/assembly/giin/meibo/giinmeibokaihayobi.html',  // 50音別は画像。会派別は文字
  '神奈川県/@': { url: 'https://www.pref.kanagawa.jp/gikai/p80275.html', seats: 105 },  // 選挙区ごとの「定数N人」しか書いてない
};
async function readMerged({ url, follow }) {
  const p = await html(url);
  if (!p.html) return { names: [], error: p.error || '開けない' };
  const links = [...new Set([...p.html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .filter(([, , t]) => follow.test(t.replace(/<[^>]+>/g, '').trim())).map(([, h]) => new URL(h, url).href))];
  const all = [];
  for (const l of links.slice(0, 40)) {
    const q = await html(l);
    const c = q.text != null ? extractText(q.text) : q.html ? extract(q.html, 1) : { names: [] };
    all.push(...c.names);
  }
  return { key: `merge${links.length}`, names: [...new Set(all)], url, seats: seats(p.html) };
}
// 目で見て名前でないものを拾うとわかった議会（読み方を直すまで使わない）
const SKIP = { '千葉県/匝瑳市': '名前でないもの（地名）を拾う' };
// 一文字ずつの「姓 名」は表の見出しや言葉のことが多い。言葉の一覧にあるものは落とし、3つ以上あれば名簿ごと使わない
const WORDS = /^(欠員|欠番|会計|団長|代表|幹事|農業|無職|顧問|派遣|銀座|清住|本陣|新風|会長|理事|監事|委員|議員|職名|期別|回数|氏名|住所|党派|備考|写真|役職|期数|議席|年齢|性別|職業|定数|議長|一般質問|承認|選任|適任|許可|決定)$/;
const tidy = (r) => {
  // 「亀 田 尚 之」のように一文字ずつ空いているものはつなげる
  r.names = [...new Set(r.names.map((x) => (/^(\S )+\S$/.test(x) && x.split(' ').length >= 3 ? x.replace(/ /g, '') : x)))];
  r.names = r.names.filter((x) => !WORDS.test(x.replace(/ /g, '')) && !/及|職業|視察|状況|執行|交際費|議席|役場|学校|病院|センター|(郡|市|区|町|村|署|家|館)$/.test(x));
  // 空白なしの名前が「姓 名」の名前と混じっているときは、名字の一覧にある名字で始まるものだけ残す（「圭二」のような下の名前だけ・地名を落とす）
  if (r.names.some((x) => x.includes(' '))) r.names = r.names.filter((x) => x.includes(' ') || (r.withReading && r.withReading.has(x)) || [4, 3, 2].some((k) => x.length - k >= 1 && SURNAMES.has(x.slice(0, k))));
  if (r.names.filter((x) => /^. .$/.test(x) && !SURNAMES.has(x[0])).length >= 2 || r.names.filter((x) => /^. .$/.test(x)).length >= 3) r.error = '一文字ずつの言葉を拾っている';
  return r;
};
async function read(url, lo, hi) {
  const r = tidy(typeof url !== 'object' ? await readRaw(url, lo, hi) : url.follow ? await readMerged(url) : await readRaw(url.url, lo, hi));
  // ページの人数の書き方が読めない議会は、PAGES に書いた現員を使う
  if (typeof url === 'object' && url.seats) r.seats = url.seats;
  if (r.error) return r;
  const n = r.seats;
  // 書いてある人数より多いときは、よみがなが混じっているとみて、ひらがなだけの名前を落としてみる
  if (n && r.names.length > n) r.names = r.names.filter((x) => !/^[ぁ-んー ]+$/.test(x));
  // 書いてある人数の9割に届かなければ、一部しか取れていないとみる（欠員があるので少しの差は認める）
  // ひらがなだけの名前が多いのは、よみがなを拾っている見込みが高い（宛名に使えない）
  const kana = r.names.filter((x) => /^[ぁ-んァ-ヶー ]+$/.test(x)).length;
  if (r.names.length && kana / r.names.length > 0.3) return { ...r, error: 'よみがなを拾っている' };
  // 名字の一覧にある名字で始まるものが半分に届かなければ、名前でないもの（地名・課の名前など）を拾っているとみる
  const known = r.names.filter((x) => { const f = x.replace(/ /g, ''); return /^[ぁ-んァ-ヶー ]+$/.test(x) || (x.includes(' ') ? (x.split(' ')[0].length >= 2 && /[一-龥々]/.test(x)) || SURNAMES.has(x.split(' ')[0]) : [4, 3, 2].some((k) => f.length - k >= 1 && SURNAMES.has(f.slice(0, k)))); }).length;
  if (r.names.length && SURNAMES.size > 500 && known / r.names.length < 0.5) return { ...r, error: '名前でないものを拾っている' };
  // 人数が書いてないときに8人に届かないのは、委員会など一部の名簿を拾っている見込みが高い
  if (!n && r.names.length < 8) return { ...r, error: `${r.names.length}人しか取れない（人数が書いてない）` };
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
  const pages = [[url, p.html]];
  for (const l of [...new Map(subs.map((x) => [x.href, x])).values()].sort((a, b) => /50音|五十音|一覧/.test(b.text) - /50音|五十音|一覧/.test(a.text)).slice(0, 6)) {
    const q = await html(l.href);
    if (q.html) pages.push([l.href, q.html]);
    const c = q.text != null ? extractText(q.text) : q.html ? extract(q.html) : { names: [] };
    const ok = (x) => x.names.length >= lo && x.names.length <= hi;
    c.seats = (q.html || q.text) ? seats(q.html || q.text) || b.seats : b.seats;
    if (ok(c) && (!ok(best) || c.names.length > best.names.length)) best = { ...c, url: l.href };
  }
  // 「あ行」「か行」…に分かれた名簿は、全部の行を開いて合わせる
  if (!(best.names.length >= lo && best.names.length <= hi)) {
    const raw = pages.flatMap(([base, h]) => [...h.matchAll(/<a\s[^>]*href=["']([^"'#]*)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, x, t]) => [x, t.replace(/<[^>]+>/g, '').trim()]).filter(([, t]) => /^[あかさたなはまやらわ](行|ぎょう)$/.test(t))
      .map(([x]) => { try { return new URL(x || base, base).href; } catch { return null; } }).filter(Boolean));
    const rows = raw.length >= 3 ? [...new Set(raw)] : [];
    if (rows.length) {
      const all = [];
      for (const h of rows.slice(0, 10)) { const q = await html(h); if (q.html) all.push(...extract(q.html).names); }
      const u = [...new Set(all)];
      if (u.length > best.names.length) best = { key: 'gyo', names: u, url: rows.length === 1 ? rows[0] : url, seats: b.seats };
    }
  }
  return best;
}

const range = (level) => (level === 'pref' ? [30, 130] : [5, 110]);

// 名簿のページからは名前の形が読めない議会は、ほかで集めた名前の候補（scripts/roster-candidates.js）を、
// 名簿のページ（と、そこからの名簿らしいリンク・PDF）の文字の中に探す。書いてあった名前だけを使う
const CAND_FILE = path.join(__dirname, 'roster-candidates', 'discussvision.json');
const CAND = fs.existsSync(CAND_FILE) ? JSON.parse(fs.readFileSync(CAND_FILE, 'utf8')).councils : {};
const flat = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, '')
  .replace(/[\s　]+/g, '').replace(/[﨑]/g, '崎').replace(/[髙]/g, '高').replace(/󠄀/g, '');
async function confirm(id, url, lo) {
  const c = CAND[id];
  if (!c) return null;
  const u = url.url || url;
  const p = await html(u);
  if (p.error) return null;
  const texts = [flat(p.text != null ? p.text : p.html)];
  if (p.html) {
    const subs = [...p.html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, h, t]) => { try { return { href: new URL(h, u).href, text: t.replace(/<[^>]+>/g, '').trim() }; } catch { return null; } })
      .filter((l) => l && (SUB.test(l.text) || /名簿|議員|一覧|会派/.test(l.text)) && !/歴代|元議員|報酬|政務活動|資産|委員会|会議録|中継/.test(l.text) && l.href !== u);
    for (const l of [...new Map(subs.map((x) => [x.href, x])).values()].slice(0, 6)) {
      const q = await html(l.href);
      if (q.html || q.text) texts.push(flat(q.text != null ? q.text : q.html));
    }
  }
  const all = texts.join('|');
  const names = [...new Set(c.names.filter((n) => all.includes(flat(n))))];
  const seats_ = seats(p.text != null ? p.text : p.html);
  if (names.length < Math.max(lo, 8)) return null;
  if (seats_ ? names.length < Math.floor(seats_ * 0.9) || names.length > seats_ : names.length < c.names.length * 0.5) return null;
  return { key: 'dv', names, url: u, seats: seats_ || null, via: `議会中継の発言者の一覧（tenant ${c.tenant}）の名前を、名簿のページで確かめた` };
}

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
    const u = opt('--url')[0] || PAGES[id] || roster[id].url;
    const b = await read(u, lo, hi);
    console.log(b.url || u, b.error || '', '定数など:', b.seats, b.key, b.names.length, b.names.join('、'));
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
  const todo = only.length ? ids.filter(inOnly) : ids.filter((id) => !(id in load(id.split('/')[0])) && (args.includes('--retry') || !(id in failed))).slice(0, next);
  console.error(`${todo.length} 件の名簿を読む`);
  const queue = [...todo];
  let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let id; (id = queue.shift());) {
      const pref = id.split('/')[0];
      const url = PAGES[id] || roster[id].url;
      const [lo, hi] = range(level[id]);
      let b = SKIP[id] ? { names: [], error: SKIP[id] } : await read(url, lo, hi);
      if (!SKIP[id] && (b.error || b.names.length < lo || b.names.length > hi)) b = (await confirm(id, url, lo)) || b;
      if (!b.error && b.names.length >= lo && b.names.length <= hi) {
        load(pref)[id] = { names: b.names.map((x) => x.replace(/[\u{E0100}-\u{E01EF}︀-️]/gu, '')), url: b.url, seats: b.seats || null, ...(b.via ? { via: b.via } : {}), checked_at: today() };
        delete failed[id];
      } else {
        delete load(pref)[id];
        failed[id] = { url: url.url || url, reason: b.error || (b.names.length ? `${b.names.length}人しか（または${b.names.length}人も）取れない` : '名前の形のものが見つからない'), checked_at: today() };
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
if (require.main === module) main();
module.exports = { read, html, extract };
