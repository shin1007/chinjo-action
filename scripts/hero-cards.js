// トップのヒーローの背景に流す、陳情の内容のカード（飾り）を index.html に書き込む。
//   node scripts/hero-cards.js
// 各テーマの asks-*.js の label から作る。内容を足したら作り直す。
const fs = require('fs');
const path = require('path');
const SITE = path.join(__dirname, '..', 'site');
const THEMES = [['kodomo', '子どもの権利'], ['dansei', '男女平等'], ['nihonjin', '日本人の権利'],
  ['shiho', '司法への参加'], ['kenko', '国民の健康'], ['sonota', 'その他の陳情']];
const PER = 6;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = THEMES.map(([key, name]) => {
  const src = ['asks-national.js', 'asks-local.js']
    .map((f) => path.join(SITE, 'themes', key, f)).filter(fs.existsSync)
    .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  return [...src.matchAll(/label:\s*'([^']+)'/g)].slice(0, PER)
    .map((m) => [name, m[1].replace(/（[^）]*）/g, '')]);
});
// テーマが交互に並ぶようにして、2列に分ける
const mixed = [];
for (let i = 0; i < PER; i++) cards.forEach((c) => c[i] && mixed.push(c[i]));
const rows = [mixed.filter((_, i) => i % 2 === 0), mixed.filter((_, i) => i % 2 === 1)];
const row = (list) => {
  const one = list.map(([t, l]) => `<li><span>${esc(t)}</span>${esc(l)}</li>`).join('');
  return `<ul class="hero-flow-row">${one}${one}</ul>`; // 2回並べて切れ目なく流す
};
const html = `<!-- hero-cards:start（scripts/hero-cards.js で作る） -->
  <div class="hero-flow" aria-hidden="true">${rows.map(row).join('')}</div>
  <!-- hero-cards:end -->`;
const file = path.join(SITE, 'index.html');
const s = fs.readFileSync(file, 'utf8');
const re = /<!-- hero-cards:start[\s\S]*?<!-- hero-cards:end -->/;
fs.writeFileSync(file, re.test(s) ? s.replace(re, html)
  : s.replace('<section class="hero">', `<section class="hero">\n  ${html}`));
console.log(mixed.length, 'cards');
