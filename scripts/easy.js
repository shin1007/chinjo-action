// テーマごとの「陳情の内容のあらまし」（議員・職員・住民が短時間で全体を見られる一覧）と、項目ごとのわかりやすい説明のページを作る。
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
const LABEL = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への国民の声', kenko: '国民の健康', sonota: '税の公平と教育など' };
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
  const L = [`  <p class="hint-sm"><a href="/${theme}/easy">← 陳情の内容のあらまし（一覧）</a></p>`, `  <h1>${esc(a.label)}</h1>`, `  <p class="hint-sm">${scopeText(a)}</p>`];
  if (e) {
    L.push('  <h2>この陳情でお願いすること</h2>', `  <p>${esc(e.what)}</p>`,
      '  <h2>いまは、どうなっている？</h2>', `  <p>${esc(e.now)}</p>`,
      '  <h2>どうして大事なの？</h2>', `  <p>${esc(e.why)}</p>`,
      '  <h2>変わると、どうなる？</h2>', `  <p>${esc(e.after)}</p>`);
  } else {
    L.push('  <p class="wz-notfound">説明は準備中です。下の「陳情の理由（原文）」をご覧ください。</p>');
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
  return { file: path.join(SITE, theme, 'easy', `${a.id}.html`), html: withParts(shell(theme, { title: `${a.label}（陳情の説明）｜${siteName(theme)}`, desc, url, main: L.join('\n') }), theme, 'easy') };
}

// 内容の札（site/js/common.js の tagsOf と同じ決め方）
const tagsOf = (a) => [
  (a.refs || []).some((r) => r.secondary) && ['research', '研究の裏づけあり'],
  a.precedent && ['precedent', `他自治体で実例あり（${a.precedent}）`],
  a.lowcost && ['lowcost', '低予算で実現可能'],
].filter(Boolean);

function indexPage(theme, asks, easy) {
  const name = siteName(theme);
  const nat = asks.filter((a) => a.scope === 'national').length;
  const L = [`  <h1>陳情の内容のあらまし</h1>`,
    `  <p>「${esc(LABEL[theme])}」について出せる陳情の内容を、1ページにまとめました。全${asks.length}件（国への意見書を求めるもの${nat}件、自治体の取り組みを求めるもの${asks.length - nat}件）で、1件が1通の陳情書になります。議員・自治体の職員の方が全体を短い時間で見られるよう、それぞれ「何をお願いしているか」を一文で書き、詳しい説明・数字・資料へのリンクを付けています。</p>`,
    '  <p class="hint-sm">札の意味：<span class="ask-tag ask-tag-research">研究の裏づけあり</span>論文や公的機関の報告がある　<span class="ask-tag ask-tag-precedent">他自治体で実例あり</span>ほかの自治体ですでに行っている　<span class="ask-tag ask-tag-lowcost">低予算で実現可能</span>予算がほとんど要らない。印刷するときは、ブラウザの印刷を使ってください。</p>'];
  const cats = [...new Set(asks.map((a) => a.category || 'そのほか'))];
  for (const c of cats) {
    L.push(`  <h2>${esc(c)}</h2>`);
    for (const a of asks.filter((x) => (x.category || 'そのほか') === c)) {
      const tags = tagsOf(a).map(([k, t]) => `<small class="ask-tag ask-tag-${k}">${esc(t)}</small>`).join('');
      const what = easy[a.id] ? easy[a.id].what : a.text.replace(/{宛先}/g, '提出先の自治体');
      L.push('  <section class="sum-item">',
        `    <h3><a href="/${theme}/easy/${a.id}">${esc(a.label)}</a> <small class="ask-scope">${a.scope === 'national' ? '国へ意見書' : '自治体の取り組み'}</small></h3>`,
        `    <p>${esc(what)}</p>`, tags ? `    <p class="ask-tags">${tags}</p>` : '', '  </section>');
    }
  }
  L.push(`  <p><a class="btn" href="/${theme}/make">陳情書をつくる</a>　<a href="/${theme}/refs">関連資料の一覧</a></p>`);
  return { file: path.join(SITE, theme, 'easy.html'), html: withParts(shell(theme, { title: `陳情の内容のあらまし｜${name}`, desc: 'このテーマで出せる陳情の内容を1ページにまとめ、何をお願いしているかを一文で説明します。', url: `/${theme}/easy`, main: L.filter(Boolean).join('\n') }), theme, 'easy') };
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
