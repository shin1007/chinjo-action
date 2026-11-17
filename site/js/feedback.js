// ご意見・追加してほしい項目の受け付け（/feedback）。Supabase の feedback テーブルに書き込むだけ（anon は読めない）。
// 送るのは種類・テーマ・対象・本文・根拠 URL だけ。氏名・住所・連絡先の欄は持たない。
(() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  // supabase/schema.sql の feedback を Supabase に反映して動作を確かめたら true にする。
  // false の間は入力欄を出さず「準備中」と表示する（書き込みが失敗する欄を見せないため）
  const LIVE = true;
  // schema.sql の「grant insert (...) on public.feedback to anon」と同じ列だけを送る（test/feedback.test.js が突き合わせる）
  const FIELDS = ['kind', 'theme', 'target', 'body', 'source_url'];

  const form = document.getElementById('fb-form');
  const pending = document.getElementById('fb-pending');
  if (!form || !pending) return;
  if (!LIVE) return;
  pending.hidden = true;
  form.hidden = false;

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
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    msg.textContent = '送っています…';
    let ok = bot;
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
})();
