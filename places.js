// 提出先になる自治体の一覧（都道府県そのものと、その中の市区町村）。どのページもここから議会名を作る。
// 町村は「○○郡」を外して議会名にする（小郡市のような市名は対象外）
window.Places = (() => {
  const cache = {};
  // { pref, key：data/offices.js などの鍵（都道府県は "@"、町村は郡名つき）, gun, name, council, isPref }
  function of(pref) {
    if (cache[pref]) return cache[pref];
    return (cache[pref] = [
      { pref, key: '@', gun: '', name: pref, council: pref + '議会', isPref: true },
      ...(window.MUNICIPALITIES[pref] || []).map((m) => {
        const g = m.match(/^(.+?郡)(.+[町村])$/);
        const name = g ? g[2] : m;
        return { pref, key: m, gun: g ? g[1] : '', name, council: name + '議会', isPref: false };
      }),
    ]);
  }
  const all = () => window.PREFS.flatMap(of);

  // 議会事務局の〒と住所。議会のページから読み取ったもの（data/councils.js）があればそれを、なければ本庁舎（data/offices.js）を使う
  function office(pref, key) {
    const c = ((window.COUNCILS || {})[pref] || {})[key];
    if (c && c.office) return { zip: c.office[0] || '', address: c.office[1] || '', main: false };
    const o = ((window.OFFICES || {})[pref] || {})[key];
    return o ? { zip: o[0] || '', address: o[1] || '', main: true } : { zip: '', address: '', main: true };
  }
  return { of, all, office };
})();
