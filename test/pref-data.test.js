// 陳情書を作るページが都道府県ごとに読み込むデータ（site/data/pref/*.js）が、元のファイルと合っているか
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { build, fileText, pad, OUT, DATA, councilMail, councilMailText } = require('../scripts/split-pref-data.js');

test('site/data/pref/ が元のデータから書き出し直してある（node scripts/split-pref-data.js）', () => {
  const rows = build();
  assert.strictEqual(rows.length, 47);
  rows.forEach(([pref, d], i) => {
    const f = path.join(OUT, `${pad(i)}.js`);
    const s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
    assert.strictEqual(s, fileText(pref, d), `${f}（${pref}）が古い`);
  });
});

test('site/data/council-mail.js が data/councils.js から書き出し直してある（node scripts/split-pref-data.js）', () => {
  const s = fs.readFileSync(path.join(DATA, 'council-mail.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.strictEqual(s, councilMailText(councilMail()));
});
