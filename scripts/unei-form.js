// 議会・自治体のオンラインのフォームに、陳情・要望の題名・本文・差出人を入れる（送信のボタンだけを人が押す）。
//
//   node scripts/unei-form.js                 … いまの回で、まだ出していない次の送り先を開いて入れる
//   node scripts/unei-form.js 三鷹市議会       … 送り先を指定する
//   node scripts/unei-form.js --text 三鷹市議会 … 入れる文面だけを出す（ブラウザを開かない）
//
// 差出人は docs/非公開/差出人.json（Git に入らない）から読む。空の欄は入れない。
// 入れ方：画面の入力欄の見出し（label・表の見出し・placeholder）から、氏名・ふりがな・郵便番号・住所・電話・メール・件名・本文を見分けて入れる。
// 見出しや注意書きに「全角」「半角」とあれば、数字・ハイフン・空白をそれに合わせる。
// 利用者登録をしない申し込み・利用規約への同意・郵便番号の検索のボタンなど、入力の前の画面は自動で進める。送信・確認へ進むは押さない。
// 画面が変わったら、コンソールで Enter を押すと、その画面にもう一度入れる。送信したら「s」で記録する（site/data/unei.js）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const SENDER = path.join(ROOT, 'docs/非公開/差出人.json');

// 公式の案内ページから見つけたフォームの入口（受け付け方のDBに form_url がないもの）。2026-11-26 に案内ページのリンクで確かめた
const ENTRY = {
  日立市議会: 'https://logoform.jp/form/tDgS/968285',
  鶴ヶ島市議会: 'https://logoform.jp/form/chro/958143',
  宝塚市議会: 'https://apply.e-tumo.jp/city-takarazuka-hyogo-u/offer/offerList_detail?tempSeq=3556',
  横浜市長: 'https://shinsei.city.yokohama.lg.jp/cu/141003/ea/residents/procedures/apply/43e04da1-b2d8-4e4b-b1d3-27ab820f9c3d/start',
};

const loadUnei = () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SITE, 'data/unei.js'), 'utf8'), ctx);
  return ctx.window.UNEI;
};

// サイトと同じ組み立て（site/js/petition.js）で、陳情書・要望書の文面を作る
function petitionText(theme, council, id, kind, sender) {
  const files = [`themes/${theme}/theme.js`, 'data/prefs.js', `themes/${theme}/asks-national.js`, `themes/${theme}/asks-local.js`, `themes/${theme}/template.js`, 'data/municipalities.js',
    'data/offices.js', 'data/sites.js', 'data/councils.js', 'data/kana.js', 'js/common.js', 'js/places.js', 'js/petition.js'];
  const ctx = { FormData };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) if (fs.existsSync(path.join(SITE, f))) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
  const fd = new FormData();
  fd.append('items', id);
  fd.append('story', '');
  fd.append('address', `${sender.pref}${sender.city}${sender.street}`);
  fd.append('name', sender.name);
  fd.append('tel', sender.tel || '');
  const text = ctx.Petition.build(fd, council, [id], kind);
  const subject = (text.match(/^件名　(.+)$/m) || [])[1] || '';
  // 日付の空欄は、出す日の日付に置き換える
  // オンラインでは押印も議長の氏名の空欄も要らない
  const body = text.replace(ctx.Common.DATE_BLANK, ctx.Common.reiwaToday()).replace(/　+印$/m, '').replace(`　${ctx.Common.BLANK_TEXT}　様`, '　様');
  return { subject, body };
}

// 全角・半角
const toHalf = (s) => s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[－ー―‐]/g, '-').replace(/　/g, ' ');
const toFull = (s) => s.replace(/[0-9A-Za-z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)).replace(/-/g, '－').replace(/ /g, '　');

// 入力欄の見出しから、何を入れるかを決める
function plan(field, s, doc) {
  const L = field.label;
  const width = /全角/.test(field.hint) ? 'full' : /半角/.test(field.hint) ? 'half' : '';
  const kana = /ふりがな|フリガナ|カナ|かな/.test(L);
  const hira = /ふりがな|ひらがな/.test(L) && !/カナ/.test(L);
  const k = (x) => (hira ? x : x.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)));
  const pc = s.postal.replace(/[^0-9０-９]/g, '');
  let v = null;
  if (field.tag === 'textarea' || /内容|本文|要旨|趣旨|意見|ご用件|提案/.test(L)) v = /件名|題名|タイトル/.test(L) && field.tag !== 'textarea' ? doc.subject : doc.body;
  else if (/件名|題名|表題|タイトル|標題/.test(L)) v = doc.subject;
  else if (/郵便/.test(L)) v = field.maxlength === 3 ? pc.slice(0, 3) : field.maxlength === 4 ? pc.slice(3) : field.part === 1 ? pc.slice(3) : field.part === 0 && field.siblings === 2 ? pc.slice(0, 3) : `${pc.slice(0, 3)}-${pc.slice(3)}`;
  else if (/都道府県/.test(L)) v = s.pref;
  else if (/市区町村|市町村/.test(L)) v = s.city;
  else if (/番地|町名|丁目/.test(L)) v = s.street;
  else if (/住所|所在地/.test(L)) v = field.siblings > 1 && field.part === 1 ? s.street : `${s.pref}${s.city}${s.street}`;
  else if (kana && (s.kana_family || s.kana_given)) v = /姓|せい|セイ/.test(L) ? k(s.kana_family) : /名(?!前)|めい|メイ/.test(L) ? k(s.kana_given) : k(`${s.kana_family}　${s.kana_given}`.trim());
  else if (kana) v = null;
  else if (/^姓$|姓\b|（姓）|氏$/.test(L)) v = s.family;
  else if (/^名$|（名）/.test(L)) v = s.given;
  else if (/氏名|お名前|名前|陳情者|要望者|提出者|代表者/.test(L)) v = s.name;
  else if (/電話|TEL|tel|携帯/.test(L)) {
    // 3つに分かれた欄（090／6311／8273）にも、1つの欄にも入れる
    const t = s.tel.split(/[-－ー]/);
    v = field.siblings === 3 && t.length === 3 ? t[field.part] : s.tel;
  } else if (/メール|mail|Mail|E-mail/.test(L)) {
    // 「@」の前と後ろに分かれた欄にも入れる。確認用の欄にも同じものを入れる
    const [user, domain] = s.email.split('@');
    v = field.siblings === 2 && !/確認|再入力|もう一度/.test(L) && /@/.test(field.hint.replace(s.email, '')) ? [user, domain][field.part] : s.email;
  }
  if (!v) return null;
  if (width === 'full') v = toFull(v);
  else if (width === 'half' || /郵便|電話|メール/.test(L)) v = toHalf(v);
  return v;
}

// 画面の入力欄を集めて、見出しを付ける（ブラウザの中で動かす）
const COLLECT = () => {
  const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
  const txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const out = [];
  const els = [...document.querySelectorAll('input[type=text],input[type=tel],input[type=email],input:not([type]),textarea,select')].filter(vis);
  els.forEach((e, i) => {
    let label = '';
    if (e.labels && e.labels.length) label = txt(e.labels[0]);
    if (!label && e.getAttribute('aria-label')) label = e.getAttribute('aria-label');
    if (!label && e.getAttribute('aria-labelledby')) label = txt(document.getElementById(e.getAttribute('aria-labelledby')));
    const row = e.closest('tr, dl, .form-group, .question, [class*=item], [class*=Item], [class*=field], [class*=Field], li, fieldset');
    if (!label && row) { const h = row.querySelector('th, dt, legend, label, h2, h3, h4, [class*=title], [class*=Title], [class*=label], [class*=Label]'); label = txt(h); }
    if (!label) label = e.placeholder || e.name || '';
    const hint = `${label} ${row ? txt(row).slice(0, 300) : ''} ${e.placeholder || ''}`;
    const same = row ? [...row.querySelectorAll('input[type=text],input[type=tel],input:not([type]),textarea')].filter(vis) : [e];
    e.setAttribute('data-unei', String(i));
    out.push({ i, name: e.name || e.id || '', tag: e.tagName.toLowerCase(), label: label.slice(0, 80), hint, maxlength: e.maxLength > 0 ? e.maxLength : 0, part: same.indexOf(e), siblings: same.length, value: e.value });
  });
  return out;
};

// 入力の前の画面を進めるボタン（送信・確認へ進むは押さない）
const PRE = /利用者登録せずに申し込む|登録せずに申し込む|ログインせずに申請|ログインしないで|同意する|同意して進む|同意して次へ|申請を始める|申請する$|手続きを開始/;

async function fillPage(page, sender, doc) {
  const done = [];
  for (const frame of page.frames()) {
    let fields;
    try { fields = await frame.evaluate(COLLECT); } catch { continue; }
    for (const f of fields) {
      // ログインの欄には入れない（ログインは人がする）
      if (f.value || /利用者ID|ログイン|パスワード|userId|loginId/i.test(`${f.label} ${f.name}`)) continue;
      const v = plan(f, sender, doc);
      if (!v) continue;
      const loc = frame.locator(`[data-unei="${f.i}"]`);
      try {
        if (f.tag === 'select') await loc.selectOption({ label: v }).catch(() => loc.selectOption(v));
        else await loc.fill(f.maxlength && v.length > f.maxlength ? v.slice(0, f.maxlength) : v);
        done.push(`${f.label || '(見出しなし)'}：${v.length > 30 ? `${v.slice(0, 30)}…（${v.length}字）` : v}${f.maxlength && v.length > f.maxlength ? `　※${f.maxlength}字までなので切りました` : ''}`);
      } catch (e) { done.push(`${f.label}：入れられませんでした（${e.message.split('\n')[0]}）`); }
    }
  }
  return done;
}

async function advance(page) {
  // 同意のチェックを入れてから、進むボタンを押す。最大4画面
  for (let n = 0; n < 4; n += 1) {
    await page.waitForTimeout(2500);
    const boxes = page.locator('input[type=checkbox]').filter({ hasNot: page.locator('[disabled]') });
    for (let i = 0; i < await boxes.count(); i += 1) {
      const b = boxes.nth(i);
      const around = await b.evaluate((e) => (e.closest('label, li, div, tr') || e).textContent.slice(0, 200)).catch(() => '');
      if (/同意|確認しました|了承/.test(around) && await b.isVisible() && !(await b.isChecked())) await b.check().catch(() => {});
    }
    const cands = page.locator('button, input[type=button], input[type=submit], a, [role=button], label.c-btn, label[class*=btn]');
    let target = null;
    for (let i = 0; i < Math.min(await cands.count(), 300) && !target; i += 1) {
      const c = cands.nth(i);
      const label = await c.evaluate((e) => `${e.textContent || ''} ${e.value || ''}`.replace(/\s+/g, ' ').trim()).catch(() => '');
      if (PRE.test(label) && !/あとで|後で/.test(label) && await c.isVisible().catch(() => false)) target = c;
    }
    if (!target) return;
    console.log(`進めます：「${((await target.textContent().catch(() => '')) || (await target.getAttribute('value')) || '').trim().slice(0, 30)}」`);
    await target.click().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const textOnly = args.includes('--text');
  const name = args.find((a) => !a.startsWith('--'));
  if (!fs.existsSync(SENDER)) throw new Error(`差出人のファイルがありません：${SENDER}`);
  const sender = JSON.parse(fs.readFileSync(SENDER, 'utf8'));
  const U = loadUnei();
  const round = U.forms.rounds.find((r) => r.status !== 'done');
  if (!round) throw new Error('予定の回がありません');
  const sentTo = new Set(U.sent.filter((s) => s.date >= round.date).map((s) => s.to));
  const targets = U.forms.targets.filter((t) => !t.skip);
  const t = name ? targets.find((x) => x.to === name) : targets.find((x) => !sentTo.has(x.to));
  if (!t) throw new Error(name ? `送り先が見つかりません：${name}` : 'この回の送り先は全部出し終えました');
  const id = t.kind === 'yobo' ? round.yobo : round.chinjo;
  if (!id) throw new Error('この回の項目が決まっていません（site/data/unei.js の forms.rounds）');
  const council = t.kind === 'yobo' ? `${t.to.replace(/長$/, '')}議会` : t.to;
  const doc = petitionText(round.theme, council, id, t.kind === 'yobo' ? 'request' : 'petition', sender);
  console.log(`送り先：${t.to}（${t.kind === 'yobo' ? '要望' : '陳情'}）　項目：${id}\n件名：${doc.subject}\n本文：${doc.body.length}字`);
  if (textOnly) { console.log(`---\n${doc.body}`); return; }

  const url = t.form || ENTRY[t.to] || t.page;
  const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_DIR || 'C:/Users/shin1/.claude/tools/browser'] }));
  // ログインが要るフォーム（LoGoフォーム・Graffer・e-tumo など）のために、ログインを覚えておく専用のブラウザの設定を使う（Git の外）
  const profile = path.join(process.env.LOCALAPPDATA || require('os').tmpdir(), 'chinjo-unei-browser');
  const browser = await chromium.launchPersistentContext(profile, { headless: !!process.env.HEADLESS, locale: 'ja-JP', viewport: null });
  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(url);
  if (!t.form && !ENTRY[t.to]) console.log('フォームの入口がわかっていません。開いた案内ページからフォームまで進んで、Enter を押してください。');
  else await advance(page);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, r));
  for (;;) {
    const done = await fillPage(page, sender, doc);
    console.log(done.length ? `入れました：\n  ${done.join('\n  ')}` : 'この画面には入れる欄が見つかりませんでした。');
    if (process.env.UNEI_SHOT) await page.screenshot({ path: process.env.UNEI_SHOT, fullPage: true });
    if (!done.length) console.log('ログインの画面なら、ブラウザでログインしてから Enter を押してください（ログインは次から覚えています）。');
    console.log('ふりがな・電話・メールなど空いている必須の欄は手で入れてください。送信（確認へ進む・申し込む）は自分で押してください。');
    const a = (await ask('Enter＝この画面にもう一度入れる　URL を貼る＝そのページを開いて入れる（確認のメールのリンクなど）　s＝送信した（記録する）　q＝やめる：')).trim();
    if (/^https?:\/\//.test(a)) { await page.goto(a); await advance(page); continue; }
    if (a === 's') {
      execRecord(t.to, id);
      break;
    }
    if (a === 'q') break;
  }
  rl.close();
  await browser.close();
}

function execRecord(to, id) {
  require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'unei.js'), 'record', to, id], { stdio: 'inherit' });
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { plan, toHalf, toFull, petitionText };
