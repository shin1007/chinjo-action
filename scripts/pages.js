// templates/ のページから、テーマごとのページ（kodomo/builder.html など）を作る。
// テーマの間で名前と URL しか違わないページだけをここで作る。index.html・guide.html・refs.html は中身がテーマごとに違うので、直接直す。
//   node scripts/pages.js         … 作り直して書き出す
//   node scripts/pages.js --check … 書き出さずに、templates/ と食い違うページがあれば知らせる（npm test でも確かめる）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const THEMES = [
  { id: 'kodomo', label: '子どもの権利' },
  { id: 'dansei', label: '男性の権利' },
  { id: 'nihonjin', label: '日本人の権利' },
  { id: 'shiho', label: '司法への参加' },
  { id: 'sonota', label: 'その他の陳情' },
];
const PAGES = ['builder', 'labels'];

// ヘッダーの左上に出す、テーマを切り替えるドロップダウン
const themeNav = (current) => [
  '    <details class="theme-menu">',
  `      <summary>${THEMES.find((t) => t.id === current).label}</summary>`,
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
    .replaceAll('{{label}}', theme.label);
}

function pages() {
  return THEMES.flatMap((t) => PAGES.map((p) => ({ file: path.join(ROOT, t.id, `${p}.html`), html: render(p, t) })));
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = pages().filter(({ file, html }) => !fs.existsSync(file) || read(file) !== html);
  if (check) {
    stale.forEach(({ file }) => console.error(`templates/ と違います：${path.relative(ROOT, file)}`));
    process.exitCode = stale.length ? 1 : 0;
  } else {
    stale.forEach(({ file, html }) => fs.writeFileSync(file, html));
    console.log(`${stale.length}ページを書き出しました`);
  }
}

module.exports = { pages };
