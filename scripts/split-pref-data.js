#!/usr/bin/env node
// 陳情書を作るページ（/<テーマ>/make）で、選んだ都道府県の分だけ読み込めるように、
// 自治体ごとのデータを都道府県ごとのファイル site/data/pref/<番号>.js に分けて書き出す。
// 番号は data/prefs.js の並び（北海道が 01）。読み込みは site/js/pref-data.js。
//
// 元のファイル（data/sites.js など）はそのまま残す。スクリプトやほかのページが使うため。
// 元のファイルを作り直したら、これも実行する：node scripts/split-pref-data.js
// （test/pref-data.test.js が、分けたファイルが元と合っているかを確かめる）
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'site', 'data');
const OUT = path.join(DATA, 'pref');

// 都道府県 → 市区町村 の形のもの
const NESTED = { SITES: 'sites.js', TEL: 'tel.js', OFFICES: 'offices.js', ACCESS: 'access.js', COUNCILS: 'councils.js' };
// "都道府県/市区町村" の鍵のもの
const FLAT = { KAITO: 'kaito.js', REQUEST_PAGES: 'request-pages.js' };

function load() {
  const window = {};
  for (const f of ['prefs.js', ...Object.values(NESTED), ...Object.values(FLAT), 'intake.js']) {
    new Function('window', fs.readFileSync(path.join(DATA, f), 'utf8'))(window);
  }
  return window;
}

const pad = (i) => String(i + 1).padStart(2, '0');

// 都道府県ごとの中身（書き出すものと、テストで比べるもの）
function build(w = load()) {
  const prefOf = (k) => k.slice(0, k.indexOf('/'));
  return w.PREFS.map((pref) => {
    const d = {};
    for (const g of Object.keys(NESTED)) d[g] = w[g][pref] || {};
    for (const g of Object.keys(FLAT)) d[g] = Object.fromEntries(Object.entries(w[g]).filter(([k]) => prefOf(k) === pref));
    d.INTAKE = Object.fromEntries(Object.entries(w.INTAKE).map(([kind, rows]) => [kind, Object.fromEntries(Object.entries(rows).filter(([k]) => prefOf(k) === pref))]));
    return [pref, d];
  });
}

// 都道府県を選ぶ前に出す「郵送でも審査される議会（全国）」には、議会ごとの情報のうち郵送についての一文だけが要る。
// その分だけを全国まとめて data/council-mail.js に書き出す（wizard.js の mailRule が見るのと同じ条件）
function councilMail(w = load()) {
  const out = {};
  for (const [pref, rows] of Object.entries(w.COUNCILS)) {
    for (const [key, r] of Object.entries(rows)) {
      const pick = Object.fromEntries(['yusoNote', 'outsideNote'].filter((f) => r[f] && /郵送/.test(r[f])).map((f) => [f, r[f]]));
      if (Object.keys(pick).length) (out[pref] = out[pref] || {})[key] = pick;
    }
  }
  return out;
}
const councilMailText = (d) => `// 自動で作ったファイル（node scripts/split-pref-data.js）。手で直さない
// data/councils.js のうち、郵送についての一文だけ（全国分）。陳情書をつくる画面で、都道府県を選ぶ前の一覧に使う
window.COUNCILS_MAIL = ${JSON.stringify(d)};
`;

const fileText = (pref, d) => `// 自動で作ったファイル（node scripts/split-pref-data.js）。手で直さない\nwindow.PrefData.put(${JSON.stringify(pref)},${JSON.stringify(d)});\n`;

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  build().forEach(([pref, d], i) => fs.writeFileSync(path.join(OUT, `${pad(i)}.js`), fileText(pref, d)));
  fs.writeFileSync(path.join(DATA, 'council-mail.js'), councilMailText(councilMail()));
  console.log(`${OUT} に47ファイルを書き出しました`);
}

module.exports = { build, fileText, pad, OUT, DATA, councilMail, councilMailText };
