// docs/ の書き漏れを見張るテスト。実行：npm test
// 1. 「未確認」は正本（一次資料に当たれていない資料.md）にだけ書き、ほかは番号（U-001 など）で指す。
// 2. 正本で解決済みにした番号・URL が、ほかのファイルで「未確認」のまま残っていない。
// 3. docs/README.md のファイルの一覧が新しい（node scripts/docs-index.js で作り直す）。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { render, README } = require('../scripts/docs-index.js');

const DOCS = path.join(__dirname, '..', 'docs');
const CANON = path.join(DOCS, '調査', '一次資料に当たれていない資料.md');
const NUMBERS = path.join(DOCS, '調査', '項目の数字の確かめ直し.md');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name === '非公開' || e.name.startsWith('.')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
  });
}

function canon() {
  const open = new Set(), done = new Set(), doneUrls = new Set(), all = [];
  let resolved = false;
  for (const l of fs.readFileSync(CANON, 'utf8').split(/\r?\n/)) {
    if (l.startsWith('## ')) resolved = l.startsWith('## 解決済み');
    const m = l.match(/^(?:\| |- )\[(U-\d{3})\]/); // 行の頭の番号だけを数える（説明の文の例は数えない）
    if (m) { all.push(m[1]); (resolved ? done : open).add(m[1]); }
    if (resolved) for (const u of l.match(/https?:\/\/[^\s)）|]+/g) || []) doneUrls.add(u.replace(/[。、]+$/, ''));
  }
  return { open, done, doneUrls, all };
}

const rel = p => path.relative(DOCS, p).split(path.sep).join('/');

test('正本の番号（U-001 など）は重ならない', () => {
  const { all } = canon();
  const dup = all.filter((id, i) => all.indexOf(id) !== i);
  assert.deepStrictEqual(dup, [], `番号が重なっている：${dup.join(', ')}。新しい行には今ある最大の番号＋1を付ける`);
});

test('項目の数字の確かめ直しの「未確認」の行は、正本の番号を指している', () => {
  const { open, done } = canon();
  const bad = [];
  fs.readFileSync(NUMBERS, 'utf8').split(/\r?\n/).forEach((l, i) => {
    if (!l.startsWith('|') || !l.includes('未確認')) return;
    const ids = [...l.matchAll(/U-\d{3}/g)].map(m => m[0]);
    if (!ids.length) bad.push(`${i + 1}行目：番号がない（正本に行を足して番号で指す）`);
    for (const id of ids) if (!open.has(id) && !done.has(id)) bad.push(`${i + 1}行目：${id} が正本にない`);
  });
  assert.deepStrictEqual(bad, []);
});

test('正本で解決済みにした番号・URL が、ほかのファイルで「未確認」のまま残っていない', () => {
  const { open, done, doneUrls } = canon();
  const bad = [];
  for (const p of walk(DOCS)) {
    if (p === CANON) continue;
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((l, i) => {
      const where = `${rel(p)}:${i + 1}`;
      for (const m of l.matchAll(/U-\d{3}/g)) {
        if (!open.has(m[0]) && !done.has(m[0])) bad.push(`${where}：${m[0]} が正本にない`);
        else if (done.has(m[0]) && l.includes('未確認')) bad.push(`${where}：${m[0]} は解決済み。この行を「確かめた」に直す`);
      }
      if (!l.includes('未確認')) return;
      for (const u of doneUrls) if (l.includes(u)) bad.push(`${where}：${u} は正本で解決済み。この行を直す`);
    });
  }
  assert.deepStrictEqual(bad, []);
});

test('docs/README.md のファイルの一覧が新しい', () => {
  const src = fs.readFileSync(README, 'utf8');
  assert.ok(render(src) === src, 'docs/ の .md を足した・消した・見出しを変えた。node scripts/docs-index.js で一覧を作り直す');
});
