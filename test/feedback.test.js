// ご意見の受け付け（/feedback）と、予定・困りごとのページの静的な検査。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const sql = read('supabase/schema.sql');
const js = read('site/js/feedback.js');
const html = read('site/feedback.html');

test('feedback.js が送る列は、schema.sql で anon に渡した列と同じ', () => {
  const granted = sql.match(/grant insert \(([^)]*)\) on public\.feedback to anon;/)[1].split(',').map((s) => s.trim());
  const sent = js.match(/const FIELDS = \[([^\]]*)\]/)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepStrictEqual(sent, granted);
});

test('フォームの種類・テーマの値は、schema.sql の check と合っている', () => {
  const checkValues = (col) => sql.match(new RegExp(`${col} text(?: not null)? check \\(${col} in \\(([^)]*)\\)`))[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  const formValues = (name) => [...html.match(new RegExp(`<select name="${name}"[^>]*>([\\s\\S]*?)</select>`))[1].matchAll(/value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  assert.deepStrictEqual([...formValues('kind')].sort(), [...checkValues('kind')].sort());
  assert.deepStrictEqual([...formValues('theme')].sort(), [...checkValues('theme')].sort());
});

test('feedback：支払いの有無・連絡先の列は作らず、フォームにも連絡先の欄がない', () => {
  const table = sql.match(/create table if not exists public\.feedback \(([\s\S]*?)\n\);/)[1];
  for (const col of ['paid', 'payment', 'amount', 'email', 'mail', 'phone', 'name', 'address']) assert.ok(!new RegExp(`^\\s+${col}\\b`, 'm').test(table), `${col} 列がある`);
  assert.ok(!/type="(email|tel)"/.test(html));
  assert.match(html, /個別の事案は、弁護士や行政書士などの専門家にご相談ください/);
});

test('送り先のテーブルが Supabase に反映されるまで（LIVE が false の間）、入力欄は出ない', () => {
  assert.match(js, /const LIVE = (true|false);/);
  assert.match(html, /<form id="fb-form"[^>]*hidden>/);
  assert.match(html, /id="fb-pending"/);
});

test('予定・困りごと・ご意見のページがあり、トップ・about・support のフッターからたどれる', () => {
  for (const f of ['roadmap', 'trouble', 'feedback']) {
    assert.ok(fs.existsSync(path.join(ROOT, `site/${f}.html`)), `${f}.html`);
    for (const page of ['index', 'about', 'support']) assert.match(read(`site/${page}.html`), new RegExp(`href="/${f}"`), `${page} から ${f}`);
  }
});

test('予定のページは、各項目に「出てくる場所」を書いている', () => {
  const rows = read('site/roadmap.html').match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>[\s\S]*?<\/tr>/g);
  assert.ok(rows.length >= 4);
  for (const r of rows) assert.strictEqual((r.match(/<td>/g) || []).length, 3, r.slice(0, 80));
});
