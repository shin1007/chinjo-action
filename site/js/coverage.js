// 人口カバー率（/coverage）。site/data/coverage.json（node scripts/intake.js coverage で作る）を読んで表と一覧を出す
(() => {
  const $ = (id) => document.getElementById(id);
  const pct = (x) => (x.total ? (100 * x.pop / x.total) : 0).toFixed(1);
  const fmt = (n) => n.toLocaleString('ja-JP');
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const LABEL = { c: '陳情', y: '要望', p: 'パブコメ' };
  const STATE = { 0: 'まだ', 1: '案内ページだけ', 2: '出し方まで' };

  fetch('/data/coverage.json').then((r) => r.json()).then((d) => {
    const [y, m, dd] = d.asOf.split('-').map(Number);
    $('cov-asof').textContent = `${y}年${m}月${dd}日時点（人口は${d.population_as_of.slice(0, 4)}年1月1日現在）`;
    renderTable(d.kinds);
    setupList(d.rows, d.prefs);
  }).catch(() => { $('cov-asof').textContent = '読み込めませんでした。時間をおいて開き直してください。'; });

  function cell(x) {
    const td = el('td');
    const m = el('meter'); m.min = 0; m.max = 100; m.value = Number(pct(x));
    m.setAttribute('aria-label', `${pct(x)}%`);
    td.append(m, el('span', ` ${pct(x)}%`), el('br'), el('span', `${fmt(x.n)} / ${fmt(x.of)}`, 'small'));
    return td;
  }
  function renderTable(k) {
    const t = el('table', null, 'cost-table');
    const h = el('tr'); ['', '都道府県', '市区町村'].forEach((s) => h.append(el('th', s)));
    t.append(el('thead')); t.tHead.append(h);
    const b = el('tbody');
    const rows = [
      ['陳情（議会）：出し方までわかる', 'chinjo', 'known'], ['陳情（議会）：案内ページはある', 'chinjo', 'page'],
      ['要望（首長）：出し方までわかる', 'yobo', 'known'], ['要望（首長）：案内ページはある', 'yobo', 'page'],
      ['パブリックコメントのページ', 'pubcom', 'page'],
    ];
    for (const [label, kind, lv] of rows) {
      const tr = el('tr'); tr.append(el('th', label), cell(k.pref[kind][lv]), cell(k.municipality[kind][lv])); b.append(tr);
    }
    t.append(b);
    $('cov-table').replaceChildren(t);
  }

  function setupList(rows, prefs) {
    const prefSel = $('cov-pref');
    for (const p of prefs) prefSel.append(new Option(p, p));
    const q = new URLSearchParams(location.search);
    if (q.get('pref')) prefSel.value = q.get('pref');
    if (q.get('kind')) $('cov-kind').value = q.get('kind');
    let shown = 50;
    const draw = () => {
      const pref = prefSel.value; const kind = $('cov-kind').value;
      const i = { c: 2, y: 3, p: 4 }[kind]; const need = kind === 'p' ? 1 : 2;
      const list = rows.filter((r) => (!pref || r[0].startsWith(pref + '/')) && r[i] < need);
      $('cov-count').textContent = `${list.length} 件（人口 ${fmt(list.reduce((a, r) => a + r[1], 0))} 人分）。人口の多い順です。`;
      const tb = $('cov-list').tBodies[0]; tb.replaceChildren();
      for (const r of list.slice(0, shown)) {
        const [pf, nm] = r[0].split('/');
        const name = nm === '@' ? pf : `${pf} ${nm}`;
        const tr = el('tr');
        const known = ['c', 'y', 'p'].map((k, j) => `${LABEL[k]}：${k === 'p' ? (r[4] ? 'ある' : 'まだ') : STATE[r[2 + j]]}`).join('／');
        const a = el('a', '知らせる');
        const target = kind === 'c' ? `${nm === '@' ? pf : nm}議会` : kind === 'y' ? `${nm === '@' ? pf + '知事' : nm + '長'}あての要望` : `${nm === '@' ? pf : nm}のパブリックコメント`;
        a.href = `/feedback?kind=council_procedure&target=${encodeURIComponent(name + '：' + target)}#fb-form`;
        tr.append(el('td', name), el('td', fmt(r[1])), el('td', known, 'small'));
        const td = el('td'); td.append(a); tr.append(td);
        tb.append(tr);
      }
      $('cov-more').hidden = list.length <= shown;
    };
    prefSel.addEventListener('change', () => { shown = 50; draw(); });
    $('cov-kind').addEventListener('change', () => { shown = 50; draw(); });
    $('cov-more').addEventListener('click', () => { shown += 100; draw(); });
    draw();
  }
})();
