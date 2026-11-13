'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'site', 'data', 'kaito');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const munis = new Set(fs.readFileSync(path.join(__dirname, '..', 'site', 'data', 'intake', 'yobo.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id));

test('kaito/lists.jsonl・items.jsonl の形が正しい', () => {
  const lists = read('lists.jsonl');
  const items = read('items.jsonl');
  for (const r of lists) {
    assert.ok(munis.has(r.muni), `自治体のidが違う: ${r.muni}`);
    assert.match(r.url, /^https?:\/\//);
    assert.ok(['yobo', 'chinjo'].includes(r.kind));
  }
  for (const r of items) {
    assert.ok(munis.has(r.muni), `自治体のidが違う: ${r.muni}`);
    assert.match(r.url, /^https?:\/\//);
    assert.ok(r.date === null || /^\d{4}-\d{2}(-\d{2})?$/.test(r.date), `日付の形: ${r.date}`);
    assert.ok(Array.isArray(r.asks));
  }
});

test('site/data/kaito.js が jsonl と合っている（node scripts/kaito-build.js --no-llm で書き出し直す）', () => {
  global.window = {};
  delete require.cache[require.resolve('../site/data/kaito.js')];
  require('../site/data/kaito.js');
  const lists = read('lists.jsonl');
  assert.strictEqual(Object.keys(window.KAITO).length, lists.length);
  const munis2 = new Set(lists.map((r) => r.muni));
  const hits = read('items.jsonl').filter((x) => x.asks.length && x.reviewed && munis2.has(x.muni)).length;
  assert.strictEqual(Object.values(window.KAITO).reduce((n, k) => n + k.i.length, 0), hits);
});
