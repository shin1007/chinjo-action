// 1. templates/ のページから、テーマごとのページ（kodomo/labels.html など）を作る。
//    テーマの間で名前と URL しか違わないページだけをここで作る。index.html・guide.html・refs.html は中身がテーマごとに違うので、直接直す。
// 2. 全ページに共通の部品（ヘッダーのテーマ切り替えメニュー、フッターの GitHub への案内）を、ここに書いた1つの形にそろえる。
//    部品を直すときは、このファイルの themeNav・GITHUB を直して実行する（HTML を1ページずつ直さない）。
//   node scripts/pages.js         … 作り直して書き出す
//   node scripts/pages.js --check … 書き出さずに、templates/ と食い違うページがあれば知らせる（npm test でも確かめる）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const THEMES = [
  // ogAlt：リンクカードの画像（themes/<id>/og-image.png、scripts/og-images.py で作る）の大見出し
  // letter：かんたん作成のできあがりの画面に出す、議員への手紙（トップページにある）への案内
  { id: 'kodomo', label: '子どもの権利', site: '子どもの権利を守る陳情アクション', ogAlt: '子どもが両方の親と関わり続けられる制度を、地方議会に。', letter: true },
  { id: 'dansei', label: '男女平等', site: '男女平等を求める陳情アクション', ogAlt: '性別にかかわらず相談先と避難先がある制度を、地方議会に。' },
  { id: 'nihonjin', label: '日本人の権利', ogAlt: '税と社会保障のルールの見直しを、地方議会に。' },
  { id: 'shiho', label: '司法への参加', site: '司法に国民の声を届ける陳情アクション', ogAlt: '司法に国民の声が届く仕組みを、地方議会から国に。' },
  { id: 'kenko', label: '国民の健康', ogAlt: '病気を防ぎ、早く見つける施策を、地方議会に。' },
  { id: 'sonota', label: 'その他の陳情', site: '税の公平と教育を守る陳情アクション', ogAlt: '税の公平と、公立の学校を守る施策を、地方議会に。' },
];
const PAGES = ['labels', 'make'];

// ヘッダーの左上に出す、テーマを切り替えるドロップダウン
// テーマのページの中では、そのテーマに印を付ける。テーマの外のページ（/about など）では「テーマを選ぶ」と出す
const themeNav = (current) => [
  '    <details class="theme-menu">',
  `      <summary>${(THEMES.find((t) => t.id === current) || { label: 'テーマを選ぶ' }).label}</summary>`,
  '      <nav class="theme-nav" aria-label="陳情のテーマ">',
  ...THEMES.map((t) => `        <a href="/${t.id}"${t.id === current ? ' aria-current="true"' : ''}>${t.label}</a>`),
  '      </nav>',
  '    </details>',
].join('\n');

// Windows で取り出すと改行が CRLF になるので、LF にそろえてから比べる
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function render(page, theme) {
  const src = read(path.join(ROOT, 'templates', `${page}.html`));
  return src.replace('{{themeNav}}', themeNav(theme.id))
    .replaceAll('{{id}}', theme.id)
    .replaceAll('{{site}}', theme.site ?? `${theme.label}を守る陳情アクション`)
    .replaceAll('{{label}}', theme.label)
    .replaceAll('{{ogAlt}}', theme.ogAlt)
    .replace('{{letterLink}}', theme.letter ? `          <li><b>議員に手紙を出す：</b>陳情書に書けない事情は、公開されない手紙で伝えます。紹介議員のお願いにもなります。<a href="/${theme.id}#letter">議員への手紙をつくる</a></li>
` : '');
}

// フッターの、ソースコードへの案内
const GITHUB = '  <div class="wrap"><p class="small"><a href="https://github.com/shin1007/chinjo-action" target="_blank" rel="noopener">ソースコード（GitHub）</a>　このサイトの改善の提案（Issue・プルリクエスト）を歓迎します</p></div>';

// テーマのページのヘッダーの右側（つくる・出し方）。いま開いているページに印を付ける
const primaryNav = (themeId, page) => [
  '    <nav class="primary-nav" aria-label="主要メニュー">',
  `      <a href="/${themeId}/make"${page === 'make' ? ' aria-current="page"' : ''}>つくる</a>`,
  `      <a href="/${themeId}/guide"${page === 'guide' ? ' aria-current="page"' : ''}>出し方</a>`,
  '    </nav>',
].join('\n');

// 共通の部品を、決まった形に置き換える（部品がないページはそのまま）
function withParts(html, themeId, page) {
  const navRe = new RegExp(` {4}<nav(?: class="primary-nav" aria-label="主要メニュー")?>\\s*<a href="/${themeId}/make"[\\s\\S]*?</nav>`);
  return html
    .replace(/ {4}<details class="theme-menu">[\s\S]*?<\/details>/, () => themeNav(themeId))
    .replace(navRe, () => primaryNav(themeId, page))
    .replace(/^ *<div class="wrap"><p class="small"><a href="https:\/\/github\.com\/shin1007\/chinjo-action"[^\n]*<\/div>$/m, () => GITHUB)
    // 本文へ移動（キーボード・読み上げで使う人が、毎回ヘッダーを通らずに済むように。Tab を押したときだけ見える）
    .replace(/(<body[^>]*>)\n(?:<a class="skip-link"[^\n]*\n)?/, (_, body) => `${body}\n${SKIP}\n`)
    .replace(/<main(?! id="main")([^>]*)>/, '<main id="main"$1>')
    // スマホのブラウザの上の帯の色を、ヘッダーと同じ色にする（明るい表示・暗い表示）
    .replace(/(<meta name="viewport"[^>]*>)\n(?:<meta name="theme-color"[^\n]*\n)*/, (_, vp) => `${vp}\n${THEME_COLOR}\n`);
}
const SKIP = '<a class="skip-link" href="#main">本文へ移動</a>';
const THEME_COLOR = [
  '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">',
  '<meta name="theme-color" content="#252b2f" media="(prefers-color-scheme: dark)">',
].join('\n');

const htmlFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const f = path.join(dir, e.name);
  if (e.isDirectory()) return ['data', 'vendor', 'fonts'].includes(e.name) ? [] : htmlFiles(f);
  return e.name.endsWith('.html') ? [f] : [];
});

function pages() {
  const made = THEMES.flatMap((t) => PAGES.map((p) => ({ file: path.join(SITE, t.id, `${p}.html`), html: withParts(render(p, t), t.id, p) })));
  const done = new Set(made.map((m) => m.file));
  const rest = htmlFiles(SITE).filter((f) => !done.has(f)).map((file) => {
    const [theme, name] = path.relative(SITE, file).split(path.sep);
    return { file, html: withParts(read(file), theme, (name || '').replace(/\.html$/, '')) };
  });
  return [...made, ...rest];
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = pages().filter(({ file, html }) => !fs.existsSync(file) || read(file) !== html);
  if (check) {
    stale.forEach(({ file }) => console.error(`templates/ か共通の部品（ヘッダーのテーマ切り替え・フッターの GitHub）と違います：${path.relative(ROOT, file)}`));
    process.exitCode = stale.length ? 1 : 0;
  } else {
    stale.forEach(({ file, html }) => fs.writeFileSync(file, html));
    console.log(`${stale.length}ページを書き出しました`);
  }
}

module.exports = { pages, withParts };
