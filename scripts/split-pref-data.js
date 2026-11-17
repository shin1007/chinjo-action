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
const NESTED = { SITES: 'sites.js', TEL: 'tel.js', OFFICES: 'offices.js', ACCESS: 'access.js' };
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

const fileText = (pref, d) => `// 自動で作ったファイル（node scripts/split-pref-data.js）。手で直さない\nwindow.PrefData.put(${JSON.stringify(pref)},${JSON.stringify(d)});\n`;

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  build().forEach(([pref, d], i) => fs.writeFileSync(path.join(OUT, `${pad(i)}.js`), fileText(pref, d)));
  console.log(`${OUT} に47ファイルを書き出しました`);
}

module.exports = { build, fileText, pad, OUT };
