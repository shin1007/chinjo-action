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

test('困りごと・ご意見のページがあり、トップ・about・support のフッターからたどれる', () => {
  for (const f of ['trouble', 'feedback']) {
    assert.ok(fs.existsSync(path.join(ROOT, `site/${f}.html`)), `${f}.html`);
    for (const page of ['index', 'about', 'support']) assert.match(read(`site/${page}.html`), new RegExp(`href="/${f}"`), `${page} から ${f}`);
  }
});

test('掲示板：読むのは feedback_public ビューだけで、書き込まない。原文・対象・根拠 URL・状態は出さない', () => {
  const boardJs = fs.readFileSync(path.join(ROOT, 'site/js/board.js'), 'utf8');
  assert.match(boardJs, /const LIVE = (true|false);/);
  assert.ok(!/method:\s*'(POST|PATCH|DELETE|PUT)'/.test(boardJs));
  const view = sql.match(/create or replace view public\.feedback_public as([\s\S]*?);/)[1];
  assert.match(view, /where published and public_text is not null/);
  for (const col of ['body', 'target', 'source_url', 'status', 'owner_note']) assert.ok(!new RegExp(`\\b${col}\\b`).test(view), `${col} を出している`);
  assert.match(sql, /new\.published := false;/);
  assert.match(sql, /new\.public_text := null;/);
});

test('掲示板のページがあり、準備中の表示と、フッターからのリンクがある', () => {
  const board = fs.readFileSync(path.join(ROOT, 'site/board.html'), 'utf8');
  assert.match(board, /id="board-pending"/);
  for (const page of ['index', 'about', 'support', 'trouble', 'feedback']) assert.match(read(`site/${page}.html`), /href="\/board"/, `${page} から /board`);
});

test('非弁行為の説明ページ（/horitsu）：弁護士法第72条・行政書士法第19条の原文の引用と e-Gov へのリンクがあり、関連ページからたどれる', () => {
  const page = read('site/horitsu.html');
  assert.match(page, /報酬を得る目的で訴訟事件、非訟事件及び審査請求/);
  assert.match(page, /報酬を得て、業として第一条の三に規定する業務を行うことができない/);
  assert.match(page, /https:\/\/laws\.e-gov\.go\.jp\/law\/324AC1000000205/);
  assert.match(page, /https:\/\/laws\.e-gov\.go\.jp\/law\/326AC1000000004/);
  for (const f of ['feedback', 'board', 'trouble']) assert.match(read(`site/${f}.html`), /href="\/horitsu"/, `${f} から /horitsu`);
});
