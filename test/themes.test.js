// すべてのテーマの項目データの形を確かめる。書き足したときの抜け（必ずある欄・refs の URL・id の重なり）を防ぐ。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const THEMES = fs.readdirSync(path.join(SITE, 'themes')).filter((d) => fs.existsSync(path.join(SITE, 'themes', d, 'asks-national.js')));

function asks(theme) {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['asks-national.js', 'asks-local.js']) {
    const p = path.join(SITE, 'themes', theme, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: `themes/${theme}/${f}` });
  }
  return ctx.ASKS || [];
}

for (const theme of THEMES) {
  const items = asks(theme);
  test(`${theme}：項目がある`, () => assert.ok(items.length > 0));
  test(`${theme}：id が重ならない`, () => {
    const ids = items.map((a) => a.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.strictEqual(dup.length, 0, `重なり: ${dup.join(', ')}`);
  });
  test(`${theme}：必ずある欄がそろっている`, () => {
    for (const a of items) {
      for (const k of ['id', 'scope', 'label']) assert.ok(typeof a[k] === 'string' && a[k], `${a.id} の ${k}`);
      assert.ok(['national', 'local'].includes(a.scope), `${a.id} の scope: ${a.scope}`);
    }
  });
  test(`${theme}：refs の形と URL`, () => {
    for (const a of items) {
      if (a.refs === undefined) continue;
      assert.ok(Array.isArray(a.refs), `${a.id} の refs が配列でない`);
      for (const r of a.refs) {
        assert.ok(typeof r.t === 'string' && r.t, `${a.id} の refs に題名がない`);
        if (r.url !== undefined) assert.match(r.url, /^https?:\/\/[^\s]+$/, `${a.id} の URL: ${r.url}`);
      }
    }
  });
}
