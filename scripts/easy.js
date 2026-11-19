// 陳情の項目ごとに、中学生にもわかる「この陳情の意義」のページを作る。
// 説明は site/themes/<テーマ>/easy.js（書き方は .claude/skills/easy-explainer/SKILL.md）。
// 事実・数字・資料は asks-*.js の reason・figs・refs をそのまま使い、easy.js には言いかえた説明だけを書く。
//   node scripts/easy.js         … /<テーマ>/easy と /<テーマ>/easy/<項目id> を作り直す
//   node scripts/easy.js --check … 書き出さずに、古いページがあれば知らせる（npm test でも確かめる）
const fs = require('fs');
const path = require('path');
const { withParts } = require('./pages');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const ORIGIN = 'https://chinjo-action.vercel.app';
const THEMES = ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota'];

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function load(theme) {
  const window = {};
  for (const scope of ['national', 'local']) new Function('window', read(path.join(SITE, 'themes', theme, `asks-${scope}.js`)))(window);
  const easyFile = path.join(SITE, 'themes', theme, 'easy.js');
  if (fs.existsSync(easyFile)) new Function('window', read(easyFile))(window);
  return { asks: window.ASKS, easy: window.EASY || {} };
}

// 関連資料のページ（refs.html）の頭とお尻を借りて、題名・説明・URL・本文だけを差し替える
function shell(theme, { title, desc, url, main }) {
  const src = read(path.join(SITE, theme, 'refs.html'));
  const head = src.slice(0, src.indexOf('<main'))
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${ORIGIN}${url}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title.split('｜')[0])}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${ORIGIN}${url}`);
  const tail = src.slice(src.indexOf('</main>'));
  return `${head}<main id="main" class="wrap guide easy">\n${main}\n${tail}`;
}

const siteName = (theme) => (read(path.join(SITE, theme, 'refs.html')).match(/<title>[^｜]*｜([^<]*)<\/title>/) || [])[1] || '陳情アクション';
const scopeText = (a) => (a.scope === 'national' ? '議会から国に意見書を出してもらう陳情' : '市区町村・都道府県に取り組んでもらう陳情');

function itemPage(theme, a, e) {
  const url = `/${theme}/easy/${a.id}`;
  const L = [`  <p class="hint-sm"><a href="/${theme}/easy">← 中学生にもわかる説明の一覧</a></p>`, `  <h1>${esc(a.label)}</h1>`, `  <p class="hint-sm">${scopeText(a)}</p>`];
  if (e) {
    L.push('  <h2>この陳情でお願いすること</h2>', `  <p>${esc(e.what)}</p>`,
      '  <h2>いまは、どうなっている？</h2>', `  <p>${esc(e.now)}</p>`,
      '  <h2>どうして大事なの？</h2>', `  <p>${esc(e.why)}</p>`,
      '  <h2>変わると、どうなる？</h2>', `  <p>${esc(e.after)}</p>`);
  } else {
    L.push('  <p class="wz-notfound">中学生向けの説明は準備中です。下の「陳情の理由（原文）」をご覧ください。</p>');
  }
  if (a.figs && a.figs.length) {
    L.push('  <h2>数字で見ると</h2>');
    for (const f of a.figs) {
      L.push(`  <table><caption>${esc(f.t)}${f.unit ? `（単位：${esc(f.unit)}）` : ''}</caption><tbody>`,
        ...f.rows.map((r) => `    <tr><th scope="row">${esc(r[0])}</th><td>${esc(Number(r[1]).toLocaleString('ja-JP'))}</td></tr>`),
        `  </tbody></table>`, `  <p class="hint-sm">出典：${esc(f.src)}${f.note ? `。${esc(f.note)}` : ''}</p>`);
    }
  }
  L.push('  <details>', '    <summary>陳情の理由（陳情書に書く原文）</summary>', `    <p>${esc(String(a.reason || '').replace(/\{宛先\}/g, '（提出先の自治体）'))}</p>`, '  </details>');
  if (a.refs && a.refs.length) {
    L.push('  <h2>もっと調べる（資料）</h2>', '  <ul>',
      ...a.refs.map((r) => `    <li>${r.secondary ? '<span class="hint-sm">［解説・研究］</span>' : ''}${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.t)}</a>` : esc(r.t)}${r.note ? `（${esc(r.note)}）` : ''}</li>`),
      '  </ul>');
  }
  L.push(`  <p><a class="btn" href="/${theme}/make">この陳情書をつくる</a></p>`);
  const desc = e ? e.what : `${a.label}を求める陳情の説明`;
  return { file: path.join(SITE, theme, 'easy', `${a.id}.html`), html: withParts(shell(theme, { title: `${a.label}（中学生にもわかる説明）｜${siteName(theme)}`, desc, url, main: L.join('\n') }), theme, 'easy') };
}

function indexPage(theme, asks, easy) {
  const groups = [['national', '国への意見書を求める陳情'], ['local', '自治体の施策を求める陳情']];
  const L = ['  <h1>中学生にもわかる、陳情の説明</h1>',
    '  <p>このテーマで出せる陳情の一つひとつについて、「何をお願いしているのか」「いまはどうなっているのか」「どうして大事なのか」を、やさしい言葉で説明します。数字や資料は、陳情書と同じ公的な資料からとっています。</p>'];
  for (const [scope, label] of groups) {
    const list = asks.filter((a) => a.scope === scope);
    if (!list.length) continue;
    L.push(`  <h2>${label}</h2>`, '  <ul>', ...list.map((a) => `    <li><a href="/${theme}/easy/${a.id}">${esc(a.label)}</a>${easy[a.id] ? '' : '<span class="hint-sm">（説明は準備中）</span>'}</li>`), '  </ul>');
  }
  return { file: path.join(SITE, theme, 'easy.html'), html: withParts(shell(theme, { title: `中学生にもわかる、陳情の説明｜${siteName(theme)}`, desc: 'このテーマの陳情の一つひとつを、中学生にもわかる言葉で説明します。', url: `/${theme}/easy`, main: L.join('\n') }), theme, 'easy') };
}

function all() {
  return THEMES.flatMap((theme) => {
    const { asks, easy } = load(theme);
    for (const id of Object.keys(easy)) if (!asks.some((a) => a.id === id)) throw new Error(`${theme}/easy.js の ${id} は asks にありません`);
    return [indexPage(theme, asks, easy), ...asks.map((a) => itemPage(theme, a, easy[a.id]))];
  });
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const out = all();
  const stale = out.filter(({ file, html }) => !fs.existsSync(file) || read(file) !== html);
  if (check) {
    stale.forEach(({ file }) => console.error(`古いページ：${path.relative(ROOT, file)}（node scripts/easy.js）`));
    process.exitCode = stale.length ? 1 : 0;
  } else {
    for (const { file, html } of stale) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, html); }
    console.log(`${stale.length}ページを書き出しました（全${out.length}ページ）`);
  }
}

module.exports = { all };
