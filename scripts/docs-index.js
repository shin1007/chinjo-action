// docs/README.md の「ファイルの一覧」を、docs/ の .md の見出し（# の行）から作り直す。
// 実行：node scripts/docs-index.js（--check なら書き換えずに、古ければ終了コード1）
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', 'docs');
const README = path.join(DOCS, 'README.md');
const START = '<!-- docs-index:start（node scripts/docs-index.js が書く。手で直さない） -->';
const END = '<!-- docs-index:end -->';

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '非公開' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.md') && p !== README) out.push(p);
  }
  return out;
}

function build() {
  const groups = {};
  for (const p of walk(DOCS)) {
    const rel = path.relative(DOCS, p).split(path.sep).join('/');
    const folder = rel.includes('/') ? rel.split('/')[0] : '.';
    const h = (fs.readFileSync(p, 'utf8').match(/^# (.+)$/m) || [])[1] || '';
    (groups[folder] = groups[folder] || []).push(`- [${rel}](${encodeURI(rel)})${h ? '：' + h.trim() : ''}`);
  }
  const body = Object.keys(groups).sort().map(f => `### ${f === '.' ? 'docs/' : f + '/'}\n\n${groups[f].sort().join('\n')}`).join('\n\n');
  return `${START}\n\n${body}\n\n${END}`;
}

function render(src) {
  const block = build();
  const i = src.indexOf(START), j = src.indexOf(END);
  if (i < 0 || j < 0) return src.replace(/\s*$/, '') + '\n\n## ファイルの一覧\n\n' + block + '\n';
  return src.slice(0, i) + block + src.slice(j + END.length);
}

if (require.main === module) {
  const src = fs.readFileSync(README, 'utf8');
  const next = render(src);
  if (process.argv.includes('--check')) process.exit(next === src ? 0 : 1);
  if (next !== src) fs.writeFileSync(README, next);
}
module.exports = { render, README };
