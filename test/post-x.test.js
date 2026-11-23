const test = require('node:test');
const assert = require('node:assert');
const { weightedLength, validate, pickDue, oauthHeader, todayJst } = require('../scripts/post-x.js');

test('文字数：日本語は2、英数字は1、URL は23', () => {
  assert.strictEqual(weightedLength('あいう'), 6);
  assert.strictEqual(weightedLength('abc'), 3);
  assert.strictEqual(weightedLength('見る https://chinjo-action.vercel.app/very/long/path?x=1'), 4 + 1 + 23);
  assert.strictEqual(weightedLength('https://a.example/' + 'x'.repeat(200)), 23);
});

test('検査：長すぎる文・@・日付の形・重なりを止める', () => {
  const ok = { id: 'a', text: '新しい項目を足しました', scheduled: '2026-12-01' };
  assert.deepStrictEqual(validate(ok, new Set()), []);
  assert.ok(validate({ ...ok, text: 'あ'.repeat(141) }, new Set()).some((e) => e.includes('長すぎ')));
  assert.ok(validate({ ...ok, text: '@someone 見てください' }, new Set()).some((e) => e.includes('@')));
  assert.ok(validate({ ...ok, scheduled: '12/1' }, new Set()).some((e) => e.includes('scheduled')));
  assert.ok(validate(ok, new Set([ok.text])).some((e) => e.includes('同じ文')));
  assert.ok(validate({ ...ok, text: 'a #1 #2 #3' }, new Set()).some((e) => e.includes('ハッシュタグ')));
});

test('対象：予定日が来ていて未投稿のものを、古い順に最大件数まで', () => {
  const q = [
    { id: 'c', text: 'c', scheduled: '2026-12-03' },
    { id: 'a', text: 'a', scheduled: '2026-12-01' },
    { id: 'b', text: 'b', scheduled: '2026-12-02' },
  ];
  assert.deepStrictEqual(pickDue(q, [], '2026-12-02', 5).map((x) => x.id), ['a', 'b']);
  assert.deepStrictEqual(pickDue(q, [{ id: 'a' }], '2026-12-02', 5).map((x) => x.id), ['b']);
  assert.deepStrictEqual(pickDue(q, [], '2026-12-03', 1).map((x) => x.id), ['a']);
});

test('日本時間の日付', () => {
  assert.strictEqual(todayJst(new Date('2026-12-01T16:00:00Z')), '2026-12-02');
});

test('OAuth の署名：同じ入力なら同じ、鍵が違えば違う', () => {
  const k = { apiKey: 'k', apiSecret: 's', accessToken: 't', accessSecret: 'ts' };
  const a = oauthHeader('POST', 'https://api.x.com/2/tweets', k, 'nonce', '1700000000');
  const b = oauthHeader('POST', 'https://api.x.com/2/tweets', k, 'nonce', '1700000000');
  const c = oauthHeader('POST', 'https://api.x.com/2/tweets', { ...k, accessSecret: 'x' }, 'nonce', '1700000000');
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, c);
  assert.match(a, /^OAuth oauth_consumer_key="k", oauth_nonce="nonce", oauth_signature="[^"]+", oauth_signature_method="HMAC-SHA1"/);
});
