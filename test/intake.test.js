'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { checkKind, exportText, EXPORT_FILE, coverageText, COVERAGE_FILE } = require('../scripts/intake.js');

for (const kind of ['chinjo', 'yobo']) {
  test(`intake/${kind}.jsonl の形が正しい`, () => {
    const { rows, errs } = checkKind(kind);
    assert.ok(rows.length > 1700, `${kind} の件数が少ない: ${rows.length}`);
    assert.deepStrictEqual(errs.slice(0, 20), []);
  });
}

// Windows で core.autocrlf=true だと、取り出したファイルが CRLF になる。改行の違いは比べない
const lf = (t) => t.replace(/\r\n/g, '\n');

test('site/data/intake.js が jsonl から書き出し直してある（node scripts/intake.js export）', () => {
  assert.strictEqual(lf(fs.readFileSync(EXPORT_FILE, 'utf8')), exportText());
});

test('site/data/coverage.json が intake/*.jsonl から書き出し済み（node scripts/intake.js coverage）', () => {
  assert.strictEqual(lf(fs.readFileSync(COVERAGE_FILE, 'utf8')), coverageText());
});
