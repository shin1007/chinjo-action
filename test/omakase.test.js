// おまかせ（omakase.html）で使うデータが、くじを引けるだけそろっているかを確かめる。
// 実行：npm test（Node 20 以上）
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE = path.join(__dirname, '..', 'site');
const THEMES = ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota'];
const run = (files) => {
  const ctx = { FormData };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
  return ctx;
};

test('どのテーマにも、陳情として出せる項目が3つ以上ある', () => {
  for (const t of THEMES) {
    const w = run(['data/prefs.js', `themes/${t}/asks-national.js`, `themes/${t}/asks-local.js`, `themes/${t}/template.js`, 'data/municipalities.js', 'js/common.js', 'js/places.js', 'js/petition.js']);
    const P = w.makePetition(w.ASKS, w.TEMPLATE);
    const pool = w.ASKS.filter((a) => P.usableFor(a, 'petition'));
    assert.ok(pool.length >= 3, `${t}：陳情として出せる項目が${pool.length}つしかない`);
  }
});

test('郵送でも審査されると確かめた議会が、人口・住所つきで、異なる都道府県に3つ以上ある', () => {
  const w = run(['data/prefs.js', 'data/municipalities.js', 'data/offices.js', 'data/councils.js', 'data/mail.js', 'data/mail-policy.js', 'js/common.js', 'js/places.js']);
  const pops = JSON.parse(fs.readFileSync(path.join(SITE, 'data/municipality-populations.json'), 'utf8')).populations;
  const prefs = new Set();
  let n = 0;
  for (const pref of w.PREFS) {
    for (const pl of w.Places.of(pref)) {
      const p = w.MailPolicy.get(pref, pl.key);
      if (!p || p.mail_resident !== 'ok' || p.mail_nonresident !== 'ok' || p.confidence !== 'confirmed') continue;
      assert.ok(pops[`${pref}|${pl.isPref ? '都道府県議会' : pl.key}`], `${pref} ${pl.council}：人口のデータがない`);
      assert.ok(w.Places.office(pref, pl.key).address, `${pref} ${pl.council}：議会事務局（本庁舎）の住所がない`);
      prefs.add(pref);
      n += 1;
    }
  }
  assert.ok(n >= 20, `候補が${n}議会しかない`);
  assert.ok(prefs.size >= 3);
});

test('おまかせのページが、読み込むスクリプトと要素をそろえている', () => {
  const html = fs.readFileSync(path.join(SITE, 'omakase.html'), 'utf8');
  const js = fs.readFileSync(path.join(SITE, 'js/omakase.js'), 'utf8');
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(SITE, m[1])), `${m[1]} がない`);
  for (const m of js.matchAll(/\$\('(om[A-Za-z]+)'\)/g)) assert.ok(html.includes(`id="${m[1]}"`), `${m[1]} の要素がない`);
});
