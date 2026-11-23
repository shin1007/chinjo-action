const test = require('node:test');
const assert = require('node:assert');
const { parse, build, utc, fold } = require('../scripts/schedule-to-ics.js');

const MD = `### [ ] 11月24日（火）07:30｜A 入口

- リンク先：\`/\`
- 画像：なし
- 投稿前の確認：約480円か。

\`\`\`
陳情は、500円足らずで出せます。
https://example.com/
#陳情
\`\`\`

### [x] 11月25日（水）12:15｜C 知識

- リンク先：\`/about\`
- 画像：\`docs/a.gif\`
- 投稿前の確認：なし。

\`\`\`
済みの投稿
\`\`\`
`;

test('見出しと本文を読む', () => {
  const ev = parse(MD, 2026);
  assert.strictEqual(ev.length, 2);
  assert.deepStrictEqual([ev[0].month, ev[0].day, ev[0].hour, ev[0].min, ev[0].done], [11, 24, 7, 30, false]);
  assert.strictEqual(ev[0].text, '陳情は、500円足らずで出せます。\nhttps://example.com/\n#陳情');
  assert.strictEqual(ev[1].done, true);
  assert.strictEqual(ev[1].img, 'docs/a.gif');
});

test('日本時間を UTC に直す（朝7:30 は前日の22:30Z）', () => {
  assert.strictEqual(utc({ year: 2026, month: 11, day: 24, hour: 7, min: 30 }), '20261123T223000Z');
  assert.strictEqual(utc({ year: 2026, month: 11, day: 24, hour: 22, min: 30 }), '20261124T133000Z');
  assert.strictEqual(utc({ year: 2026, month: 11, day: 24, hour: 7, min: 30 }, 15), '20261123T224500Z');
});

test('1行が75オクテットを超えない。畳んだものを戻すと元の文', () => {
  const s = 'DESCRIPTION:' + 'あ'.repeat(100);
  const f = fold(s);
  for (const l of f.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75, l);
  assert.strictEqual(f.replace(/\r\n /g, ''), s);
});

test('予定を書き出す：開始・通知・エスケープ', () => {
  const ics = build(parse(MD, 2026).filter((e) => !e.done), new Date('2026-11-23T00:00:00Z'));
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20261123T223000Z/);
  assert.match(ics, /TRIGGER:-PT15M/);
  assert.match(ics, /TRIGGER:PT0M/);
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(!/済みの投稿/.test(ics));
  assert.match(build([{ year: 2026, month: 1, day: 1, hour: 9, min: 0, type: 'A', link: '', img: '', check: '', text: 'a,b;c' }]).replace(/\r\n /g, ''), /a\\,b\\;c/);
  assert.match(ics.replace(/\r\n /g, ''), /陳情は、500円足らずで出せます。\\nhttps/);
});
