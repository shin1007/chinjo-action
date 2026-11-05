// 陳情書の文面づくりのテスト。ブラウザと同じ順に data/ と共通のファイルを読み込んで確かめる。
// 実行：npm test（Node 20 以上）
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['themes/kodomo/theme.js', 'data/prefs.js', 'themes/kodomo/asks-national.js', 'themes/kodomo/asks-local.js', 'themes/kodomo/template.js', 'data/municipalities.js',
  'data/offices.js', 'data/sites.js', 'data/councils.js', 'data/kana.js', 'themes/kodomo/reasons.js', 'common.js', 'places.js', 'petition.js'];

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

test('差出人を入れると住所が入り、氏名は手書き用の下線のまま、電話は陳情書に入らない', () => {
  const k = w.ASKS[0].id;
  const t = w.Petition.build(form('ikensho', [k]), '横浜市議会', [k]);
  const s = { zip: '123-4567', address: '横浜市中区1-1', name: '佐藤花子', tel: '090-0000-0000' };
  const filled = w.Petition.withSender(t, s);
  assert.match(filled, /住所　〒123-4567　横浜市中区1-1\n氏名　＿＿＿＿＿＿　　　　印\n/);
  assert.doesNotMatch(filled, /090-0000-0000/);
  const cleared = w.Petition.withSender(filled, { zip: '', address: '', name: '', tel: '' });
  assert.strictEqual(cleared, t);
  assert.match(w.Petition.cover('横浜市議会', [t], s), /電話　090-0000-0000/);
});

test('鏡文に議会事務局・差出人・同封する陳情書の件名が入る', () => {
  const ks = w.ASKS.filter((a) => a.scope === 'national').slice(0, 2).map((a) => a.id);
  const docs = ks.map((k) => w.Petition.build(form('ikensho', [k]), '伊達市議会', [k]));
  const blank = { zip: '', address: '', name: '', tel: '' };
  const c = w.Petition.cover('伊達市議会', docs, { ...blank, name: '佐藤花子' });
  assert.match(c, /伊達市議会事務局　御中/);
  assert.match(c, /氏名　佐藤花子/);
  assert.match(c, /住所　＿＿＿＿＿＿/);
  assert.match(c, /一　陳情書「.+」　1通\n二　陳情書「.+」　1通/);
  assert.doesNotMatch(c, /\{[^}]+\}/);
});

// ほかの分野も、同じ仕組みで文面ができることを確かめる
for (const theme of ['dansei', 'nihonjin', 'shiho']) {
  test(`${theme}：すべての求める事項で文面と指示文ができる`, () => {
    const ctx = { FormData };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const f of FILES.map((f) => f.replace('themes/kodomo/', `themes/${theme}/`))) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    assert.strictEqual(ctx.THEME.id, theme);
    const ids = ctx.ASKS.map((a) => a.id);
    assert.strictEqual(new Set(ids).size, ids.length);
    for (const a of ctx.ASKS) {
      const fd = form(a.scope === 'local' ? 'local' : 'ikensho', [a.id]);
      const t = ctx.Petition.build(fd, '札幌市議会', [a.id]);
      assert.doesNotMatch(t, /undefined|\{[^}]+\}/, a.id);
      assert.doesNotMatch(t, /子ども/, a.id);
      assert.doesNotMatch(ctx.Petition.buildPrompt(fd, ['札幌市議会']), /undefined|子ども/, a.id);
    }
  });
}
