// トップページの「言葉でさがす」：全テーマの陳情の内容を、言葉で横断してさがす（データは search-index.js）
(() => {
  const input = document.getElementById('itemSearch');
  const list = document.getElementById('itemSearchResults');
  const count = document.getElementById('itemSearchCount');
  if (!input || !window.SEARCH_INDEX) return;
  const MAX = 20;
  const ROUTE = { chinjo: '陳情向け', yobo: '要望向け', both: '陳情でも要望でも' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  // 全角・半角と、カタカナ・ひらがなの違いを無視して比べる
  const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const rows = window.SEARCH_INDEX.map((a) => ({ ...a, head: norm(`${a.label} ${a.category || ''} ${a.words || ''}`), body: norm(a.text) }));

  const allBtn = document.getElementById('itemListAll');
  let showAll = false;

  function render() {
    const words = norm(input.value).split(/\s+/).filter(Boolean);
    if (!words.length && showAll) return draw(rows, rows.length, `全部で${rows.length}件。押すと、その内容を選んだ状態で作成画面が開きます。`);
    if (!words.length) { list.innerHTML = ''; count.textContent = ''; return; }
    const hits = rows
      .filter((r) => words.every((w) => r.head.includes(w) || r.body.includes(w)))
      // 項目名・見出し・言い換えの語に入っているものを先に出す
      .map((r) => ({ r, score: words.filter((w) => r.head.includes(w)).length }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
    count.textContent = hits.length
      ? `${hits.length}件${hits.length > MAX ? `（はじめの${MAX}件を表示）` : ''}。押すと、その内容を選んだ状態で作成画面が開きます。`
      : '見つかりませんでした。言葉を短くするか、下のテーマから選んでください。';
    draw(hits, MAX, count.textContent);
  }

  function draw(hits, max, msg) {
    count.textContent = msg;
    // 同じテーマ・同じ見出しのものをまとめて出す（見出しの順は、当てはまりのよいものが先）
    const groups = new Map();
    hits.slice(0, max).forEach((a) => {
      const k = `${a.theme}	${a.category || 'そのほか'}`;
      if (!groups.has(k)) groups.set(k, { theme: a.theme, themeName: a.themeName, category: a.category || 'そのほか', list: [] });
      groups.get(k).list.push(a);
    });
    // テーマの切れ目ごとに ◀▶ を付けて、前後のテーマへ飛べるようにする
    const gs = [...groups.values()];
    const themes = [...new Set(gs.map((g) => g.theme))];
    const nav = (g, i) => {
      if (themes.length < 2 || (i > 0 && gs[i - 1].theme === g.theme)) return '';
      const t = themes.indexOf(g.theme);
      const btn = (to, mark, word) => (to >= 0 && to < themes.length
        ? `<button type="button" class="btn btn-small item-theme-jump" data-theme-to="${esc(themes[to])}" aria-label="${word}のテーマ（${esc(gs.find((x) => x.theme === themes[to]).themeName)}）へ">${mark}</button>`
        : `<span class="item-theme-jump" aria-hidden="true"></span>`);
      return `<li class="item-theme-nav" id="theme-${esc(g.theme)}">${btn(t - 1, '◀', '前')}<b>${esc(g.themeName)}</b>${btn(t + 1, '▶', '次')}</li>`;
    };
    list.innerHTML = gs.map((g, i) => `${nav(g, i)}<li class="item-search-group"><p class="item-search-head"><b>${esc(g.themeName)}／${esc(g.category)}</b>${g.list.length > 1 ? `<a class="btn btn-small" href="/${g.theme}/make?item=${encodeURIComponent(g.list.map((a) => a.id).join(','))}">この${g.list.length}件をすべて選んでつくる</a>` : ''}</p>
      <ul>${g.list.map((a) => `<li><a href="/${a.theme}/make?item=${encodeURIComponent(a.id)}"><b>${esc(a.label)}</b><small>${a.scope === 'local' ? '自治体の取り組み' : '国へ意見書'}</small><small>${ROUTE[a.route] || ''}</small></a></li>`).join('')}</ul></li>`).join('');
  }
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-to]');
    if (!b) return;
    const to = document.getElementById(`theme-${b.dataset.themeTo}`);
    if (!to) return;
    to.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const f = to.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  });
  input.addEventListener('input', render);
  if (allBtn) allBtn.addEventListener('click', () => {
    showAll = !showAll;
    allBtn.setAttribute('aria-expanded', String(showAll));
    allBtn.textContent = showAll ? '一覧を閉じる' : '陳情内容の一覧を見る';
    if (showAll) input.value = '';
    render();
  });
})();
