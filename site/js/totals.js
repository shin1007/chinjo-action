// トップページの「これまでの歩み」。提出の報告の集計（陳情を出した自治体・要望の件数）と、今月の応援の合計を出す。
// 集計は Supabase の action_totals（件数だけ。個人情報は持たない）。supabase/schema.sql を反映して動作を確かめたら LIVE を true にする。
// false の間は数字を出さず「準備中」と表示する。
(() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  const LIVE = true;
  // site/js/support.js の SUPPORT_LIVE と合わせる
  const SUPPORT_LIVE = true;

  const box = document.getElementById('tally');
  if (!box) return;
  const num = (n) => `${Number(n).toLocaleString('ja-JP')}`;
  const isNum = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const note = document.getElementById('tallyNote');

  const showTotals = async () => {
    if (!LIVE) return;
    const r = await fetch(`${URL}/rest/v1/action_totals?select=councils,items`, { headers: { apikey: KEY } }).catch(() => null);
    const row = r && r.ok ? (await r.json().catch(() => []))[0] : null;
    if (!row || !isNum(row.councils) || !isNum(row.items)) return;
    document.getElementById('tallyItems').textContent = num(row.items);
    document.getElementById('tallyCouncils').textContent = num(row.councils);
    note.textContent = '作成画面で「出したら押す」を押した報告の数です（自己申告で、運営は確かめていません）。';
  };

  // 応援は /data/support.json に運営が手で書き写した金額（入っていなければ出さない）。
  // SUPPORT_LIVE のときは、Webhook の記録の今月の合計を出す
  const jstMonth = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  const showSupport = async () => {
    const r = await fetch('/data/support.json', { cache: 'no-cache' }).catch(() => null);
    const data = r && r.ok ? await r.json().catch(() => null) : null;
    if (data && SUPPORT_LIVE && data.cost && isNum(data.cost.rate)) {
      const month = jstMonth();
      const t = await fetch(`${URL}/rest/v1/support_month_totals?select=month,currency,amount&month=eq.${month}`, { headers: { apikey: KEY } }).catch(() => null);
      const rows = t && t.ok ? await t.json().catch(() => null) : null;
      if (Array.isArray(rows)) {
        let yen = data.month === month && isNum(data.extraJpy) ? data.extraJpy : 0;
        for (const row of rows) if (isNum(row.amount)) yen += row.currency === 'JPY' ? row.amount : row.amount * data.cost.rate;
        data.collected = Math.round(yen);
      }
    }
    if (!data || !isNum(data.collected)) return;
    const item = document.getElementById('tallySupport');
    item.querySelector('dd').textContent = `${num(data.collected)}円`;
    item.hidden = false;
  };

  showTotals();
  showSupport();
})();
