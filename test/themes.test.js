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
  test(`${theme}：陳情向け・要望向けの分け（route・yoboText）`, () => {
    for (const a of items) {
      if (a.scope === 'national') {
        assert.strictEqual(a.route, undefined, `${a.id}：国への意見書の項目に route は書かない（陳情向けだけ）`);
        assert.strictEqual(a.yoboText, undefined, `${a.id}：国への意見書の項目に yoboText は書かない`);
        continue;
      }
      assert.ok(['chinjo', 'yobo', 'both'].includes(a.route), `${a.id} の route: ${a.route}`);
      if (a.route === 'both') {
        assert.ok(typeof a.yoboText === 'string' && a.yoboText.endsWith('こと。'), `${a.id}：どちらでも向きの項目には、「こと。」で終わる yoboText が要る`);
        assert.notStrictEqual(a.yoboText, a.text, `${a.id}：yoboText は陳情書の text と別の文にする`);
      } else {
        assert.strictEqual(a.yoboText, undefined, `${a.id}：yoboText は route が both のときだけ`);
      }
      if (a.route !== 'chinjo') assert.ok(a.forStaff, `${a.id}：要望書でも使う項目には、実施のイメージ（forStaff）が要る`);
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
