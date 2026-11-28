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

test('段階の目標は、全部の金額が入るか、全部空か。入れるなら前の段階より大きく、集まり具合は現在額が入ったときだけ', () => {
  assert.ok(Array.isArray(data.stages) && data.stages.length >= 2);
  const goals = data.stages.map((st) => st.goal);
  assert.ok(data.stages.every((st) => typeof st.name === 'string' && st.name));
  assert.ok(goals.every((g) => g === null) || goals.every((g) => Number.isInteger(g) && g > 0));
  if (goals[0] !== null) for (let i = 1; i < goals.length; i += 1) assert.ok(goals[i] > goals[i - 1]);
  if (data.collected != null) {
    assert.ok(Number.isInteger(data.collected) && data.collected >= 0);
    assert.match(data.updated, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(data.month, /^\d{4}-\d{2}$/);
  }
});

const { plan } = require('../site/js/support-plan.js');
const stages = [{ name: '第一', goal: 3000 }, { name: '第二', goal: 15000 }];

test('plan：第一段階の途中は、到達割合・あといくら・次の目標までを返す', () => {
  const p = plan({ collected: 1200, stages });
  assert.strictEqual(p.current.name, '第一');
  assert.strictEqual(p.pct, 40);
  assert.strictEqual(p.remaining, 1800);
  assert.strictEqual(p.next.name, '第二');
  assert.strictEqual(p.remainingNext, 13800);
  assert.deepStrictEqual(p.stages.map((s) => s.state), ['current', 'next']);
});

test('plan：第一段階を超えたら第二段階が現在になる。ぴったりの金額は達成とする', () => {
  const p = plan({ collected: 3000, stages });
  assert.strictEqual(p.current.name, '第二');
  assert.strictEqual(p.pct, 20);
  assert.strictEqual(p.remaining, 12000);
  assert.strictEqual(p.next, null);
  assert.deepStrictEqual(p.stages.map((s) => s.state), ['done', 'current']);
});

test('plan：すべて達成したら現在は無く、100%。割合は切り捨てで、届く前に100%と出さない', () => {
  const p = plan({ collected: 20000, stages });
  assert.strictEqual(p.current, null);
  assert.strictEqual(p.pct, 100);
  assert.deepStrictEqual(p.stages.map((s) => s.state), ['done', 'done']);
  assert.strictEqual(plan({ collected: 2999, stages }).pct, 99);
});

test('plan：現在額・目標が揃っていない、または段階が前より大きくないときは出さない', () => {
  assert.strictEqual(plan({ collected: null, stages }), null);
  assert.strictEqual(plan({ collected: 100, stages: [{ name: 'a', goal: null }, { name: 'b', goal: null }] }), null);
  assert.strictEqual(plan({ collected: 100, stages: [{ name: 'a', goal: 5000 }, { name: 'b', goal: 5000 }] }), null);
  assert.strictEqual(plan({ collected: -1, stages }), null);
  assert.strictEqual(plan({ collected: 100 }), null);
  assert.deepStrictEqual(plan(data), plan(data));
});

test('応援者の欄には表示名だけを持ち、金額は持たない', () => {
  for (const r of data.supporters) {
    assert.deepStrictEqual(Object.keys(r), ['name']);
    assert.ok(r.name.length <= 20);
  }
});
