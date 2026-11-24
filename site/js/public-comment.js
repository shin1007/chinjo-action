(() => {
  // 作成画面（#wzPubcom）には、テーマの語（THEME.pubcomKeywords）で絞った国の募集中の案件を出す
  const own = document.getElementById('wzPubcom');
  if (own && window.THEME && Array.isArray(window.THEME.pubcomKeywords)) {
    own.dataset.keywords = window.THEME.pubcomKeywords.join(',');
    own.hidden = false;
  }
  const feeds = document.querySelectorAll('.pubcom-feed:not([hidden])');
  if (!feeds.length) return;

  const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  const render = (feed, items) => {
    if (!items.length) {
      feed.innerHTML = '<p class="pubcom-empty">いま、このテーマに関係する国の募集中の意見募集は見つかりませんでした。<a href="https://public-comment.e-gov.go.jp/" target="_blank" rel="noopener">e-Govの意見募集の一覧</a>で探せます。</p>';
      return;
    }
    feed.innerHTML = `<p class="pubcom-label">いま意見を出せる、国の意見募集（e-Gov。テーマの語で自動で絞っているので、関係の薄いものも出ます）</p><ul class="pubcom-results">${
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
