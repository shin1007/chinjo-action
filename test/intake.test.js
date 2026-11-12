'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { checkKind, exportText, EXPORT_FILE } = require('../scripts/intake.js');

for (const kind of ['chinjo', 'yobo']) {
  test(`intake/${kind}.jsonl の形が正しい`, () => {
    const { rows, errs } = checkKind(kind);
    assert.ok(rows.length > 1700, `${kind} の件数が少ない: ${rows.length}`);
    assert.deepStrictEqual(errs.slice(0, 20), []);
  });
}

test('site/data/intake.js が jsonl から書き出し直してある（node scripts/intake.js export）', () => {
  assert.strictEqual(fs.readFileSync(EXPORT_FILE, 'utf8'), exportText());
});
