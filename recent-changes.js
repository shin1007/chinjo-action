(() => {
  const box = document.getElementById('recent-changes');
  if (!box) return;
  const list = box.querySelector('ol');

  const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  (async () => {
    try {
      const response = await fetch('/api/recent-changes');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) throw new Error('no items');
      list.innerHTML = items.map((item) => `<li><time datetime="${esc(item.date)}">${esc(item.date.replace(/-/g, '/'))}</time> <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a></li>`).join('');
      box.hidden = false;
    } catch (error) {
      console.warn('最近の修正・変更を表示できませんでした。', error);
      box.hidden = true;
    }
  })();
})();
