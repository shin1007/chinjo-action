// common.js は、文面のデータ（PREFS・ASKS・TEMPLATE・MUNICIPALITIES）がないと画面の上に「読み込めませんでした」と出す。
// データを使わないページは <body data-skip-data-check> にする。外し忘れ・付け忘れを見つける
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pages } = require('../scripts/pages.js');

const NEED = [/\/data\/prefs\.js/, /\/asks-(national|local)\.js/, /\/template\.js/, /\/data\/municipalities\.js/];

test('common.js を読むページは、文面のデータをそろえて読むか、data-skip-data-check を付けている', () => {
  for (const { file, html } of pages()) {
    if (!/src="\/js\/common\.js"/.test(html) || /<body[^>]*data-skip-data-check/.test(html)) continue;
    const miss = NEED.filter((re) => !re.test(html));
    assert.deepStrictEqual(miss, [], `${path.relative(path.join(__dirname, '..'), file)}：足りないデータがある（使わないなら <body data-skip-data-check="1">）`);
  }
});
