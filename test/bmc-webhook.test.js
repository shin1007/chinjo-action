// Buy Me a Coffee の Webhook の受け口のテスト。実行：npm test
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { verify, toRow } = require('../api/bmc-webhook.js');
const { liveCollected } = require('../site/js/support-plan.js');

test('署名は、本文の HMAC-SHA256 が合うときだけ通す', () => {
  const raw = Buffer.from('{"type":"donation.created"}');
  const sig = crypto.createHmac('sha256', 's3cret').update(raw).digest('hex');
  assert.strictEqual(verify(raw, 's3cret', sig), true);
  assert.strictEqual(verify(raw, 'other', sig), false);
  assert.strictEqual(verify(raw, 's3cret', 'abc'), false);
  assert.strictEqual(verify(raw, '', sig), false);
});

test('保存するのは金額・通貨・手数料・日時・種類だけで、名前・メール・メッセージは持たない', () => {
  const row = toRow({ type: 'donation.created', live_mode: true, created: 1719825600, data: {
    id: 98765, amount: 15, currency: 'usd', application_fee: 0.75, status: 'succeeded', refunded: 'false',
    created_at: 1719825600, supporter_name: 'Alex', supporter_email: 'alex@example.com', support_note: 'hi' } });
  assert.deepStrictEqual(Object.keys(row).sort(), ['amount', 'currency', 'fee', 'kind', 'live', 'paid_at', 'payment_id', 'refunded', 'updated_at']);
  assert.strictEqual(row.currency, 'USD');
  assert.strictEqual(row.refunded, false);
  assert.strictEqual(toRow({ type: 'donation.refunded', data: { id: 1, amount: 5, created_at: 1 } }).refunded, true);
  assert.strictEqual(toRow({ type: 'membership.started', data: { id: 1 } }), null);
  assert.strictEqual(toRow({ type: 'donation.created', live_mode: false, data: { id: 2, amount: 5, created_at: 1 } }).live, false);
});

test('Webhook の記録から、その月の合計（円）を出す', () => {
  const data = { month: '2026-12', extraJpy: 1000, cost: { rate: 150 } };
  const rows = [{ month: '2026-12', currency: 'USD', amount: 10 }, { month: '2026-11', currency: 'USD', amount: 99 }];
  assert.strictEqual(liveCollected(data, rows, '2026-12'), 2500);
  assert.strictEqual(liveCollected({ ...data, month: '2026-11' }, rows, '2026-12'), 1500);
  assert.strictEqual(liveCollected({ month: '2026-12' }, rows, '2026-12'), null);
});
