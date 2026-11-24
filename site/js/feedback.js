// ご意見・質問（/feedback）。送るのは feedback テーブルへの書き込みだけ（anon は読めない）。
// 寄せられたご意見と答えは、運営が載せると決めたもの（feedback_public ビュー）だけを読む。
// 送るのは種類・テーマ・対象・本文・根拠 URL だけ。氏名・住所・連絡先の欄は持たない。
(() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  const THEMES = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への参加', kenko: '国民の健康', sonota: 'その他の陳情' };
  // supabase/schema.sql の feedback・feedback_public を Supabase に反映して動作を確かめたら true にする。
  // false の間は入力欄を出さず「準備中」と表示する（書き込みが失敗する欄を見せないため）
  const LIVE = true;
  // schema.sql の「grant insert (...) on public.feedback to anon」と同じ列だけを送る（test/feedback.test.js が突き合わせる）
  const FIELDS = ['kind', 'theme', 'target', 'body', 'source_url', 'file_path'];
  // 資料のファイルを添える欄。schema.sql の feedback.file_path 列と Storage の sources バケットを反映して確かめたら true にする
  const FILES_LIVE = true;
  const FILE_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
  const FILE_MAX = 10 * 1024 * 1024;

  if (LIVE) showAnswers();

  const form = document.getElementById('fb-form');
  const pending = document.getElementById('fb-pending');
  if (!form || !pending) return;
  if (!LIVE) return;
  pending.hidden = true;
  form.hidden = false;
  if (FILES_LIVE) {
    document.getElementById('fb-file-pending').hidden = true;
    document.getElementById('fb-file-label').hidden = false;
  }

  // /coverage などから ?kind=…&target=… で開いたときは、その値を入れておく
  const q = new URLSearchParams(location.search);
  for (const k of ['kind', 'target']) {
    const v = q.get(k);
    const input = form.elements[k];
    if (v && input && (input.tagName !== 'SELECT' || [...input.options].some((o) => o.value === v))) input.value = v.slice(0, 100);
  }

  // 「調査中」の横のリンクなどから ?quick=1&kind=…&target=…&ask=… で開いたときは、種類・テーマ・対象を自動で入れ、
  // 利用者には「分かったこと（URL）」だけを入れてもらう（選ぶ欄は隠す）。送る中身は同じ（FIELDS のとおり）
  const ask = (q.get('ask') || '').slice(0, 120);
  if (q.get('quick') === '1' && form.elements.kind.value && form.elements.target.value) {
    for (const n of ['kind', 'theme', 'target']) { const l = form.elements[n].closest('label'); if (l) l.hidden = true; }
    const body = form.elements.body;
    const target = form.elements.target.value;
    if (!body.value) body.value = `（自動入力）${target}について。分かったことは下の欄に書きました。`;
    body.closest('label').firstChild.textContent = '補足（なくても送れます。分かったことの説明など）';
    const note = document.createElement('p');
    note.className = 'notice';
    note.innerHTML = '<strong>調査にご協力ください。</strong> ';
    note.append(`${target}：${ask || '分かったことを教えてください'}。種類と対象は自動で入れました。下の URL の欄に、公式のページの URL を貼るだけで送れます。`);
    form.prepend(note);
    const src = form.elements.source_url;
    if (q.get('need') !== 'text') src.required = true;
    src.focus();
  }

  const msg = document.getElementById('fb-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    // 人には見えない欄に何か入っていたら機械の送信とみなし、送ったふりだけする
    const bot = !!data.get('website');
    const fields = {};
    for (const k of FIELDS) {
      const v = String(data.get(k) || '').trim();
      if (v) fields[k] = v;
    }
    if (!fields.body || fields.body.length < 5) { msg.textContent = '内容を5字以上で入れてください。'; return; }
    const file = FILES_LIVE ? data.get('file') : null;
    const hasFile = file && file.size > 0;
    if (hasFile && !FILE_TYPES[file.type]) { msg.textContent = 'ファイルは PDF・JPEG・PNG にしてください。'; return; }
    if (hasFile && file.size > FILE_MAX) { msg.textContent = 'ファイルは10MBまでにしてください。'; return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    msg.textContent = '送っています…';
    let ok = bot;
    if (!bot && hasFile) {
      const name = `${crypto.randomUUID()}.${FILE_TYPES[file.type]}`;
      msg.textContent = 'ファイルを送っています…';
      const up = await fetch(`${URL}/storage/v1/object/sources/${name}`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': file.type },
        body: file,
      }).catch(() => null);
      if (!up || !up.ok) {
        msg.textContent = 'ファイルを送れませんでした。時間をおいて、もう一度押してください。';
        button.disabled = false;
        return;
      }
      fields.file_path = name;
    }
    if (!bot) {
      const r = await fetch(`${URL}/rest/v1/feedback`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(fields),
      }).catch(() => null);
      ok = !!(r && r.ok);
    }
    msg.textContent = ok
      ? '✓ 送信しました。ありがとうございます。運営が一次資料で確かめてから、反映するかを決めます。'
      : '送れませんでした。時間をおいて、もう一度押してください。';
    button.disabled = ok;
    if (ok) form.querySelectorAll('input, textarea, select').forEach((el) => { el.disabled = true; });
  });

  function showAnswers() {
    const boardPending = document.getElementById('board-pending');
    const list = document.getElementById('board-list');
    const empty = document.getElementById('board-empty');
    if (!boardPending || !list) return;

    (async () => {
      try {
        const r = await fetch(`${URL}/rest/v1/feedback_public?select=id,day,theme,public_text&order=day.desc&limit=50`, { headers: { apikey: KEY } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const rows = await r.json();
        boardPending.hidden = true;
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
  }
})();
