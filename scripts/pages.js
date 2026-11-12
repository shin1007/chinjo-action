// templates/ のページから、テーマごとのページ（kodomo/labels.html など）を作る。
// テーマの間で名前と URL しか違わないページだけをここで作る。index.html・guide.html・refs.html は中身がテーマごとに違うので、直接直す。
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
    .replaceAll('{{site}}', theme.site ?? `${theme.label}を守る陳情アクション`)
    .replaceAll('{{label}}', theme.label)
    .replaceAll('{{ogAlt}}', theme.ogAlt)
    .replace('{{letterLink}}', theme.letter ? `          <li><b>議員に手紙を出す：</b>陳情書に書けない事情は、公開されない手紙で伝えます。紹介議員のお願いにもなります。<a href="/${theme.id}#letter">議員への手紙をつくる</a></li>
` : '');
}

function pages() {
  return THEMES.flatMap((t) => PAGES.map((p) => ({ file: path.join(SITE, t.id, `${p}.html`), html: render(p, t) })));
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
