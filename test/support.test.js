// 応援のページのデータの形のテスト。実行：npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site/data/support.json'), 'utf8'));

test('応援の方法（空でもよい）は https の URL を持つ', () => {
  for (const m of data.methods) {
    assert.match(m.url, /^https:\/\//);
    assert.ok(m.name);
  }
});

test('集まり具合は、目標と現在額がそろっているときだけ書く', () => {
  const hasGoal = data.goal != null;
  const hasCollected = data.collected != null;
  assert.strictEqual(hasGoal, hasCollected);
  if (hasGoal) {
    assert.ok(data.goal > 0 && data.collected >= 0);
    assert.match(data.updated, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('ランキングには表示名だけを持ち、金額は持たない', () => {
  for (const r of data.ranking) {
    assert.deepStrictEqual(Object.keys(r), ['name']);
    assert.ok(r.name.length <= 20);
  }
});
