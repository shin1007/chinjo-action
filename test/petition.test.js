// 陳情書の文面づくりのテスト。ブラウザと同じ順に data/ と共通のファイルを読み込んで確かめる。
// 実行：npm test（Node 20 以上）
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const FILES = ['themes/kodomo/theme.js', 'data/prefs.js', 'themes/kodomo/asks-national.js', 'themes/kodomo/asks-local.js', 'themes/kodomo/template.js', 'data/municipalities.js',
  'data/offices.js', 'data/sites.js', 'data/councils.js', 'data/kana.js', 'themes/kodomo/reasons.js', 'js/common.js', 'js/places.js', 'js/petition.js'];

function load() {
  const ctx = { FormData };
  ctx.window = ctx;
  vm.createContext(ctx);
  // 書き間違いがあると、ここでファイル名つきのエラーになる
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const w = load();

function form(items, extra = {}) {
  const fd = new FormData();
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
  const t = w.Petition.build(form([k]), '横浜市議会', [k]);
  assert.match(t, /^令和/);
  assert.match(t, /横浜市議会議長　＿＿＿＿＿＿　様/);
  assert.match(t, /件名　/);
  assert.match(t, /\n記\n/);
  assert.match(t, /【意見書の提出先（案）】/);
  assert.doesNotMatch(t, /\{[^}]+\}/, '置き換わっていない記号が残っている');
});

test('自治体あての陳情に意見書の提出先は入らず、住所・氏名が入る', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.build(form([k], { name: '山田太郎', address: '横浜市中区' }), '横浜市議会', [k]);
  assert.doesNotMatch(t, /意見書の提出先/);
  assert.match(t, /氏名　山田太郎/);
  assert.match(t, /住所　横浜市中区/);
});

test('自治体あては要望書に切り替えられる', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const fd = form([k]);
  fd.append('kind', 'request');
  const t = w.Petition.build(fd, '横浜市議会', [k]);
  assert.match(t, /件名　.*要望$/m);
  assert.match(t, /^横浜市長　＿＿＿＿＿＿　様$/m);
  assert.match(t, /【要望の趣旨】/);
  assert.match(t, /【要望の理由】/);
  assert.doesNotMatch(t, /陳情の趣旨|陳情の理由/);
});

test('実施のイメージ（forStaff）は要望書にだけ入り、陳情書には入らない', () => {
  const it = w.ASKS.find((a) => a.scope === 'local' && a.forStaff);
  assert.ok(it, 'forStaff のある自治体あての項目がない');
  const req = form([it.id]);
  req.append('kind', 'request');
  assert.ok(w.Petition.build(req, '横浜市議会', [it.id]).includes(it.forStaff));
  assert.ok(!w.Petition.build(form([it.id]), '横浜市議会', [it.id]).includes(it.forStaff));
});

test('要望書の宛名は知事・市区町村長になり、宛先を替えると呼び方も替わる', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const fd = form([k], { story: '見聞きしたこと' });
  fd.append('kind', 'request');
  const t = w.Petition.build(fd, '宮城県議会', [k]);
  assert.match(t, /^宮城県知事　＿＿＿＿＿＿　様$/m);
  assert.match(t, /（要望者として）/);
  assert.doesNotMatch(t, /陳情者/);
  const s = w.Petition.swapCouncil(t, '宮城県議会', '仙台市議会');
  assert.match(s, /^仙台市長　＿＿＿＿＿＿　様$/m);
  assert.doesNotMatch(s, /仙台市知事|宮城県/);
  assert.match(w.Petition.build(fd, '世田谷区議会', [k]), /^世田谷区長　/m);
});

test('要望書も生成AIで趣旨と理由を書き直せる', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const fd = form([k]);
  fd.append('kind', 'request');
  const t = w.Petition.build(fd, '横浜市議会', [k]);
  const prompt = w.Petition.buildRewritePrompt(t, '横浜市議会');
  assert.match(prompt, /横浜市長に出す要望書/);
  assert.match(prompt, /【要望の趣旨】/);
  assert.doesNotMatch(prompt, /陳情/);
  // AI が陳情の目印で返しても、要望書の目印の所に入る
  const answer = ['【陳情の趣旨】', '新しい趣旨', '【陳情の理由】', '新しい理由', '【参照した計画】', 'なし'].join('\n');
  const out = w.Petition.applyRewrite(t, answer);
  assert.match(out, /【要望の趣旨】\n新しい趣旨/);
  assert.match(out, /【要望の理由】\n新しい理由/);
});

test('要望書の出し方のページは、公式サイトのある自治体の https のページで、47都道府県と政令指定都市がそろっている', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(SITE, 'data/request-pages.js'), 'utf8'), ctx);
  const pages = ctx.window.REQUEST_PAGES;
  for (const [id, [url, title]] of Object.entries(pages)) {
    const [pref, key] = id.split('/');
    assert.ok((w.SITES[pref] || {})[key], id);
    assert.match(url, /^https?:\/\//, id);
    assert.ok(title, id);
    assert.doesNotMatch(title, /要望活動|パブリック/, id);
  }
  // 熊本県は見つからなかった（docs/確認用/要望書の出し方のページが見つからない自治体.md）
  const missing = w.PREFS.filter((p) => !pages[`${p}/@`]);
  assert.deepStrictEqual([...missing], ['熊本県']);
  for (const c of ['札幌市', '仙台市', 'さいたま市', '千葉市', '横浜市', '川崎市', '相模原市', '新潟市', '静岡市', '浜松市', '名古屋市', '京都市', '大阪市', '堺市', '神戸市', '岡山市', '広島市', '北九州市', '福岡市', '熊本市']) {
    assert.ok(Object.keys(pages).some((id) => id.endsWith(`/${c}`)), c);
  }
});

test('すべての求める事項で文面ができる', () => {
  for (const a of w.ASKS) {
    const t = w.Petition.build(form([a.id]), '札幌市議会', [a.id]);
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
  const t = w.Petition.build(form([k]), '横浜市議会', [k]);
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
  const docs = ks.map((k) => w.Petition.build(form([k]), '伊達市議会', [k]));
  const blank = { zip: '', address: '', name: '', tel: '' };
  const c = w.Petition.cover('伊達市議会', docs, { ...blank, name: '佐藤花子' });
  assert.match(c, /伊達市議会事務局　御中/);
  assert.match(c, /氏名　佐藤花子/);
  assert.match(c, /住所　＿＿＿＿＿＿/);
  assert.match(c, /一　陳情書「.+」　1通\n二　陳情書「.+」　1通/);
  assert.doesNotMatch(c, /\{[^}]+\}/);
});

// ほかの分野も、同じ仕組みで文面ができることを確かめる
for (const theme of ['dansei', 'nihonjin', 'shiho', 'kenko', 'sonota']) {
  test(`${theme}：すべての求める事項で文面と指示文ができる`, () => {
    const ctx = { FormData };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const f of FILES.map((f) => f.replace('themes/kodomo/', `themes/${theme}/`))) {
      vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
    }
    assert.strictEqual(ctx.THEME.id, theme);
    const ids = ctx.ASKS.map((a) => a.id);
    assert.strictEqual(new Set(ids).size, ids.length);
    for (const a of ctx.ASKS) {
      const fd = form([a.id]);
      const t = ctx.Petition.build(fd, '札幌市議会', [a.id]);
      assert.doesNotMatch(t, /undefined|\{[^}]+\}/, a.id);
      assert.doesNotMatch(t, /子ども/, a.id);
      assert.doesNotMatch(ctx.Petition.buildPrompt(fd, ['札幌市議会']), /undefined|子ども/, a.id);
    }
  });
}

test('AIへの書き直しの指示文には、趣旨と理由だけが入り、住所・氏名・電話は入らない', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.build(form([k], { name: '山田太郎', address: '横浜市中区', tel: '090-1111-2222' }), '横浜市議会', [k]);
  const p = w.Petition.buildRewritePrompt(t, '横浜市議会', { local: '市の窓口で案内が少ない' });
  assert.ok(p.includes(w.Petition.sections(t).reasons));
  assert.match(p, /市の窓口で案内が少ない/);
  assert.doesNotMatch(p, /山田太郎|中区|090-1111/);
});

test('AIの答えで趣旨と理由だけを入れ替え、書式と求める事項はそのまま残す', () => {
  const k = w.ASKS.find((a) => a.scope === 'national').id;
  const t = w.Petition.build(form([k]), '横浜市議会', [k]);
  const answer = '```\n【陳情の趣旨】\n　新しい趣旨です。\n\n【陳情の理由】\n1．見出し\n　新しい理由です。\n```';
  const out = w.Petition.applyRewrite(t, answer);
  assert.match(out, /【陳情の趣旨】\n　新しい趣旨です。\n\n記\n/);
  assert.match(out, /【陳情の理由】\n1．見出し\n　新しい理由です。\n\n【参考資料】\n1　/);
  assert.match(out, /【意見書の提出先（案）】/);
  assert.strictEqual(out.split('\n記\n')[1].split('【陳情の理由】')[0], t.split('\n記\n')[1].split('【陳情の理由】')[0]);
  assert.match(out, /件名　/);
  assert.match(out, /以上$/);
});

test('AIの答えに目印がなければ入れ替えない', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.build(form([k]), '横浜市議会', [k]);
  assert.strictEqual(w.Petition.applyRewrite(t, '書き直しました。'), null);
  assert.strictEqual(w.Petition.applyRewrite(t, '【陳情の趣旨】\n\n【陳情の理由】\n'), null);
});

test('書き直しの指示文に、その自治体の計画を探して結びつける頼みが入る', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.build(form([k]), '横浜市議会', [k]);
  const p = w.Petition.buildRewritePrompt(t, '横浜市議会');
  assert.match(p, /横浜市の公式サイト/);
  w.THEME.ai.plans.forEach((pl) => assert.ok(p.includes(pl), pl));
  assert.match(p, /【参照した計画】/);
});

test('参照した計画は文面に入れず、別に取り出す', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.build(form([k]), '横浜市議会', [k]);
  const answer = '【陳情の趣旨】\n　趣旨です。\n【陳情の理由】\n1．見出し\n　理由です。\n【参照した計画】\n- 横浜市こども計画／https://www.city.yokohama.lg.jp/kosodate/plan.html／基本目標1';
  const out = w.Petition.applyRewrite(t, answer);
  assert.doesNotMatch(out, /参照した計画|city\.yokohama/);
  const plans = w.Petition.rewritePlans(answer);
  assert.strictEqual(plans.length, 1);
  assert.strictEqual(plans[0].url, 'https://www.city.yokohama.lg.jp/kosodate/plan.html');
  assert.strictEqual(w.Petition.rewritePlans('【陳情の理由】\nx\n【参照した計画】\nなし').length, 0);
});

test('国あてと自治体あてを一緒に選ぶと、指示文で項目ごとに種類を書き分ける', () => {
  const n = w.ASKS.find((a) => a.scope === 'national').id;
  const l = w.ASKS.find((a) => a.scope === 'local').id;
  const p = w.Petition.buildPrompt(form([n, l]), ['横浜市議会']);
  assert.match(p, /（種類：国）/);
  assert.match(p, /（種類：自治体）/);
  assert.match(p, /意見書の提出先（国の事項のみ）/);
});

test('要望書の「回答のお願い」は選んだときだけ入り、外すと元に戻る', () => {
  const k = w.ASKS.find((a) => a.scope === 'local').id;
  const fd = form([k]);
  fd.append('kind', 'request');
  const t = w.Petition.build(fd, '横浜市議会', [k], 'request');
  const on = w.Petition.withReply(t, true);
  assert.match(on, /【回答のお願い】\n　本要望について[^\n]+\n\n以上$/);
  assert.strictEqual(w.Petition.withReply(on, true), on);
  assert.strictEqual(w.Petition.withReply(on, false), t);
  assert.strictEqual(w.Petition.withReply(t, false), t);
});

test('意見書の案は国あての内容にだけでき、地方自治法第99条の結びと提出先が入る', () => {
  const n = w.ASKS.find((a) => a.scope === 'national').id;
  const l = w.ASKS.find((a) => a.scope === 'local').id;
  const t = w.Petition.ikensho('横浜市議会', [n]);
  assert.match(t, /を求める意見書（案）/);
  assert.match(t, /よって、国においては、.+ため、下記事項を実現するよう強く要望する。/);
  assert.match(t, /地方自治法第99条の規定により意見書を提出する。/);
  assert.match(t, /　衆議院議長　様/);
  assert.match(t, /横浜市議会\n/);
  assert.strictEqual(w.Petition.ikensho('横浜市議会', [l]), '');
});
