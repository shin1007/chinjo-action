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

  const renderProgress = (box, data) => {
    const p = window.SupportPlan.plan(data);
    if (!p) { box.hidden = true; return false; }
    box.textContent = '';
    box.appendChild(el('h2', data.month ? `${data.month.replace('-', '年')}月の集まり具合` : '集まり具合'));
    box.appendChild(el('p', `応援の合計：${yen(p.collected)}`, 'support-total'));
    if (p.current) {
      box.appendChild(el('p', `${p.current.name}　目標 ${yen(p.current.goal)} の ${p.pct}%（あと ${yen(p.remaining)}）`));
      const bar = el('div', null, 'wz-progress');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(p.pct));
      bar.setAttribute('aria-label', `${p.current.name}の集まり具合`);
      const fill = el('div', null, 'support-fill');
      fill.style.width = `${p.pct}%`;
      bar.appendChild(fill);
      box.appendChild(bar);
      if (p.next) box.appendChild(el('p', `次の目標（${p.next.name}）まで、あと ${yen(p.remainingNext)}`, 'small'));
    } else {
      box.appendChild(el('p', 'すべての目標に届きました。ありがとうございます。'));
    }
    const list = el('ol', null, 'support-stages');
    for (const st of p.stages) {
      const mark = st.state === 'done' ? '達成' : st.state === 'current' ? '目指している段階' : 'この次';
      const li = el('li', `${st.name}　目標 ${yen(st.goal)}　［${mark}］`);
      if (st.note) li.appendChild(el('span', `　${st.note}`, 'small'));
      list.appendChild(li);
    }
    box.appendChild(list);
    if (data.updated) box.appendChild(el('p', `${data.updated.replace(/-/g, '/')} 時点（運営が各サービスの管理画面で確かめて更新しています）`, 'small'));
    else if (SUPPORT_LIVE) box.appendChild(el('p', 'Buy Me a Coffee からの知らせで自動で数えています（単発の応援。毎月の応援は、運営が月はじめに足します）', 'small'));
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
      if (renderProgress(document.getElementById('support-progress'), data)) {
        const note = document.getElementById('support-stages-note');
        if (note) note.hidden = true;
      }
      renderSupporters(document.getElementById('support-supporters'), data.supporters);
    } catch (error) {
      console.warn('応援の情報を読み込めませんでした。', error);
    }
  })();
})();
