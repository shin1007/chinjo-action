// トップページの「言葉でさがす」：全テーマの陳情の内容を、言葉で横断してさがす（データは search-index.js）
(() => {
  const input = document.getElementById('itemSearch');
  const list = document.getElementById('itemSearchResults');
  const count = document.getElementById('itemSearchCount');
  if (!input || !window.SEARCH_INDEX) return;
  const MAX = 20;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  // 全角・半角と、カタカナ・ひらがなの違いを無視して比べる
  const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const rows = window.SEARCH_INDEX.map((a) => ({ ...a, head: norm(`${a.label} ${a.category || ''}`), body: norm(a.text) }));

  function render() {
    const words = norm(input.value).split(/\s+/).filter(Boolean);
    if (!words.length) { list.innerHTML = ''; count.textContent = ''; return; }
    const hits = rows
      .filter((r) => words.every((w) => r.head.includes(w) || r.body.includes(w)))
      // 項目名や見出しに入っているものを先に出す
      .map((r) => ({ r, score: words.filter((w) => r.head.includes(w)).length }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
    count.textContent = hits.length
      ? `${hits.length}件${hits.length > MAX ? `（はじめの${MAX}件を表示）` : ''}。押すと、その内容を選んだ状態で作成画面が開きます。`
      : '見つかりませんでした。言葉を短くするか、下のテーマから選んでください。';
    list.innerHTML = hits.slice(0, MAX).map((a) => `<li><a href="/${a.theme}/make?item=${encodeURIComponent(a.id)}"><b>${esc(a.label)}</b><small>${esc(a.themeName)}／${esc(a.category || 'そのほか')}・${a.scope === 'local' ? '自治体の取り組み' : '国へ意見書'}</small></a></li>`).join('');
  }
  input.addEventListener('input', render);
})();
