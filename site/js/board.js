// 質問と答えの掲示板（/feedback#board）。運営が載せると決めたもの（feedback_public ビュー）だけを読む。書き込みはしない。
(() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  // supabase/schema.sql の feedback と feedback_public を Supabase に反映して確かめたら true にする。false の間は「準備中」と表示する
  const LIVE = true;
  const THEMES = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への参加', kenko: '国民の健康', sonota: 'その他の陳情' };

  const pending = document.getElementById('board-pending');
  const list = document.getElementById('board-list');
  const empty = document.getElementById('board-empty');
  if (!pending || !list || !LIVE) return;

  (async () => {
    try {
      const r = await fetch(`${URL}/rest/v1/feedback_public?select=id,day,theme,public_text&order=day.desc&limit=50`, { headers: { apikey: KEY } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = await r.json();
      pending.hidden = true;
      if (!rows.length) { empty.hidden = false; return; }
      for (const row of rows) {
        const li = document.createElement('li');
        const meta = document.createElement('p');
        meta.className = 'small';
        meta.textContent = `${String(row.day).replace(/-/g, '/')}${row.theme && THEMES[row.theme] ? `　${THEMES[row.theme]}` : ''}`;
        const text = document.createElement('p');
        text.textContent = row.public_text;
        li.append(meta, text);
        list.appendChild(li);
      }
      list.hidden = false;
    } catch (error) {
      console.warn('掲示板を読み込めませんでした。', error);
    }
  })();
})();
