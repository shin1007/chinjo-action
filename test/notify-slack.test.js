const test = require('node:test');
const assert = require('node:assert');
const { due, payload, mediaPaths, mediaUrl, when } = require('../scripts/notify-slack.js');

const E = (month, day, hour, min, extra = {}) => ({ year: 2026, month, day, hour, min, done: false, type: 'A 入口', link: '/', img: '', check: '確認', text: '本文\nhttps://example.com/', ...extra });

test('20分以内に始まる未投稿の予定だけを選ぶ', () => {
  const now = new Date('2026-11-24T07:20:00+09:00').getTime();
  const ev = [E(11, 24, 7, 30), E(11, 24, 7, 20), E(11, 24, 7, 41), E(11, 24, 7, 25, { done: true }), E(11, 24, 7, 10)];
  assert.deepStrictEqual(due(ev, now).map((e) => `${e.hour}:${e.min}`), ['7:30']);
  assert.strictEqual(when(E(11, 24, 7, 30)), new Date('2026-11-24T07:30:00+09:00').getTime());
});

test('画像・動画の場所を取り出し、URL にする', () => {
  assert.deepStrictEqual(mediaPaths('なし'), []);
  assert.deepStrictEqual(mediaPaths('docs/見本/紹介画像/kenko-1.png、docs/x/a.mp4'), ['docs/見本/紹介画像/kenko-1.png', 'docs/x/a.mp4']);
  assert.match(mediaUrl('docs/見本/紹介画像/kenko-1.png'), /^https:\/\/raw\.githubusercontent\.com\/shin1007\/chinjo-action\/main\/docs\/%E8%A6%8B%E6%9C%AC\/%E7%B4%B9%E4%BB%8B%E7%94%BB%E5%83%8F\/kenko-1\.png$/);
});

test('Slack の内容：見出し・本文のコードブロック・画像・動画・確認', () => {
  const p = payload(E(11, 24, 7, 30, { img: 'docs/a/b.png、docs/a/c.mp4' }));
  assert.match(p.text, /11月24日 7:30/);
  assert.strictEqual(p.blocks[0].type, 'header');
  assert.match(p.blocks[1].text.text, /^```本文\nhttps:\/\/example\.com\/```$/);
  assert.strictEqual(p.blocks.filter((b) => b.type === 'image').length, 1);
  assert.ok(p.blocks.some((b) => b.type === 'section' && /動画/.test(b.text.text)));
  assert.strictEqual(p.blocks[p.blocks.length - 1].type, 'context');
});

test('本文にコードブロックの記号があっても壊れない', () => {
  const p = payload(E(11, 24, 7, 30, { text: 'a```b' }));
  assert.ok(!p.blocks[1].text.text.slice(3, -3).includes('```'));
});
