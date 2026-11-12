// 作成画面で作られる文書の見本を、docs/確認用/見本/ に Markdown で書き出す（サイトを開かなくても読み返せるように）
//   - 出し方メモ.md：印刷用のPDFの最後につく「出し方メモ」（陳情書・要望書）
//   - <テーマ名>.md：テーマごとに、内容1つずつの陳情書の文面（参考資料まで）
//   node scripts/samples.js         … 書き出す
//   node scripts/samples.js --check … 書き出さずに、docs/確認用/見本/ と食い違いがあれば知らせる（npm test でも確かめる）
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'docs', '確認用', '見本');
const THEMES = [['kodomo', '子どもの権利'], ['dansei', '男女平等'], ['nihonjin', '日本人の権利'], ['shiho', '司法への参加'], ['kenko', '国民の健康'], ['sonota', 'その他の陳情']];
const COMMON = ['data/prefs.js', 'data/municipalities.js', 'data/offices.js', 'data/sites.js', 'data/councils.js', 'data/kana.js'];
// 日付は書き出すたびに変わらないよう、見本では固定する
const DAY = '令和〇年〇月〇日';

function load(theme) {
  const ctx = { FormData };
  ctx.window = ctx;
  vm.createContext(ctx);
  const files = [`themes/${theme}/theme.js`, 'data/prefs.js', `themes/${theme}/asks-national.js`, `themes/${theme}/asks-local.js`, `themes/${theme}/template.js`,
    ...COMMON.slice(1), `themes/${theme}/reasons.js`, 'js/common.js', 'js/places.js', 'js/petition.js'];
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

function form(items) {
  const fd = new FormData();
  items.forEach((k) => fd.append('items', k));
  fd.append('kind', 'petition');
  for (const k of ['story', 'address', 'name', 'tel']) fd.append(k, '');
  return fd;
}

const fence = (t) => `\`\`\`text\n${t}\n\`\`\``;

function themeFile([theme, title]) {
  const w = load(theme);
  const L = [`# ${title}：陳情書の文面の見本`, '',
    '`node scripts/samples.js` で書き出したもの。作成画面で「〇〇市議会」あてに、内容を1つだけ選んだときの文面（参考資料まで）。日付・住所・氏名は空けてある。', ''];
  w.Petition.ordered().forEach((a, i) => {
    const text = w.Petition.build(form([a.id]), '〇〇市議会', [a.id]).replace(/^(\s*)令和.{1,3}年\d{1,2}月\d{1,2}日/, `$1${DAY}`);
    L.push(`## ${i + 1}. ${a.label}`, '', `- 種類：${w.Petition.isNational(a) ? '国へ意見書を求める' : '自治体の取り組みを求める'}${a.category ? `／見出し：${a.category}` : ''}`, '', fence(text), '');
  });
  return [`${title}.md`, L.join('\n')];
}

function memoFile() {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(SITE, 'js/send-memo.js'), 'utf8'), ctx, { filename: 'js/send-memo.js' });
  const council = {
    name: '〇〇市議会事務局',
    page: 'https://www.city.example.lg.jp/gikai/chinjo.html',
    mail: '郵送でも審査される（議会の公式案内で確認）',
    denshi: false,
    tel: '000-000-0000（議会事務局）',
    address: '〒000-0000　〇〇県〇〇市〇〇1-1（役所の本庁舎。議会事務局が別の建物のこともある）',
    access: '〇〇駅（〇〇線）から徒歩約8分',
    deadline: '',
    stamp: '10枚・約76g → 180円',
  };
  const base = { count: 3, titles: ['（1つ目の内容の件名）', '（2つ目の内容の件名）', '（3つ目の内容の件名）'], councils: [council], figs: true };
  const L = ['# 出し方メモの見本', '',
    '`node scripts/samples.js` で書き出したもの。作成画面の「印刷用のPDFを開く」で、PDFの最後につく1枚（議会・内容は架空の例）。',
    '「[[図:send]]」の行には、PDFでは送り方の図（中身・封筒の表・封筒の裏）が入る。', '',
    '## 陳情書（議会に出す）', '', fence(ctx.SendMemo.build({ ...base, kind: 'petition' })), '',
    '## 要望書（市区町村長・知事に出す）', '', fence(ctx.SendMemo.build({ ...base, kind: 'request', councils: [{ ...council, name: '〇〇市' }] })), ''];
  return ['出し方メモ.md', L.join('\n')];
}

const files = [memoFile(), ...THEMES.map(themeFile)];
if (process.argv.includes('--check')) {
  const stale = files.filter(([name, text]) => {
    const p = path.join(OUT, name);
    return !fs.existsSync(p) || fs.readFileSync(p, 'utf8').split('\r\n').join('\n') !== text;
  }).map(([name]) => name);
  if (stale.length) {
    console.error(`docs/確認用/見本/ が古くなっています（${stale.join('、')}）。node scripts/samples.js で書き出し直してください。`);
    process.exit(1);
  }
} else {
  fs.mkdirSync(OUT, { recursive: true });
  files.forEach(([name, text]) => fs.writeFileSync(path.join(OUT, name), text));
  console.log(`${files.length}ファイルを docs/確認用/見本/ に書き出しました`);
}
