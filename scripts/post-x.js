// X（旧 Twitter）に、機能更新などの告知を自動で投稿する（告知専用のボットのアカウント用）。
// 設計：docs/設計/SNS自動投稿の設計.md
//
//   node scripts/post-x.js --dry-run   … 送らずに、投稿する文・文字数・検査の結果だけを出す
//   node scripts/post-x.js             … 予定日が来た分を、1回の実行で最大 --max 件（既定1）投稿する
//
// 投稿の予定：site/data/sns-queue.jsonl（1行1件）
//   {"id":"2026-12-01-roster","text":"…","scheduled":"2026-12-01"}
// 投稿した記録：site/data/sns-posted.jsonl（1行1件。id・投稿の日時・X の投稿 ID）
//
// 鍵は環境変数（GitHub の Secrets）で渡す。リポジトリには書かない。
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET（OAuth 1.0a の4つ）
//
// 守ること（X の自動化の規約。二次資料による。実装の前に公式ページを確かめる）：
//   返信・メンションの自動化はしない（@ を含む文は送らない）。同じ文は2度送らない。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const QUEUE = path.join(ROOT, 'site', 'data', 'sns-queue.jsonl');
const POSTED = path.join(ROOT, 'site', 'data', 'sns-posted.jsonl');
const ENDPOINT = 'https://api.x.com/2/tweets';
const MAX_WEIGHT = 280;
const URL_WEIGHT = 23;

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').map((l, i) => ({ l: l.trim(), i: i + 1 })).filter((x) => x.l).map((x) => {
    try { return JSON.parse(x.l); } catch (e) { throw new Error(`${path.basename(file)} の${x.i}行目が JSON ではありません`); }
  });
}

// X の文字数の数え方（twitter-text の設定を元にした近似）：URL は1つ23、
// 半角の英数字などは1、日本語などは2。上限は280。
function weightedLength(text) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  let rest = text;
  for (const u of urls) rest = rest.replace(u, '');
  let w = urls.length * URL_WEIGHT;
  for (const ch of rest) {
    const c = ch.codePointAt(0);
    const light = (c >= 0x0000 && c <= 0x10ff) || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037);
    w += light ? 1 : 2;
  }
  return w;
}

// 投稿の文の検査。問題の一覧（空なら通る）を返す。
function validate(item, seenTexts) {
  const errs = [];
  if (!item.id || typeof item.id !== 'string') errs.push('id がありません');
  if (!item.text || typeof item.text !== 'string') errs.push('text がありません');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.scheduled || '')) errs.push('scheduled は YYYY-MM-DD で書きます');
  if (item.text) {
    const w = weightedLength(item.text);
    if (w > MAX_WEIGHT) errs.push(`長すぎます（${w}/${MAX_WEIGHT}）`);
    if (/(^|[^\w])@\w/.test(item.text)) errs.push('@ を含む文は送りません（メンションの自動化は禁止）');
    if ((item.text.match(/#\S+/g) || []).length > 2) errs.push('ハッシュタグは2つまでです');
    if (seenTexts && seenTexts.has(item.text)) errs.push('同じ文が、すでに投稿されているか、予定に重なっています');
  }
  return errs;
}

// 日本時間の今日（YYYY-MM-DD）
function todayJst(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// 投稿する分：まだ投稿していなくて、予定日が今日以前のもの（予定日が古い順）。
function pickDue(queue, posted, today, max) {
  const done = new Set(posted.map((p) => p.id));
  return queue.filter((q) => !done.has(q.id) && q.scheduled <= today)
    .sort((a, b) => (a.scheduled < b.scheduled ? -1 : a.scheduled > b.scheduled ? 1 : 0))
    .slice(0, max);
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// OAuth 1.0a の Authorization ヘッダー。JSON の本文は署名に含めない。
function oauthHeader(method, url, keys, nonce = crypto.randomBytes(16).toString('hex'), timestamp = String(Math.floor(Date.now() / 1000))) {
  const p = {
    oauth_consumer_key: keys.apiKey, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp, oauth_token: keys.accessToken, oauth_version: '1.0',
  };
  const paramStr = Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join('&');
  const base = [method.toUpperCase(), enc(url), enc(paramStr)].join('&');
  const key = `${enc(keys.apiSecret)}&${enc(keys.accessSecret)}`;
  p.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(p).sort().map((k) => `${enc(k)}="${enc(p[k])}"`).join(', ');
}

async function postTweet(text, keys) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: oauthHeader('POST', ENDPOINT, keys), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`X API が ${res.status} を返しました：${body.slice(0, 300)}`);
  return JSON.parse(body).data;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const mi = args.indexOf('--max');
  const max = mi >= 0 ? Math.max(1, parseInt(args[mi + 1], 10) || 1) : 1;
  const queue = readJsonl(QUEUE);
  const posted = readJsonl(POSTED);
  const today = todayJst();
  const seen = new Set();
  for (const p of posted) if (p.text) seen.add(p.text);
  let bad = 0;
  const ids = new Set();
  for (const q of queue) {
    const errs = validate(q, null);
    if (ids.has(q.id)) errs.push('id が重なっています');
    ids.add(q.id);
    if (errs.length) { bad++; console.error(`× ${q.id || '(idなし)'}：${errs.join(' / ')}`); }
  }
  if (bad) { console.error(`検査に通らない予定が ${bad} 件あります。投稿しません。`); process.exit(1); }
  const due = pickDue(queue, posted, today, max);
  console.log(`今日（日本時間）${today}／予定 ${queue.length} 件／投稿済み ${posted.length} 件／今回の対象 ${due.length} 件${dry ? '（dry-run：送りません）' : ''}`);
  const keys = { apiKey: process.env.X_API_KEY, apiSecret: process.env.X_API_SECRET, accessToken: process.env.X_ACCESS_TOKEN, accessSecret: process.env.X_ACCESS_SECRET };
  if (!dry && due.length && Object.values(keys).some((v) => !v)) { console.error('X_API_KEY・X_API_SECRET・X_ACCESS_TOKEN・X_ACCESS_SECRET が揃っていません。投稿しません。'); process.exit(1); }
  for (const item of due) {
    const errs = validate(item, seen);
    console.log(`--- ${item.id}（予定 ${item.scheduled}、重さ ${weightedLength(item.text)}/${MAX_WEIGHT}）\n${item.text}`);
    if (errs.length) { console.error(`× 送りません：${errs.join(' / ')}`); process.exit(1); }
    if (dry) continue;
    const data = await postTweet(item.text, keys);
    const rec = { id: item.id, text: item.text, posted_at: new Date().toISOString(), tweet_id: data.id };
    fs.appendFileSync(POSTED, JSON.stringify(rec) + '\n');
    seen.add(item.text);
    console.log(`投稿しました：${data.id}`);
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { weightedLength, validate, pickDue, oauthHeader, todayJst, readJsonl };
