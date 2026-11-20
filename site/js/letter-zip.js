// 議員への手紙：郵便番号から自治体を引き、その議会の議員を Google で調べるリンクを出す。
// 郵便番号の表は data/zip/<上3けた>.json（scripts/zip.js で作る）。入力はこの端末の中だけで使い、サーバーには送らない。
(() => {
  const input = document.getElementById('letterZip');
  const out = document.getElementById('letterZipHits');
  if (!input || !out) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const cache = {};
  // Google の AI モード（udm=50）に、表で答えてもらう頼み方で渡す。ふつうの検索の AI の要約は途中で切れることが多いため
  // （2026年11月20日に、世田谷区議会・奈義町議会・〒154-0017 の国会議員で試し、AI モードのほうが全員分の表と出典が出た）
  const ai = (q) => `https://www.google.com/search?udm=50&q=${encodeURIComponent(q)}`;
  const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const COLS = '列は、氏名・所属政党（無所属なら支援を受けている政党）・力を入れている政策・XなどのSNS・手紙の送り先。出典も付けて。';
  const askLocal = (name) => `${name}の現職の議員を全員、表で教えて。${COLS}`;
  const askDiet = (zip) => `郵便番号${zip.slice(0, 3)}-${zip.slice(3)}の地域の衆議院小選挙区と参議院選挙区で選ばれた現職の国会議員を、表で教えて。列は、氏名・衆参と選挙区・所属政党・力を入れている政策・XなどのSNS・手紙の送り先。出典も付けて。`;
  const site = (pref, muni) => {
    const s = (window.SITES || {})[pref] || {};
    const v = s[muni] || s[Object.keys(s).find((k) => k.replace(/^.+?郡/, '') === muni.replace(/^.+?郡/, ''))];
    return v && (v[2] || v[0]);
  };
  const council = (pref, muni) => (muni === '@' ? `${pref}議会` : `${pref}${muni.replace(/^.+?郡/, '')}議会`);
  const card = (pref, muni) => {
    const name = council(pref, muni);
    const off = site(pref, muni);
    return `<li><b>${esc(name)}</b>
      <a class="btn btn-small btn-primary" href="${ai(askLocal(name))}" target="_blank" rel="noopener noreferrer">GoogleのAIに議員の一覧を聞く ↗</a>
      <a class="btn btn-small" href="${g(`${name} 議員名簿`)}" target="_blank" rel="noopener noreferrer">ふつうに検索 ↗</a>
      ${off ? `<a class="btn btn-small" href="${esc(off)}" target="_blank" rel="noopener noreferrer">公式サイト ↗</a>` : ''}
      <button type="button" class="btn btn-small" data-council="${esc(name)}">宛先の議会名に入れる</button></li>`;
  };
  async function run() {
    const zip = input.value.normalize('NFKC').replace(/\D/g, '');
    if (zip.length < 7) { out.innerHTML = zip ? '<p class="hint-sm">郵便番号は7けたで入れてください（例：100-0001）。</p>' : ''; return; }
    const head = zip.slice(0, 3);
    cache[head] ||= fetch(`/data/zip/${head}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const v = (await cache[head])[zip.slice(3)];
    if (!v) { out.innerHTML = '<p class="hint-sm">この郵便番号に当てはまる自治体が見つかりません。郵便番号をお確かめください。</p>'; return; }
    const keys = v.split('|');
    const prefs = [...new Set(keys.map((k) => k.split('/')[0]))];
    out.innerHTML = `<ul class="zip-councils">${keys.map((k) => card(...k.split('/'))).join('')}${prefs.map((p) => card(p, '@')).join('')}
      <li><b>国会議員（あなたの地域の衆議院・参議院）</b>
      <a class="btn btn-small btn-primary" href="${ai(askDiet(zip))}" target="_blank" rel="noopener noreferrer">GoogleのAIに議員の一覧を聞く ↗</a></li></ul>
      <p class="hint-sm">「GoogleのAIに聞く」を押すと、Google の AI モードが、議員の一覧・所属政党・連絡先・力を入れている政策・SNS を表にまとめて答えます（Google にログインしていないと AI モードが使えないことがあります。そのときは「ふつうに検索」を）。手紙の送り先は、多くの議員が議会事務局あて（「○○議員 様」と書く）です。AI の答えは間違うことがあるので、送る前に議会の公式サイトの議員名簿で確かめてください。</p>`;
  }
  input.addEventListener('input', run);
  out.addEventListener('click', (e) => {
    const b = e.target.closest('[data-council]');
    if (!b) return;
    const f = document.querySelector('#letterForm input[name="council"]');
    if (f) { f.value = b.dataset.council; f.dispatchEvent(new Event('input', { bubbles: true })); }
  });
})();
