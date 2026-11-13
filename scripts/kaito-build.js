#!/usr/bin/env node
// 自治体ごとの「寄せられた意見と回答」の一覧（scripts/kaito-fetch.js で集めたもの）から、
//  1. 回答の一覧のページ（list）を決め、
//  2. 一覧にある個別の回答のうち、各テーマの自治体あての項目（asks-local.js）に関係のあるものを選び、
//  3. その回答のページを開いて回答（なければ掲載・更新）の年月日を読み取って、
// site/data/kaito/kaito.jsonl（本体。1行1自治体）と site/data/kaito.js（作成画面用）に書き出す。
//   node scripts/kaito-build.js [--no-llm] [--files] [id ...]
// 関係のあるものの選び方：手元の Ollama で、bge-m3 の埋め込みで近いものを絞り、qwen3:8b に「関係があるか」を1件ずつ聞く。
// 機械で選んだものなので、作成画面では「機械で選んだ」と印を付ける。人が確かめたものは kaito.jsonl の checked を true にする。
// 埋め込み・判定・日付の結果は scripts/.intake-cache/kaito-*.json に取っておき、2回目からは聞き直さない。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const CACHE = path.join(__dirname, '.intake-cache');
const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const THEMES = ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota'];
const WORDS = require('./search-words');
const OUT = path.join(SITE, 'data', 'kaito');

const loadJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const EMB_F = path.join(CACHE, 'kaito-emb.json');
const JUDGE_F = path.join(CACHE, 'kaito-judge.json');
const DATE_F = path.join(CACHE, 'kaito-date.json');
const emb = loadJson(EMB_F, {});
const judge = loadJson(JUDGE_F, {});
const dates = loadJson(DATE_F, {});
const save = () => {
  fs.writeFileSync(EMB_F, JSON.stringify(emb));
  fs.writeFileSync(JUDGE_F, JSON.stringify(judge));
  fs.writeFileSync(DATE_F, JSON.stringify(dates));
};

// これだけでは話題が決まらない語
const GENERIC = /^(子ども|子供|こども|相談|窓口|学校|支援|情報|制度|家族|家庭|教育|意見|女性|男性|健康|行政|地域|自治体|市民|住民|広報|計画|対策|離婚|別居親|税|税金|お金)$/;
function asks() {
  return THEMES.flatMap((theme) => {
    const ctx = { window: {} };
    ctx.window.window = ctx.window;
    vm.createContext(ctx);
    for (const f of ['theme.js', 'asks-national.js', 'asks-local.js']) vm.runInContext(fs.readFileSync(path.join(SITE, 'themes', theme, f), 'utf8'), ctx);
    return ctx.window.ASKS.filter((a) => a.scope === 'local').map((a) => ({ key: `${theme}/${a.id}`, label: a.label, terms: (WORDS[`${theme}/${a.id}`] || '').split(/\s+/).filter((w) => w.length >= 2 && !GENERIC.test(w)) }));
  });
}

// 個別の回答らしくないリンク（メニュー・制度の説明・ファイルの案内など）
const NAV = /トップ|ホーム|サイトマップ|お問い合わせ|プライバシー|個人情報|ウェブアクセシビリティ|リンク集|著作権|文字サイズ|English|ふりがな|前のページ|次のページ|一覧へ|一覧に戻|戻る|ページの先頭|Adobe|Acrobat|ダウンロード|ログイン|RSS|SNS|Facebook|X\(旧|LINE|YouTube|Instagram|ご意見・ご要望|市政への提案|意見を送る|フォーム|パブリック|広聴|受付|取扱|要領|要綱|件数|統計|集計|報告書|見える化|について$|とは$|の公表|の紹介|年度$|月分$|月$|^令和|^平成|^\d|^[０-９]|^PDF|\(PDF|（PDF|Word|Excel|ワード|エクセル/;

function itemsOf(c) {
  const out = [];
  for (const l of c.lists || []) {
    const pages = l.pages || 1;
    for (const it of l.items || []) {
      const t = it.t.replace(/\s+/g, ' ').trim();
      if (t.length < 10 || t.length > 110 || NAV.test(t)) continue;
      if ((it.n || 1) > Math.max(1, pages / 3)) continue; // 多くのページに出るのはメニュー
      out.push({ t, u: it.u });
    }
  }
  const m = new Map();
  out.forEach((x) => { if (!m.has(x.u)) m.set(x.u, x); });
  return [...m.values()];
}

async function embed(texts) {
  const need = [...new Set(texts.filter((t) => !emb[t]))];
  for (let i = 0; i < need.length; i += 64) {
    const r = await fetch(`${HOST}/api/embed`, { method: 'POST', body: JSON.stringify({ model: 'bge-m3', input: need.slice(i, i + 64) }) });
    const j = await r.json();
    need.slice(i, i + 64).forEach((t, k) => { emb[t] = j.embeddings[k].map((v) => Math.round(v * 1e4) / 1e4); });
  }
}
const cos = (a, b) => { let s = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return s / Math.sqrt(x * y); };

async function ask(prompt) {
  const r = await fetch(`${HOST}/api/generate`, { method: 'POST', body: JSON.stringify({ model: 'qwen3:8b', prompt, stream: false, think: false, format: 'json', options: { temperature: 0 } }), signal: AbortSignal.timeout(180000) }).catch(() => null);
  if (!r) return {};
  const j = await r.json();
  try { return JSON.parse(j.response); } catch { return {}; }
}
// 一覧ページにはメニューや制度の案内へのリンクも混ざるので、1件の意見・回答の題名らしいかを先に確かめる
const OPINION = /しました|希望|してほしい|して欲しい|ください|要望|改善|ご意見|提案/;
async function isOpinion(t) {
  if (OPINION.test(t)) return true;
  const k = 'op	' + t;
  if (judge[k] === undefined) judge[k] = (await ask(`自治体のサイトの「寄せられた意見と回答」の一覧ページから集めたリンクの文字です。ただし一覧ページには、サイトのメニューや分野の見出し、制度・事業の案内ページへのリンクも混ざっています。
このリンクの文字が、1件の意見（要望・提案・苦情）やそれへの回答・対応の題名かどうかを判断してください。
意見の題名の例：「警固公園における喫煙所の適正利用について」「路上喫煙を禁止する区域を拡大しました」「〇〇保育所の送迎時の雨よけ設置希望」「図書館の開館時間の延長について」
意見の題名でない例：「国民健康保険の制度」「男女共同参画に関する取り組み」「伊勢市の学校給食」「子育て支援」「各種証明書（戸籍・住民票等）」「学校給食運営委員会」
リンクの文字：${t}
JSON で {"opinion": true または false} だけを答えてください。`)).opinion === true;
  return judge[k];
}
async function related(a, title) {
  const k = `v2	${a.key}\t${title}`;
  if (judge[k] === undefined) {
    const res = await ask(`市区町村や都道府県のサイトに載っている「市民から寄せられた意見と、それへの回答」の題名があります。
この題名の意見が、次の要望と同じ話題（同じ制度・施策・問題）についてのものかを判断してください。話題が少し重なるだけ（例：どちらも子どもに関係する、どちらも学校のこと）なら false です。
また、題名が市民の意見・要望やそれへの対応の題名ではなく、制度の案内・課や事業の紹介・条例や計画の名前・分野の見出し（例：「国民健康保険の制度」「男女共同参画に関する取り組み」「子育て支援」）に見えるときも false です。
要望：${a.label}
題名：${title}
JSON で {"related": true または false} だけを答えてください。`);
    judge[k] = res.related === true;
  }
  return judge[k];
}

const chunk = (rows, n) => { const o = []; for (let i = 0; i < rows.length; i += n) o.push(rows.slice(i, i + n).join('\n')); return o; };
async function fromFile(a, txt, k) {
  if (judge[k] === undefined) {
    const res = await ask(`次は、自治体が公開している「寄せられた意見と回答」の一覧（PDF・エクセルから取り出した文字。表の列が混ざっていることがあります）の1ページです。
この中に、次の要望と同じ話題（同じ制度・施策・問題）についての意見があるかを判断してください。話題が少し重なるだけなら false です。
あれば、その意見の件名（なければ要旨の最初の30字）を原文のまま、受付日（あれば）を西暦の YYYY-MM-DD で答えてください。
要望：${a.label}
---
${txt.slice(0, 3500)}
---
JSON で {"related": true または false, "title": "件名", "date": "YYYY-MM-DD または null"} だけを答えてください。`);
    judge[k] = res.related === true && res.title ? { title: String(res.title).slice(0, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(res.date) ? res.date : null } : false;
  }
  return judge[k];
}

// 題名の中の日付。日まであれば YYYY-MM-DD、月までなら YYYY-MM
function titleDate(t) {
  const z = t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, '');
  const pad = (n) => String(n).padStart(2, '0');
  const era = (e, y) => (y === '元' ? 1 : +y) + ({ 令和: 2018, R: 2018, 平成: 1988, H: 1988 })[e];
  let m = z.match(/(令和|平成)(\d+|元)年(\d+)月(?:(\d+)日)?/);
  if (m) return `${era(m[1], m[2])}-${pad(m[3])}${m[4] ? `-${pad(m[4])}` : ''}`;
  m = z.match(/(?:^|[^A-Za-z])(R|H)(\d{1,2})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return `${era(m[1], m[2])}-${pad(m[3])}-${pad(m[4])}`;
  m = z.match(/(20\d\d)年(\d{1,2})月(?:(\d{1,2})日)?/);
  if (m) return `${m[1]}-${pad(m[2])}${m[3] ? `-${pad(m[3])}` : ''}`;
  return null;
}

// 回答のページから年月日を読む。回答日 > 受付日 > 掲載・更新日の順に使う
const toISO = (s) => {
  const z = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, '');
  let m = z.match(/(令和|平成)(\d+|元)年(\d+)月(\d+)日/);
  if (m) { const y = (m[2] === '元' ? 1 : +m[2]) + (m[1] === '令和' ? 2018 : 1988); return `${y}-${String(m[3]).padStart(2, '0')}-${String(m[4]).padStart(2, '0')}`; }
  m = z.match(/(20\d\d)[年/.-](\d{1,2})[月/.-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
};
const DATE = '((?:令和|平成)\\s*[0-9０-９元]+\\s*年\\s*[0-9０-９]+\\s*月\\s*[0-9０-９]+\\s*日|20\\d\\d\\s*[年/.-]\\s*\\d{1,2}\\s*[月/.-]\\s*\\d{1,2})';
async function dateOf(u) {
  if (dates[u]) return dates[u];
  let res = null;
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)' }, signal: AbortSignal.timeout(20000) });
    if (/html/.test(r.headers.get('content-type') || '')) {
      const buf = Buffer.from(await r.arrayBuffer());
      const cs = ((r.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
      let h; try { h = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { h = buf.toString('utf8'); }
      const after = h.split(/<\/h1>/i).slice(1).join(' ') || h;
      const body = after.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const text = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      for (const [kind, re] of [['回答', `回答(?:日|年月日)\\s*[:：]?\\s*${DATE}`], ['受付', `(?:受付|受理|受信)(?:日|年月日)\\s*[:：]?\\s*${DATE}`], ['掲載', `(?:掲載|公開|更新|作成|最終更新)(?:日|年月日)?\\s*[:：]?\\s*${DATE}`], ['回答', `${DATE}\\s*回答`]]) {
        const m = text.match(new RegExp(re));
        if (m) { res = { d: toISO(m[1]), k: kind }; break; }
      }
      // 見出しのすぐ後の日付（掲載日として書かれていることが多い）
      if (!res) { const m = body.slice(0, 400).match(new RegExp(DATE)); if (m) res = { d: toISO(m[1]), k: '掲載' }; }
    }
  } catch { /* 取れなかった */ }
  dates[u] = res;
  return res;
}

// 本体は2つのファイル（どちらも1行1件。将来の「どの自治体でどんな要望・陳情が通ったか」の検索にそのまま使う）
//   lists.jsonl：自治体ごとの回答の一覧のページ
//   items.jsonl：一覧から集めた個別の回答（関係のある項目がないものも全部入れる）
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []);
const writeJsonl = (f, rows) => fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const LIST_BAD = /計画|戦略|案）|案\)|（案|\(案|素案|方針|ビジョン|構想|条例|世論調査|アンケート|タウンミーティング|懇話会|懇談会|審議|委員|定例会|議会|議案|チャットボット|移住|LINE・|SNS|メール配信|緊急メール|メールアドレス|電話|防災|組織でさがす|業務案内|設置箇所|意見公募|パブリック|監査|入札|よくある|意見交換|説明会|事業|サウンディング|技術|プレゼント|自由回答|市民会議|相談窓口|情報公開|施設|フォーム|web版|Web版|ミーティング|ワークショップ|オープンハウス|対話集会|フォーラム|交換会|会議|見つかりません|見つけること|基準|公表分類|の要旨と区の考え方|自由 回答|自由回答|^市原市ウェブサイト$|^洞爺湖町|臼杵磨崖仏|PDF形式|PDFファイル|^PDF/;
const LIST_GOOD = /回答|お答え|と(?:市|区|町|村|県|府|都|道)の考え|寄せられ|お寄せ|いただい|頂い|紹介|提言集|意見集|声一覧|反映|事例|こえ|の声|提言|提案|公開|公表|対応/;
const LIST_OK = (t) => LIST_GOOD.test(t) && !LIST_BAD.test(t);
const RESULT = (t) => (/しました|始めました|設置|改善|変更|拡大|見直し|追加|開始|実施|導入|反映/.test(t) ? 'reflected' : null);

async function main() {
  const args = process.argv.slice(2);
  const noLlm = args.includes('--no-llm');
  const only = args.filter((a) => !a.startsWith('--'));
  const A = asks();
  fs.mkdirSync(OUT, { recursive: true });
  const LF = path.join(OUT, 'lists.jsonl');
  const IF = path.join(OUT, 'items.jsonl');
  const lists = new Map(readJsonl(LF).map((r) => [r.muni, r]));
  const items = new Map(readJsonl(IF).map((r) => [r.url, r]));
  // 生成AIの判定を、人（または Claude）が題名と中身で見直した結果。review.jsonl の1行：{url, ok: [項目], ng: [項目], by, at}
  const review = new Map(readJsonl(path.join(OUT, 'review.jsonl')).map((r) => [r.url, r]));
  const caches = fs.readdirSync(path.join(CACHE, 'kaito')).map((f) => loadJson(path.join(CACHE, 'kaito', f))).filter((c) => c && (!only.length || only.includes(c.id)));
  for (const c of caches) {
    const p = lists.get(c.id);
    if (p && p.checked) continue; // 人が確かめた行は機械で上書きしない
    // 点の高い候補でも、計画案への意見・世論調査・SNSの案内などは回答の一覧ではないので、題名で選び直す
    // 一覧のページの題名（開いたときの題名。転送されて URL が変わったものは、開いた順で対応させる）
    const top = (c.candidates || []).slice(0, 2);
    const listOf = (x) => (c.lists || []).find((l) => l.u === x.u) || (top.includes(x) ? (c.lists || [])[top.indexOf(x)] : null) || {};
    const ok = (x) => { const t = listOf(x).t || ''; return x.s >= 3 && !LIST_BAD.test(x.t) && !LIST_BAD.test(t) && LIST_GOOD.test(t || x.t); };
    const best = (c.candidates || []).find(ok);
    if (!best || best.s < 3) {
      if (p) lists.delete(c.id);
      for (const [u, it] of items) if (it.muni === c.id && !it.checked) items.delete(u);
      continue;
    }
    const list = listOf(best);
    lists.set(c.id, { muni: c.id, kind: 'yobo', url: list.u || best.u, title: (list.t || best.t).replace(/&gt;/g, '>').slice(0, 80), found_at: c.fetched_at, route: 'auto_extract', checked: false });
    let hit = 0;
    for (const x of itemsOf(c)) {
      const o = items.get(x.u);
      if (o && o.checked) continue;
      const td = titleDate(x.t);
      const it = { muni: c.id, kind: 'yobo', title: x.t, url: x.u, date: (o && o.date) || null, date_kind: (o && o.date_kind) || null, result: RESULT(x.t), asks: noLlm && o ? o.asks : [], found_at: c.fetched_at, route: 'auto_extract', checked: false };
      if (!noLlm) {
        for (const a of A) if (a.terms.some((w) => x.t.includes(w)) && await isOpinion(x.t) && await related(a, x.t)) it.asks.push(a.key);
        // 一覧の題名に日付が付いていれば（例：「〜について (2026年11月13日)」）それを使う
        if (!it.date) { const m = x.t.match(new RegExp(DATE)); if (m) { it.date = toISO(m[1]); it.date_kind = '掲載'; } }
        if (it.asks.length && !it.date) { const d = await dateOf(x.u); if (d) { it.date = d.d; it.date_kind = d.k; } }
      }
      // 題名に日付があれば（例：「〜（令和8年9月30日回答）」「R4.9.21」「（令和7年11月）」）ページの更新日より優先する
      if (td) { it.date = td; it.date_kind = /回答/.test(x.t) ? '回答' : /受付/.test(x.t) ? '受付' : '掲載'; }
      hit += it.asks.length > 0;
      items.set(x.u, it);
    }
    // PDF・エクセルの一覧（scripts/kaito-pdf.py で文字にしたもの）。ページ（エクセルは行のまとまり）ごとに、
    // 言い換えの語があれば生成AIに、同じ話題の意見があるかと、その件名・受付日を答えさせる
    const ff = path.join(CACHE, 'kaito-files', c.id.replace(/[\/:*?"<>|]/g, '_') + '.json');
    // 手元の CPU では1ページに1分ほどかかり、数百ページある自治体もあるので、--files を付けたときだけ読む
    if (!noLlm && args.includes('--files') && fs.existsSync(ff)) {
      for (const f of loadJson(ff, [])) {
        const isPdf = /\.pdf/i.test(f.u);
        const units = isPdf ? f.pages : chunk(f.pages, 15);
        for (let pi = 0; pi < units.length; pi++) {
          const txt = units[pi];
          const url = isPdf ? `${f.u}#page=${pi + 1}` : f.u;
          for (const a of A) {
            if (!a.terms.some((w) => txt.includes(w))) continue;
            const r = await fromFile(a, txt, `${a.key}	${url}`);
            if (!r) continue;
            const o = items.get(url + '	' + r.title);
            if (o && o.checked) continue;
            const it = o || { muni: c.id, kind: 'yobo', title: r.title, url, date: r.date, date_kind: r.date ? '受付' : null, result: null, asks: [], file_title: f.t, found_at: c.fetched_at, route: 'auto_extract', checked: false };
            if (!it.asks.includes(a.key)) it.asks.push(a.key);
            items.set(url + '	' + r.title, it);
            hit += 1;
          }
        }
      }
    }
    save();
    console.error(`${c.id}\t${lists.get(c.id).title}\t関係あり ${hit}`);
  }
  const L = [...lists.values()].sort((a, b) => a.muni.localeCompare(b.muni, 'ja'));
  for (const it of items.values()) {
    const r = review.get(it.url);
    if (!r) { delete it.reviewed; continue; }
    it.asks = [...new Set([...it.asks.filter((a) => !(r.ng || []).includes(a)), ...(r.ok || [])])];
    it.reviewed = r.by;
  }
  const I = [...items.values()].sort((a, b) => a.muni.localeCompare(b.muni, 'ja') || (b.date || '').localeCompare(a.date || ''));
  writeJsonl(LF, L);
  writeJsonl(IF, I);
  // 作成画面用は、一覧のページと、項目に関係のある個別の回答だけ（全件は検索の機能を作るときに別に書き出す）
  // { "都道府県/市区町村": { l: [url, 題名, 見つけた日, 人が確かめたか], i: [[題名, url, 年月日, 日付の種類, [項目...]], ...] } }
  const web = {};
  L.forEach((r) => { web[r.muni] = { l: [r.url, r.title, r.found_at, r.checked ? 1 : 0], i: [] }; });
  I.filter((x) => x.asks.length && x.reviewed && web[x.muni]).forEach((x) => web[x.muni].i.push([x.title, x.url, x.date || '', x.date_kind || '', x.asks]));
  fs.writeFileSync(path.join(SITE, 'data', 'kaito.js'), `// 自治体ごとの「寄せられた意見と回答」。scripts/kaito-build.js が site/data/kaito/*.jsonl から書き出す（手で直さない）\nwindow.KAITO = ${JSON.stringify(web)};\n`);
  save();
  // 取れなかった・見つからなかった自治体を、あとから調べられるように残す（CLAUDE.md のきまり）
  if (!only.length) {
    const ng = caches.filter((c) => c.error || !lists.has(c.id) || (c.lists || []).some((l) => l.error));
    const line = (c) => `| ${c.id} | ${c.start} | ${c.error ? `取得できない（${c.error}）` : (c.lists || []).find((l) => l.error) ? `一覧を開けない（${c.lists.find((l) => l.error).error}）` : (c.candidates || []).some((x) => x.s >= 3) ? '候補はあったが、題名から回答の一覧ではないと判断した（計画案への意見・意見交換会など）' : c.searched === 'ok' ? '一覧らしいページが見つからない（サイト内の検索もした）' : '一覧らしいページが見つからない（検索エンジンでの検索は断られたか、まだ）'} | ${c.fetched_at} |`;
    fs.writeFileSync(path.join(ROOT, 'docs', '確認用', '回答の一覧を取得できなかった自治体.md'), `# 意見と回答の一覧を取得できなかった・見つからなかった自治体

scripts/kaito-build.js が書き出す（手で直さない）。出発点は要望の案内ページ（site/data/intake/yobo.jsonl の page_url）。案内ページのない自治体（約1090）はまだ調べていない。

| 自治体 | 出発点 | 理由 | 調べた日 |
|---|---|---|---|
${ng.map(line).join('\n')}
`);
  }
  console.error(`${L.length} 自治体、個別の回答 ${I.length} 件（項目に関係のあるもの ${I.filter((x) => x.asks.length).length} 件）`);
}
main();
