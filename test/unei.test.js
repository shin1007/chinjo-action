const test = require('node:test');
const assert = require('node:assert');
const { doneList } = require('../scripts/unei.js');

test('unei.js done：出したものを日付順に返し、チームみらいの進みは出した項目の数と合う', () => {
  const r = doneList();
  const dates = r.sent.map((x) => x.date);
  assert.deepStrictEqual(dates, [...dates].sort());
  assert.ok(r.sent.every((x) => x.to && x.what));
  assert.ok(r.mirai.done <= r.mirai.of);
  assert.ok(r.rounds.every((x) => x.date && x.theme));
});
