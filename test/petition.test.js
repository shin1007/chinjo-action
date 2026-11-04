// 陳情書の文面づくりのテスト。ブラウザと同じ順に data/ と共通のファイルを読み込んで確かめる。
// 実行：npm test（Node 20 以上）
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['data/prefs.js', 'data/asks-national.js', 'data/asks-local.js', 'data/template.js', 'data/municipalities.js',
  'data/offices.js', 'data/sites.js', 'data/councils.js', 'data/kana.js', 'data/reasons.js', 'common.js', 'places.js', 'petition.js'];

function load() {
  const ctx = { FormData };
  ctx.window = ctx;
  vm.createContext(ctx);
  // 書き間違いがあると、ここでファイル名つきのエラーになる
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const w = load();

function form(type, items, extra = {}) {
  const fd = new FormData();
  fd.append('type', type);
  items.forEach((k) => fd.append('items', k));
  for (const k of ['story', 'address', 'name', 'tel']) fd.append(k, extra[k] || '');
  return fd;
}

test('データの id が重ならない', () => {
  const ids = w.ASKS.map((a) => a.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('意見書を求める陳情に、宛名・件名・記・提出先が入る', () => {
  const k = w.ASKS.find((a) => a.scope === 'national').id;
  const t = w.Petition.build(form('ikensho', [k]), '横浜市議会', [k]);
  assert.match(t, /^令和/);
  assert.match(t, /横浜市議会議長　＿＿＿＿＿＿　様/);
  assert.match(t, /件名　/);
  assert.match(t, /\n記\n/);
  assert.match(t, /【意見書の提出先（案）】/);
  assert.doesNotMatch(t, /\{[^}]+\}/, '置き換わっていない記号が残っている');
});

test('自治体あての陳情に意見書の提出先は入らず、住所・氏名が入る', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.build(form('local', [k], { name: '山田太郎', address: '横浜市中区' }), '横浜市議会', [k]);
  assert.doesNotMatch(t, /意見書の提出先/);
  assert.match(t, /氏名　山田太郎/);
  assert.match(t, /住所　横浜市中区/);
});

test('すべての求める事項で文面ができる', () => {
  for (const a of w.ASKS) {
    const t = w.Petition.build(form(a.scope === 'local' ? 'local' : 'ikensho', [a.id]), '札幌市議会', [a.id]);
    assert.doesNotMatch(t, /undefined|\{[^}]+\}/, a.id);
  }
});

test('町村の議会名から郡名を外し、小郡市はそのまま残す', () => {
  const all = w.Places.all();
  assert.ok(all.some((pl) => pl.council === '小郡市議会' && pl.gun === ''));
  const town = all.find((pl) => pl.gun);
  assert.ok(town && !town.council.includes('郡') && town.key === town.gun + town.name);
  assert.strictEqual(all.filter((pl) => pl.isPref).length, w.PREFS.length);
});

test('役所の住所の鍵が、自治体の一覧と食い違わない', () => {
  const missing = w.Places.all().filter((pl) => !(w.OFFICES[pl.pref] || {})[pl.key]);
  assert.ok(missing.length < w.Places.all().length * 0.05, `住所が見つからない自治体が多すぎる：${missing.length}`);
});
