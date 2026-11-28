// Buy Me a Coffee の Webhook の受け口（/api/bmc-webhook）。
// 単発の応援（donation.created・donation.refunded）の金額・通貨・手数料・日時だけを Supabase の support_payments に書く。
// 応援した人の名前・メールアドレス・メッセージは保存しない。
// 環境変数（Vercel）：BMC_WEBHOOK_SECRET（管理画面の Signing secret）、SUPABASE_SECRET_KEY（Supabase の secret キー）
// 毎月の応援（recurring_donation.*）は、引き落としごとのイベントがないので数えない（scripts/support-month.js で手で足す）。
const crypto = require('crypto');

const SUPABASE_URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
const EVENTS = new Set(['donation.created', 'donation.refunded']);

const readRaw = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

function verify(raw, secret, signature) {
  if (!secret || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
}

// イベントから、保存してよい項目だけを取り出す（個人情報は持たない）
function toRow(event) {
  if (!event || !EVENTS.has(event.type) || !event.data) return null;
  const d = event.data;
  const id = Number(d.id);
  const amount = Number(d.amount);
  const paid = Number(d.created_at || event.created);
  if (!Number.isInteger(id) || !(amount >= 0) || !(paid > 0)) return null;
  const fee = Number(d.application_fee);
  return {
    payment_id: id,
    kind: 'donation',
    amount,
    currency: String(d.currency || 'USD').toUpperCase().slice(0, 3),
    fee: Number.isFinite(fee) ? fee : null,
    refunded: event.type === 'donation.refunded' || String(d.refunded) === 'true' || d.status === 'refunded',
    live: event.live_mode !== false,
    paid_at: new Date(paid * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }
  const raw = await readRaw(req);
  if (!verify(raw, process.env.BMC_WEBHOOK_SECRET, req.headers['x-signature-sha256'])) {
    res.status(401).json({ error: 'bad signature' });
    return;
  }
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { res.status(400).json({ error: 'bad json' }); return; }
  const row = toRow(event);
  if (!row) { res.status(200).json({ ok: true, ignored: event && event.type }); return; }
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) { res.status(500).json({ error: 'not configured' }); return; }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/support_payments?on_conflict=payment_id`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(10000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
  if (!r.ok) {
    console.error('support_payments に書けなかった', r.status, await r.text());
    res.status(502).json({ error: 'store failed' });
    return;
  }
  res.status(200).json({ ok: true });
}

module.exports = handler;
module.exports.verify = verify;
module.exports.toRow = toRow;
