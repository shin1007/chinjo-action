// 一次資料を必要なときだけURLから保存する。
//   node scripts/source.js --list
//   node scripts/source.js src-xxxxxxxxxx
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'data', 'source-index.json');
const CACHE = path.join(ROOT, 'sources', 'cache');
const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));

if (process.argv.includes('--list')) {
  index.sources.forEach((s) => console.log(`${s.id}\t${s.title}\t${s.localPath || '未保存'}`));
  process.exit(0);
}

const id = process.argv[2];
const source = index.sources.find((s) => s.id === id);
if (!source) {
  console.error('資料IDが見つかりません。node scripts/source.js --list で確認してください。');
  process.exitCode = 1;
} else {
  (async () => {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'user-agent': 'chinjo primary-source archive' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${source.url}`);
    const type = response.headers.get('content-type') || '';
    const extension = /pdf/i.test(type) ? 'pdf' : /html/i.test(type) ? 'html' : 'bin';
    const fileName = `${source.id}.${extension}`;
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(path.join(CACHE, fileName), Buffer.from(await response.arrayBuffer()));
    source.fetchedAt = new Date().toISOString();
    source.localPath = path.relative(ROOT, path.join(CACHE, fileName)).replaceAll('\\', '/');
    fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`);
    console.log(`${source.title} を ${source.localPath} に保存しました`);
  })().catch((error) => {
    console.error(`資料を保存できませんでした：${error.message}`);
    process.exitCode = 1;
  });
}
