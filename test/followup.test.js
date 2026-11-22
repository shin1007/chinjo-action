// 提出したあとの確認（site/js/followup.js）：段階の判定と、カレンダーのファイル。
const { test } = require('node:test');
const assert = require('node:assert');
const F = require('../site/js/followup.js');

const rec = (over = {}) => ({ id: '東京都/渋谷区議会', at: '2026-11-01', asks: [], items: 1, answers: {}, ...over });

test('段階：7日・30日・90日で出て、答えたら出ない', () => {
  assert.strictEqual(F.dueStage(rec(), '2026-11-07'), null);
  assert.strictEqual(F.dueStage(rec(), '2026-11-08'), 1);
  assert.strictEqual(F.dueStage(rec(), '2026-12-01'), 2);
  assert.strictEqual(F.dueStage(rec(), '2027-01-30'), 3);
  assert.strictEqual(F.dueStage(rec({ answers: { 1: 'adopted' } }), '2026-11-20'), null);
  assert.strictEqual(F.dueStage(rec({ answers: { 1: 'unknown' } }), '2026-12-01'), 2);
});

test('段階：「あとで」の間は出ない', () => {
  assert.strictEqual(F.dueStage(rec({ snooze: '2026-11-12' }), '2026-11-10'), null);
  assert.strictEqual(F.dueStage(rec({ snooze: '2026-11-12' }), '2026-11-13'), 1);
});

test('カレンダー：3件の予定。議会名と日付だけで、文面や氏名を含まない', () => {
  const ics = F.buildIcs(rec());
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(ics, /DTSTART;VALUE=DATE:20261108/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261201/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270130/);
  assert.match(ics, /渋谷区議会/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));
});

test('結果の選択肢は schema.sql の outcomes.result と一致する', () => {
  const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, '../supabase/schema.sql'), 'utf8');
  const m = sql.match(/result in \(([^)]*)\)\)/);
  const inSql = [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort();
  assert.deepStrictEqual(F.RESULTS.map(([v]) => v).sort(), inSql);
});
