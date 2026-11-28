// 報道機関・個人のサイトなど、消えるおそれのあるページを証拠として保存する。
//   node scripts/archive.js <URL> "<題名（発行元・日付）>" ["<メモ>"]
//   node scripts/archive.js --list
// 本文は sources/archive/ に保存する（著作物の全文なので Git には入れない。.gitignore 済み）。
// URL・取得日時・SHA-256 は data/archive-index.json に記録し、こちらは Git に入れる。
// ボット拒否で取れないページは、Chrome で開いて「名前を付けて保存」し、--file で登録する：
//   node scripts/archive.js <URL> "<題名>" "<メモ>" --file <保存したファイル>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const INDEX_FILE = path.join(SITE, 'data', 'archive-index.json');
const DIR = path.join(ROOT, 'sources', 'archive');
const index = fs.existsSync(INDEX_FILE)
  ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
  : { schemaVersion: 1, description: '証拠として保存したページの一覧。本文は sources/archive/ にあり Git には入れていない。', pages: [] };

const args = process.argv.slice(2);
if (args[0] === '--list') {
  index.pages.forEach((p) => console.log(`${p.fetchedAt}\t${p.title}\t${p.url}\t${p.localPath}`));
  process.exit(0);
}
const fileAt = args.indexOf('--file');
const file = fileAt >= 0 ? args.splice(fileAt, 2)[1] : null;
const [url, title, note] = args;
if (!url || !title) {
  console.error('使い方：node scripts/archive.js <URL> "<題名>" ["<メモ>"] [--file <保存したファイル>]');
  process.exit(1);
}

(async () => {
  let body;
  let extension;
  if (file) {
    body = fs.readFileSync(file);
    extension = path.extname(file).slice(1) || 'bin';
  } else {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'user-agent': 'Mozilla/5.0 (chinjo evidence archive)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const type = response.headers.get('content-type') || '';
    extension = /pdf/i.test(type) ? 'pdf' : /html/i.test(type) ? 'html' : 'bin';
    body = Buffer.from(await response.arrayBuffer());
  }
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');
  const fetchedAt = new Date().toISOString();
  const fileName = `${fetchedAt.slice(0, 10)}-${sha256.slice(0, 12)}.${extension}`;
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, fileName), body);
  const localPath = `sources/archive/${fileName}`;
  index.pages.push({ url, title, ...(note ? { note } : {}), fetchedAt, sha256, localPath });
  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`${title} を ${localPath} に保存しました（SHA-256 ${sha256}）`);
  showOpenLines(url, title);
})().catch((error) => {
  console.error(`保存できませんでした：${error.message}`);
  process.exitCode = 1;
});

// 保存した資料の URL か題名の言葉が出てくる「未確認」の行を docs/ から探して見せる（直し漏れを防ぐ）。
function showOpenLines(url, title) {
  const docs = path.join(__dirname, '..', 'docs');
  const words = [url.replace(/^https?:\/\//, '').replace(/\/$/, ''), ...(title.match(/[^\s「」『』（）()・、。]{4,}/g) || [])];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '非公開' ? []
    : e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.md') ? [path.join(d, e.name)] : []));
  const hits = [];
  for (const f of walk(docs)) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
      if ((l.includes('未確認') || /\[U-\d{3}\]/.test(l)) && words.some((w) => l.includes(w))) {
        hits.push(`  ${path.relative(docs, f)}:${i + 1}  ${l.slice(0, 80)}`);
      }
    });
  }
  if (hits.length) console.log(`確かめたら直す行（docs/ の未確認）：\n${hits.slice(0, 20).join('\n')}`);
}
