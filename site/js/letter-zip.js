// 議員への手紙：郵便番号から自治体を引き、その議会の議員を Google で調べるリンクを出す。
// 郵便番号の表は data/zip/<上3けた>.json（scripts/zip.js で作る）。入力はこの端末の中だけで使い、サーバーには送らない。
(() => {
  const input = document.getElementById('letterZip');
  const out = document.getElementById('letterZipHits');
  if (!input || !out) return;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const cache = {};
  const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const ASK = '議員一覧 所属政党（無所属なら支援している政党） 連絡先の住所 力を入れている政策 XなどのSNS';
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
      <a class="btn btn-small btn-primary" href="${g(`${name} ${ASK}`)}" target="_blank" rel="noopener noreferrer">Googleで議員を調べる ↗</a>
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
    out.innerHTML = `<ul class="zip-councils">${keys.map((k) => card(...k.split('/'))).join('')}${prefs.map((p) => card(p, '@')).join('')}</ul>
      <p class="hint-sm">Google の検索結果の上に出る AI の要約で、議員の一覧・所属政党・連絡先・力を入れている政策・SNS がまとめて分かることが多くあります。AI の答えは間違うことがあるので、送る前に議会の公式サイトの議員名簿で確かめてください。</p>`;
  }
  input.addEventListener('input', run);
  out.addEventListener('click', (e) => {
    const b = e.target.closest('[data-council]');
    if (!b) return;
    const f = document.querySelector('#letterForm input[name="council"]');
    if (f) { f.value = b.dataset.council; f.dispatchEvent(new Event('input', { bubbles: true })); }
  });
})();
