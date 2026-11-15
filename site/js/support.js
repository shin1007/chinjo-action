(() => {
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const yen = (n) => `${Number(n).toLocaleString('ja-JP')}円`;
  const isAmount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

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
    if (!isAmount(data.goal) || !data.goal || !isAmount(data.collected)) { box.hidden = true; return; }
    const pct = Math.min(100, Math.round((data.collected / data.goal) * 100));
    box.textContent = '';
    box.appendChild(el('h2', data.month ? `${data.month.replace('-', '年')}月の集まり具合` : '集まり具合'));
    box.appendChild(el('p', `${yen(data.collected)} ／ 目標 ${yen(data.goal)}（${pct}%）`, 'support-total'));
    const bar = el('div', null, 'wz-progress');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-label', '応援の集まり具合');
    const fill = el('div', null, 'support-fill');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    box.appendChild(bar);
    if (data.updated) box.appendChild(el('p', `${data.updated.replace(/-/g, '/')} 時点（運営が各サービスの管理画面で確かめて更新しています）`, 'small'));
    box.hidden = false;
  };

  const renderRanking = (box, ranking) => {
    const names = (Array.isArray(ranking) ? ranking : []).filter((r) => r && typeof r.name === 'string' && r.name.trim());
    if (!names.length) { box.hidden = true; return; }
    const list = box.querySelector('ol');
    list.textContent = '';
    for (const r of names) list.appendChild(el('li', r.name));
    box.hidden = false;
  };

  (async () => {
    try {
      const response = await fetch('/data/support.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderMethods(document.getElementById('support-methods'), Array.isArray(data.methods) ? data.methods : []);
      renderProgress(document.getElementById('support-progress'), data);
      renderRanking(document.getElementById('support-ranking'), data.ranking);
    } catch (error) {
      console.warn('応援の情報を読み込めませんでした。', error);
    }
  })();
})();
