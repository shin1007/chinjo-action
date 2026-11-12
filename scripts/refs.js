// themes/<テーマ>/asks-*.js の各項目の refs（参考資料）から、関連資料のページ（<テーマ>/refs.html）の「求める事項ごとの資料」の節を作る。
// 節は refs.html の <!-- asks-refs:start --> と <!-- asks-refs:end --> のあいだに書き出す。そのほかの部分は直接直す。
//   node scripts/refs.js         … 作り直して書き出す
//   node scripts/refs.js --check … 書き出さずに、食い違うページがあれば知らせる（npm test でも確かめる）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const THEMES = ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota'];
const START = '<!-- asks-refs:start -->';
const END = '<!-- asks-refs:end -->';

const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function asks(theme) {
  const window = {};
  for (const scope of ['national', 'local']) {
    const src = read(path.join(SITE, 'themes', theme, `asks-${scope}.js`));
    new Function('window', src)(window);
  }
  return window.ASKS;
}

// 1件の資料：{ t: 題名（発行元・日付）, url?, note?: どこを読むか, secondary?: true（信頼のおける二次資料） }
const item = (r) => {
  const title = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.t)}</a>` : esc(r.t);
  return `      <li>${r.secondary ? '<span class="hint-sm">［解説・研究］</span>' : ''}${title}${r.note ? `（${esc(r.note)}）` : ''}</li>`;
};

function block(theme) {
  const groups = [['national', '国への意見書を求める陳情'], ['local', '自治体の施策を求める陳情']];
  const L = [START, '  <h2 id="asks">求める事項ごとの資料</h2>',
    '  <p>陳情書で選べる項目ごとに、問題をつかむための一次資料（法令・国や自治体の公式資料・国会の会議録・論文）と、それを補う信頼のおける二次資料（［解説・研究］の印。国会の調査室や公的機関の委託調査の解説、系統的レビュー、国際機関・専門機関の報告など）をまとめました。陳情書の【参考資料】の欄にも、選んだ項目の資料が入ります。</p>',
    '  <p class="hint-sm">参考資料を添付できるかは議会によって違います。柏崎市議会や日野町議会は他の自治体の事例などの添付を認めていますが、立川市議会は資料の添付を受け付けていません。習志野市議会では、参考資料は議員に配られますが、ホームページには本文だけが載ります。出す前に議会事務局に確かめてください。</p>'];
  for (const [scope, label] of groups) {
    const list = asks(theme).filter((a) => a.scope === scope && a.refs && a.refs.length);
    if (!list.length) continue;
    L.push(`  <h3>${label}</h3>`);
    for (const a of list) {
      L.push(`  <details class="ask-refs" id="${a.id}">`, `    <summary>${esc(a.label)}</summary>`, '    <ul>');
      a.refs.forEach((r) => L.push(item(r)));
      L.push('    </ul>', '  </details>');
    }
  }
  L.push(`  ${END}`);
  return L.join('\n');
}

function pages() {
  return THEMES.map((theme) => {
    const file = path.join(SITE, theme, 'refs.html');
    const src = read(file);
    const from = src.indexOf(START);
    const to = src.indexOf(END);
    if (from < 0 || to < 0) throw new Error(`${theme}/refs.html に ${START} と ${END} がありません`);
    return { file, html: src.slice(0, from) + block(theme) + src.slice(to + END.length) };
  });
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = pages().filter(({ file, html }) => read(file) !== html);
  if (check) {
    stale.forEach(({ file }) => console.error(`asks-*.js の refs と違います：${path.relative(ROOT, file)}`));
    process.exitCode = stale.length ? 1 : 0;
  } else {
    stale.forEach(({ file, html }) => fs.writeFileSync(file, html));
    console.log(`${stale.length}ページを書き出しました`);
  }
}

module.exports = { pages };
