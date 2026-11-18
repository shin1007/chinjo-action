// 自治体ごとのデータ（公式サイト・電話・住所・議会の情報・行き方・受け付け方・意見と回答・要望の出し方）を、
// 選んだ都道府県の分だけ読み込む。ファイルは scripts/split-pref-data.js が data/pref/<番号>.js に書き出す。
// 全国分を一度に読むと重い（数百KB）ので、使う都道府県の分だけにしている。
// 読み込んだ分は window.SITES などに入るので、使う側は前と同じように window.SITES[pref] を見ればよい。
window.PrefData = (() => {
  const GLOBALS = ['SITES', 'TEL', 'OFFICES', 'ACCESS', 'COUNCILS', 'MAIL', 'KAITO', 'REQUEST_PAGES'];
  GLOBALS.forEach((g) => { window[g] = window[g] || {}; });
  window.INTAKE = window.INTAKE || { chinjo: {}, yobo: {} };

  const loaded = new Set();
  const pending = {};

  function put(pref, d) {
    ['SITES', 'TEL', 'OFFICES', 'ACCESS', 'COUNCILS', 'MAIL'].forEach((g) => { window[g][pref] = d[g]; });
    ['KAITO', 'REQUEST_PAGES'].forEach((g) => Object.assign(window[g], d[g]));
    Object.entries(d.INTAKE).forEach(([kind, rows]) => Object.assign(window.INTAKE[kind] = window.INTAKE[kind] || {}, rows));
    loaded.add(pref);
  }

  function one(pref) {
    if (loaded.has(pref)) return Promise.resolve();
    const i = window.PREFS.indexOf(pref);
    if (i < 0) return Promise.resolve();
    if (!pending[pref]) {
      pending[pref] = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = `/data/pref/${String(i + 1).padStart(2, '0')}.js`;
        // 読めなくても（電波が切れたなど）ページは動く。データがない議会と同じ出し方になる
        // 読めなかったときも、もう一度は取りに行かない（何度も読み直して画面が止まらないように）
        s.onload = s.onerror = () => { loaded.add(pref); delete pending[pref]; resolve(); };
        document.head.append(s);
      });
    }
    return pending[pref];
  }

  const has = (prefs) => prefs.filter(Boolean).every((p) => loaded.has(p));
  const load = (prefs) => Promise.all([...new Set(prefs.filter(Boolean))].map(one));
  const loadAll = () => load(window.PREFS);
  return { put, has, load, loadAll };
})();
