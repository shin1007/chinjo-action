// 自治体名の探し方のテスト。実行：npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'yomi.js'), 'utf8'), ctx);
const LIST = ['千葉県/鎌ヶ谷市議会', '千葉県/袖ケ浦市議会', '茨城県/かすみがうら市議会'];
const find = (q) => [...ctx.Yomi.filter(LIST, q, () => '')];

test('ケ・ヶ・が の書き方の違いと、末尾の「市」「議会」を問わずに見つかる', () => {
  for (const q of ['鎌ケ谷', '鎌ヶ谷', '鎌が谷市', '鎌ケ谷市議会', ' 鎌ケ谷 ']) assert.deepStrictEqual(find(q), ['千葉県/鎌ヶ谷市議会'], q);
  assert.deepStrictEqual(find('袖ヶ浦'), ['千葉県/袖ケ浦市議会']);
  assert.deepStrictEqual(find('かすみケうら'), ['茨城県/かすみがうら市議会']);
});
