// 文面の言い回しの揺らぎ（site/js/variants.js）：変えてよいのは文末とあいさつだけ。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const load = (seed) => {
  const w = { crypto: { getRandomValues: (a) => { a[0] = seed; return a; } }, sessionStorage: { getItem: () => null, setItem: () => {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site/js/variants.js'), 'utf8'), { window: w, globalThis: w, Uint32Array, Math });
  return w.Variants;
};

test('趣旨・結びは、文末だけが変わり、それ以外は一字も変わらない', () => {
  const head = '子どもの権利を守るため、国に対し、下記事項の実現を求める意見書を提出していただきたく';
  const seen = new Set();
  for (let seed = 1; seed < 200; seed += 1) {
    const V = load(seed);
    const p = V.purpose(`${head}陳情いたします。`);
    assert.ok(p.startsWith(head.slice(0, -2)), p);
    assert.match(p, /陳情いたします。$/);
    seen.add(p);
    const c = V.closing('事実Aと数字12%を踏まえ、取り組みを強く要望いたします。');
    assert.ok(c.startsWith('事実Aと数字12%を踏まえ、取り組みを'), c);
    seen.add(c);
  }
  assert.ok(seen.size >= 5, '言い方が複数に分かれる');
});

test('同じ乱数なら同じ言い方（作り直しても変わらない）', () => {
  assert.strictEqual(load(12345).closing('あ強く要望いたします。'), load(12345).closing('あ強く要望いたします。'));
});

test('合わない文末は、そのまま', () => {
  const V = load(7);
  assert.strictEqual(V.purpose('求めます。'), '求めます。');
  assert.strictEqual(V.closing('求めます。'), '求めます。');
});

test('送付状：あいさつだけが変わり、宛先・差出人・書類の行は変わらない', () => {
  const text = '拝啓　時下ますますご清栄のこととお慶び申し上げます。\n宛先行\nお取り計らいくださいますようお願い申し上げます。\n書類行';
  for (let seed = 1; seed < 50; seed += 1) {
    const out = load(seed).cover(text).split('\n');
    assert.strictEqual(out[1], '宛先行');
    assert.strictEqual(out[3], '書類行');
  }
});
