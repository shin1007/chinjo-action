(() => {
  const feeds = document.querySelectorAll('.pubcom-feed');
  if (!feeds.length) return;

  const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  const render = (feed, items) => {
    if (!items.length) {
      feed.innerHTML = '<p class="pubcom-empty">現在、強く関連する募集中案件はありません。下の一覧から探してみてください。</p>';
      return;
    }
    feed.innerHTML = `<p class="pubcom-label">今コメントできる案件</p><ul class="pubcom-results">${
      items.map((item) => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>${
        item.deadline || item.agency
          ? `<small>${item.deadline ? `締切：${esc(item.deadline)}` : ''}${item.deadline && item.agency ? ' ／ ' : ''}${item.agency ? `所管：${esc(item.agency)}` : ''}</small>`
          : ''
      }</li>`).join('')
    }</ul>`;
  };

  feeds.forEach(async (feed) => {
    const keywords = feed.dataset.keywords || '';
    try {
      const response = await fetch(`/api/public-comments?keywords=${encodeURIComponent(keywords)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      render(feed, Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.warn('関連するパブリックコメントを表示できませんでした。', error);
      feed.hidden = true;
    }
  });
})();
