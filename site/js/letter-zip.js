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
  // 議員名簿の公式のページ（scripts/roster-find.js で探したもの）
  let roster;
  const loadRoster = () => (roster ||= fetch('/data/roster.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  // 議員の名前（scripts/roster-names.js で公式の名簿から抜き出したもの）。都道府県ごとのファイル
  const namesCache = {};
  const loadNames = (pref) => (namesCache[pref] ||= fetch(`/data/roster/${encodeURIComponent(pref)}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  const list = (name, n) => {
    if (!n || !n.names || !n.names.length) return '';
    const [y, m, d] = n.checked_at.split('-').map(Number);
    return `<details class="zip-names"><summary>議員の名前（${n.names.length}人・${y}年${m}月${d}日に公式の名簿から）</summary>
      <p class="hint-sm">押すと、宛先の議会名と議員名に入ります。名前は名簿のページから機械で抜き出したもので、抜けや誤りがあることもあります。送る前に<a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">名簿のページ</a>で確かめてください。</p>
      <p>${n.names.map((x) => `<button type="button" class="btn btn-small" data-council="${esc(name)}" data-member="${esc(x)}">${esc(x)}</button>`).join(' ')}</p></details>`;
  };
  // 調査中の欄から、ご意見のページを「根拠になる資料を知らせたい」・対象の議会名つきで開く
  const fb = (name, what) => window.Common.askUrl(`${name}の${what}`, `${what}の URL を教えてください`);
  const card = (pref, muni, ros, nm) => {
    const name = council(pref, muni);
    const off = site(pref, muni);
    const meibo = (ros[`${pref}/${muni}`] || {}).url;
    return `<li><b>${esc(name)}</b>
      <a class="btn btn-small btn-primary" href="${ai(askLocal(name))}" target="_blank" rel="noopener noreferrer">GoogleのAIに議員の一覧を聞く ↗</a>
      ${meibo ? `<a class="btn btn-small" href="${esc(meibo)}" target="_blank" rel="noopener noreferrer">議員名簿（公式）↗</a>` : `<span class="hint-sm">議員名簿（公式）のボタン：調査中（公式のページを探しています）。ご存じの方は<a href="${fb(name, '議員名簿の公式ページ')}" target="_blank" rel="noopener noreferrer">ご意見で URL を教えてください</a></span>`}
      <a class="btn btn-small" href="${g(`${name} 議員名簿`)}" target="_blank" rel="noopener noreferrer">ふつうに検索 ↗</a>
      ${off ? `<a class="btn btn-small" href="${esc(off)}" target="_blank" rel="noopener noreferrer">公式サイト ↗</a>` : ''}
      <button type="button" class="btn btn-small" data-council="${esc(name)}">宛先の議会名に入れる</button>
      ${list(name, (nm[pref] || {})[`${pref}/${muni}`]) || (meibo ? `<p class="hint-sm">議員の名前を押して宛先に入れる機能：調査中（名簿の書き方が読み取れていません。公式の名簿を見て、議員名は手で入れてください）。<a href="${fb(name, '議員名簿のページ（名前を取り込めていません）')}" target="_blank" rel="noopener noreferrer">名簿の見方が分かるときは、ご意見で教えてください</a></p>` : '')}</li>`;
  };
  async function run() {
    const zip = input.value.normalize('NFKC').replace(/\D/g, '');
    if (zip.length < 7) { out.innerHTML = zip ? '<p class="hint-sm">郵便番号は7けたで入れてください（例：100-0001）。</p>' : ''; return; }
    const head = zip.slice(0, 3);
    cache[head] ||= fetch(`/data/zip/${head}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const v = (await cache[head])[zip.slice(3)];
    if (!v) { out.innerHTML = '<p class="hint-sm">この郵便番号に当てはまる自治体が見つかりません。郵便番号をお確かめください。</p>'; return; }
    const keys = v.split('|');
    const ros = await loadRoster();
    const nm = {};
    await Promise.all([...new Set(keys.map((k) => k.split('/')[0]))].map(async (p) => { nm[p] = await loadNames(p); }));
    const prefs = [...new Set(keys.map((k) => k.split('/')[0]))];
    out.innerHTML = `<ul class="zip-councils">${keys.map((k) => card(...k.split('/'), ros, nm)).join('')}${prefs.map((p) => card(p, '@', ros, nm)).join('')}
      <li><b>国会議員（あなたの地域の衆議院・参議院）</b>
      <a class="btn btn-small btn-primary" href="${ai(askDiet(zip))}" target="_blank" rel="noopener noreferrer">GoogleのAIに議員の一覧を聞く ↗</a></li></ul>
      <p class="hint-sm">「GoogleのAIに聞く」を押すと、Google の AI モードが、議員の一覧・所属政党・連絡先・力を入れている政策・SNS を表にまとめて答えます（Google にログインしていないと AI モードが使えないことがあります。そのときは「ふつうに検索」を）。手紙の送り先は、多くの議員が議会事務局あて（「○○議員 様」と書く）です。AI の答えは間違うことがあるので、送る前に「議員名簿（公式）」（見つかっている議会だけ出ます）か、議会の公式サイトで確かめてください。</p>`;
  }
  input.addEventListener('input', run);
  out.addEventListener('click', (e) => {
    const b = e.target.closest('[data-council]');
    if (!b) return;
    const f = document.querySelector('#letterForm input[name="council"]');
    if (f) { f.value = b.dataset.council; f.dispatchEvent(new Event('input', { bubbles: true })); }
    const mb = document.querySelector('#letterForm input[name="member"]');
    if (mb && b.dataset.member) { mb.value = b.dataset.member; mb.dispatchEvent(new Event('input', { bubbles: true })); }
  });
})();
