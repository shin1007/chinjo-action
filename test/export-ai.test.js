const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { collect } = require('../scripts/export-ai');

const ROOT = path.join(__dirname, '..');

test('AI連携用データが全テーマと全資料を含む', () => {
  const actual = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai', 'petitions.json'), 'utf8'));
  const fresh = collect();
  assert.strictEqual(JSON.stringify(actual.themes), JSON.stringify(fresh.themes));
  assert.strictEqual(JSON.stringify(actual.sources), JSON.stringify(fresh.sources));
});

test('項目の参考資料IDが一次資料索引に存在する', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai', 'petitions.json'), 'utf8'));
  const ids = new Set(data.sources.map((s) => s.id));
  for (const theme of data.themes) {
    for (const item of theme.items) {
      for (const ref of item.references) {
        if (ref.sourceId) assert.ok(ids.has(ref.sourceId), `${item.id}: ${ref.sourceId}`);
      }
    }
  }
});
