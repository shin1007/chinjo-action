// 毎月の応援の書き写しと、為替レートの見直し。
//
// 実行：
//   node scripts/support-month.js --usd 25            今月の応援の合計（Buy Me a Coffee の管理画面のドルの額）を書き写す
//   node scripts/support-month.js --month 2026-12 --usd 25 --count 3
//   node scripts/support-month.js                     為替レートを見直す。Webhook の記録（Supabase の support_month_totals）があれば、単発の応援の合計もそこから取る
//   node scripts/support-month.js --extra-usd 10      Webhook で数えられない毎月の応援などを足す（support.json の extraJpy）
//   毎月6日に GitHub Actions（.github/workflows/support-month.yml）が自動で動かして main に入れる
//   node scripts/support-month.js --check             /trouble の図が support.json と合っているかだけを見る（npm test から使う）
//
// やること：
//   1. その月の最初の営業日の、三菱UFJ銀行の米ドルの仲値（TTS と TTB の真ん中）を取る
//   2. site/data/support.json の month・updated・collected・cost を書き換える
//   3. /trouble の「1か月の運営費」の図（site/trouble.html の印の間）を作り直す
//   4. 収入の記録（docs/非公開/収入の記録.csv。Git に入れない）に1行足す
//   5. Claude Max の料金と手数料が、目標の金額に収まっているかを確かめて知らせる
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SUPPORT = path.join(ROOT, 'site/data/support.json');
const TROUBLE = path.join(ROOT, 'site/trouble.html');
const LEDGER = path.join(ROOT, 'docs/非公開/収入の記録.csv');
const START = '<!-- support-cost:start（node scripts/support-month.js が書く。手で直さない） -->';
const END = '<!-- support-cost:end -->';
// Buy Me a Coffee の手数料（利用規約 第4条の5%）と、カードの決済手数料（ヘルプの 2.9%＋30セント）
const FEE_RATE = 0.05 + 0.029;
const FEE_FIXED_USD = 0.3;
const SUPABASE_URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
const { liveCollected } = require('../site/js/support-plan.js');

const yen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;
const pct = (n, total) => Math.max(0, Math.min(100, Math.round((n / total) * 1000) / 10));

// 図の HTML（CSP で style 属性が使えないので、帯は SVG の rect の幅で描く）
function costHtml(data) {
  const c = data.cost;
  const goal = data.stages[data.stages.length - 1].goal;
  const planYen = c.planUsd * c.rate;
  const kanpa = Math.min(data.collected || 0, goal);
  const self = Math.max(0, planYen - kanpa);
  const short = Math.max(0, goal - kanpa - self);
  const wK = pct(kanpa, goal);
  const wS = pct(self, goal);
  const wShort = Math.max(0, Math.round((100 - wK - wS) * 10) / 10);
  const [y, m, d] = c.rateDate.split('-').map(Number);
  const label = `目標の${yen(goal)}のうち、自費が約${yen(self)}（${Math.round(wS)}%）、カンパが${yen(kanpa)}、足りない分が約${yen(short)}`;
  return [
    '<figure id="support-cost" class="cost-chart">',
    `    <figcaption><b>1か月の運営費</b>：いまは ${c.plan}（約${yen(planYen)}）。目標は ${yen(goal)}（Claude Max の約${yen(c.maxUsd * c.rate)}に、応援の手数料（約8%）・為替の動き・サイトの公開や X などの利用料の分を足した額）</figcaption>`,
    `    <svg class="cost-svg" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${label}">`,
    `      <rect class="cost-kanpa" x="0" y="0" width="${wK}" height="10"/>`,
    `      <rect class="cost-self-rect" x="${wK}" y="0" width="${wS}" height="10"/>`,
    `      <rect class="cost-short-rect" x="${Math.round((wK + wS) * 10) / 10}" y="0" width="${wShort}" height="10"/>`,
    '    </svg>',
    `    <div class="cost-scale small"><span>0円</span><span>目標 ${yen(goal)}</span></div>`,
    '    <ul class="cost-legend small">',
    `      <li><span class="cost-key cost-key-self"></span>自費：約${yen(self)}</li>`,
    `      <li><span class="cost-key cost-key-kanpa"></span>カンパ：${yen(kanpa)}</li>`,
    `      <li><span class="cost-key cost-key-short"></span>足りない分：約${yen(short)}</li>`,
    '    </ul>',
    `    <p class="small">月払い・税別の <a href="https://claude.com/pricing" target="_blank" rel="noopener">Pro ${c.planUsd}ドル・Max ${c.maxUsd}ドル</a>を、月初（${y}年${m}月${d}日）の<a href="${c.rateUrl}" target="_blank" rel="noopener">三菱UFJ銀行の仲値</a> 1ドル＝${c.rate.toFixed(2)}円で換算。カンパは${data.month ? `${data.month.replace('-', '年')}月の` : ''}応援の合計（手数料を引く前）。料金はドル建てなので、毎月はじめに換算し直し、必要なら目標の金額を見直します。</p>`,
    '  </figure>',
  ].join('\n');
}

function replaceFigure(html, figure) {
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a < 0 || b < 0) throw new Error(`site/trouble.html に印（${START} … ${END}）がない`);
  return `${html.slice(0, a + START.length)}\n  ${figure}\n  ${html.slice(b)}`;
}

// 三菱UFJリサーチ&コンサルティングの公表する過去の相場。営業日でない日は表が無いので、次の日を試す
async function fetchRate(month) {
  const [y, m] = month.split('-').map(Number);
  for (let d = 1; d <= 10; d += 1) {
    const id = `${String(y).slice(2)}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    const url = `https://www.murc-kawasesouba.jp/fx/past/index.php?id=${id}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (chinjo-action support-month)' } });
    if (!res.ok) continue;
    const text = await res.text();
    // 営業日でない日は、最新の日の相場が出る（「As of」の日付が違う）ので飛ばす
    const asOf = text.match(/As of ([A-Za-z]+) (\d+), (\d{4})/);
    if (!asOf) continue;
    const mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(asOf[1]) + 1;
    if (Number(asOf[3]) !== y || mon !== m || Number(asOf[2]) !== d) continue;
    const row = text.match(/USD<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>\s*<td[^>]*>\s*([\d.]+)/);
    if (!row) continue;
    const rate = Math.round(((Number(row[1]) + Number(row[2])) / 2) * 100) / 100;
    return { rate, rateDate: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, rateUrl: url };
  }
  throw new Error(`${month} の最初の10日に、米ドルの相場が見つからない`);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? null : process.argv[i + 1];
}

async function main() {
  const data = JSON.parse(fs.readFileSync(SUPPORT, 'utf8'));
  const html = fs.readFileSync(TROUBLE, 'utf8').replace(/\r\n/g, '\n');
  if (process.argv.includes('--check')) {
    const now = replaceFigure(html, costHtml(data));
    if (now !== html) { console.error('/trouble の図が support.json と合っていない。node scripts/support-month.js を動かす'); process.exit(1); }
    return;
  }
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const month = arg('month') || today.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('--month は 2026-12 の形で');
  const usd = arg('usd') == null ? null : Number(arg('usd'));
  const count = arg('count') == null ? null : Number(arg('count'));
  const extraUsd = arg('extra-usd') == null ? null : Number(arg('extra-usd'));
  if (usd != null && !(usd >= 0)) throw new Error('--usd は0以上の数');

  const r = await fetchRate(month);
  const newMonth = data.month !== month;
  data.cost = { ...data.cost, ...r };
  data.month = month;
  data.updated = today;
  if (newMonth) data.extraJpy = 0;
  if (extraUsd != null) data.extraJpy = Math.round(extraUsd * r.rate);
  let liveUsd = null;
  if (usd != null) data.collected = Math.round(usd * r.rate);
  else {
    const t = await fetch(`${SUPABASE_URL}/rest/v1/support_month_totals?select=month,currency,amount&month=eq.${month}`, { headers: { apikey: SUPABASE_KEY } }).catch(() => null);
    const rows = t && t.ok ? await t.json().catch(() => null) : null;
    const liveYen = liveCollected(data, rows, month);
    if (liveYen != null && rows.length) {
      data.collected = liveYen;
      liveUsd = rows.filter((x) => x.currency === 'USD').reduce((a, x) => a + x.amount, 0);
      console.log(`Webhook の記録から：単発の応援 ${liveUsd}ドル${data.extraJpy ? `＋手で足した分 ${yen(data.extraJpy)}` : ''}`);
    } else if (newMonth) data.collected = 0;
  }
  fs.writeFileSync(SUPPORT, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(TROUBLE, replaceFigure(html, costHtml(data)));

  console.log(`${month}：1ドル＝${r.rate}円（${r.rateDate}）`);
  const gross = usd != null ? usd : liveUsd != null ? liveUsd + (extraUsd || 0) : null;
  if (gross != null) {
    const usd = gross;
    const fee = usd * FEE_RATE + (count || 0) * FEE_FIXED_USD;
    console.log(`応援の合計 ${usd}ドル＝${yen(usd * r.rate)}（手数料の見込み 約${yen(fee * r.rate)}${count ? '' : '。--count を付けると1件30セントも引く'}）`);
    if (fs.existsSync(path.dirname(LEDGER))) {
      if (!fs.existsSync(LEDGER)) fs.writeFileSync(LEDGER, '月,応援の合計（ドル）,件数,換算レート,レートの日,応援の合計（円）,手数料の見込み（円）,記録した日\n');
      fs.appendFileSync(LEDGER, [month, usd, count ?? '', r.rate, r.rateDate, Math.round(usd * r.rate), Math.round(fee * r.rate), today].join(',') + '\n');
      console.log(`収入の記録に足した：${path.relative(ROOT, LEDGER)}`);
    }
  }
  const goal = data.stages[data.stages.length - 1].goal;
  const need = data.cost.maxUsd * r.rate / (1 - FEE_RATE);
  if (need > goal) console.log(`【見直し】Claude Max を手数料込みで賄うには約${yen(need)}要る。目標（${yen(goal)}）を上げるか決める`);
  else console.log(`目標 ${yen(goal)} で足りる（Claude Max を手数料込みで約${yen(need)}）`);
  console.log('済んだら npm test を動かして、コミットする');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { costHtml, replaceFigure };
