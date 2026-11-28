(() => {
  // supabase/schema.sql の support_payments を反映し、Webhook を登録して確かめたら true にする（それまでは support.json の手で書き写した額）
  const SUPPORT_LIVE = true;
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const yen = (n) => `${Number(n).toLocaleString('ja-JP')}円`;

  const renderMethods = (box, methods) => {
    const valid = methods.filter((m) => /^https:\/\//.test(m.url || ''));
    if (!valid.length) return;
    box.textContent = '';
    for (const m of valid) {
      const a = el('a', `${m.name} で応援する`, 'btn btn-primary');
      a.href = m.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const item = el('div', null, 'support-method');
      item.appendChild(a);
      if (m.note) item.appendChild(el('p', m.note, 'small'));
      box.appendChild(item);
    }
  };

  // 運営費の図の下に1行だけ出す（図は月はじめの値なので、今月の応援の合計をここで新しくする）
  const renderProgress = (box, data) => {
    const p = window.SupportPlan.plan(data);
    if (!box || !p) { if (box) box.hidden = true; return false; }
    const month = data.month ? `${data.month.replace('-', '年')}月` : '今月';
    const rest = p.current ? `目標 ${yen(p.stages[p.stages.length - 1].goal)} まで、あと ${yen(p.stages[p.stages.length - 1].goal - p.collected)}` : 'すべての目標に届きました。ありがとうございます';
    box.textContent = `${month}の応援：${yen(p.collected)}（${rest}）`;
    box.hidden = false;
    return true;
  };

  const renderSupporters = (box, supporters) => {
    const names = (Array.isArray(supporters) ? supporters : []).filter((r) => r && typeof r.name === 'string' && r.name.trim());
    if (!names.length) { box.hidden = true; return; }
    const list = box.querySelector('ul');
    list.textContent = '';
    for (const r of names) list.appendChild(el('li', r.name));
    box.hidden = false;
  };

  (async () => {
    try {
      const response = await fetch('/data/support.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (SUPPORT_LIVE) {
        const month = window.SupportPlan.jstMonth();
        const r = await fetch(`${URL}/rest/v1/support_month_totals?select=month,currency,amount&month=eq.${month}`, { headers: { apikey: KEY } }).catch(() => null);
        const rows = r && r.ok ? await r.json().catch(() => null) : null;
        const yen = window.SupportPlan.liveCollected(data, rows, month);
        if (yen != null) { data.collected = yen; data.month = month; data.updated = null; }
      }
      renderMethods(document.getElementById('support-methods'), Array.isArray(data.methods) ? data.methods : []);
      renderProgress(document.getElementById('support-progress'), data);
      renderSupporters(document.getElementById('support-supporters'), data.supporters);
    } catch (error) {
      console.warn('応援の情報を読み込めませんでした。', error);
    }
  })();
})();
