// 文面以外の共通の処理のテスト。実行：npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['themes/kodomo/theme.js', 'data/prefs.js', 'themes/kodomo/asks-national.js', 'themes/kodomo/asks-local.js', 'themes/kodomo/template.js',
  'common.js', 'petition.js', 'yomi.js', 'postage.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}

test('esc は HTML の記号をすべて置き換える', () => {
  assert.strictEqual(ctx.Common.esc(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.strictEqual(ctx.Common.esc(null), '');
});

test('別の議会あてに書き換えると、宛名と自治体名が変わる', () => {
  const t = '横浜市議会議長　様\n横浜市において、横浜市議会として取り組むよう';
  assert.strictEqual(ctx.Petition.swapCouncil(t, '横浜市議会', '川崎市議会'), '川崎市議会議長　様\n川崎市において、川崎市議会として取り組むよう');
  assert.strictEqual(ctx.Petition.swapCouncil(t, '横浜市議会', '横浜市議会'), t);
  assert.strictEqual(ctx.Petition.swapCouncil('東京都議会議長', '東京都議会', '大阪府議会'), '大阪府議会議長');
});

test('議会の検索は、かなや打ち間違いでも見つける', () => {
  const list = ['横浜市議会', '横須賀市議会', '川崎市議会'];
  const kana = { 横浜市議会: 'ヨコハマシ', 横須賀市議会: 'ヨコスカシ', 川崎市議会: 'カワサキシ' };
  const find = (q) => ctx.Yomi.filter(list, q, (c) => kana[c]);
  assert.deepStrictEqual([...find('横浜')], ['横浜市議会']);
  assert.deepStrictEqual([...find('よこ')], ['横浜市議会', '横須賀市議会']);
  assert.deepStrictEqual([...find('kawasaki')], ['川崎市議会']);
  assert.deepStrictEqual([...find('kawasaky')], ['川崎市議会'], '打ち間違い');
  assert.deepStrictEqual([...find('存在しない')], []);
});

test('切手の目安は、重さの上限を超えると1つ上の料金になる', () => {
  const { estimate, RATES } = ctx.Postage;
  assert.strictEqual(estimate(1).yen, RATES[0][1]);
  assert.strictEqual(estimate(16).yen, 180);
  assert.ok(estimate(17).yen > 180);
  assert.strictEqual(estimate(1000).yen, 0);
});

test('テーマごとのページが templates/ と食い違わない（直したら node scripts/pages.js）', () => {
  const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const { file, html } of require('../scripts/pages.js').pages()) {
    assert.ok(read(file) === html, `${path.relative(ROOT, file)} が templates/ と違います`);
  }
});

test('関連資料のページの項目ごとの資料が asks-*.js の refs と食い違わない（直したら node scripts/refs.js）', () => {
  const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  for (const { file, html } of require('../scripts/refs.js').pages()) {
    assert.ok(read(file) === html, `${path.relative(ROOT, file)} が asks-*.js の refs と違います`);
  }
});
