#!/usr/bin/env node
// 議員の名前の「候補」を、選挙管理委員会の選挙結果（開票結果・選挙の記録）から集める。
//   node scripts/roster-candidates-election.js   … scripts/roster-candidates/election.json を作り直す
// 選挙結果には落選した人も、その後に辞めた人も載っている。そのため、ここで集めた名前はそのままは使わない。
// scripts/roster-names.js が、議会の名簿のページ（一次資料）に書いてある名前だけを使う（議会中継の候補と同じ扱い）。
// 調べる選挙結果は下の ELECTION に、公式の選挙管理委員会のページだけを書く。
'use strict';
const fs = require('fs');
const path = require('path');
const { html, extract } = require('./roster-names.js');

const OUT = path.join(__dirname, 'roster-candidates', 'election.json');
const ELECTION = {
  '千葉県/船橋市': [
    'https://www.city.funabashi.lg.jp/shisei/senkyo/007/p114955.html', // 令和5年 一般選挙
    'https://www.city.funabashi.lg.jp/shisei/senkyo/007/p137784.html', // 令和7年 補欠選挙
  ],
  '長崎県/長崎市': ['https://www.city.nagasaki.lg.jp/page/5927.html'], // 令和5年 一般選挙
};

// PDF の文字から「姓 名」「姓名」の形のものを広く拾う（落選者・ほかの言葉が混じってもよい。名簿で確かめるので）
function loose(text) {
  const out = new Set();
  for (const m of text.matchAll(/(?:^|[\s|｜　])([一-龥々ヶぁ-んァ-ヶー]{1,5})[ 　]{1,2}([一-龥々ヶぁ-んァ-ヶー]{1,6})(?=$|[\s|｜　])/gm)) out.add(`${m[1]} ${m[2]}`);
  for (const m of text.matchAll(/(?:^|[\s|｜　])([一-龥々ヶ]{3,6})(?=$|[\s|｜　])/gm)) out.add(m[1]);
  return [...out];
}

async function main() {
  const found = {};
  for (const [id, urls] of Object.entries(ELECTION)) {
    const names = new Set();
    for (const u of urls) {
      const p = await html(u);
      if (p.html) for (const n of [...extract(p.html, 1).names, ...loose(p.html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '))]) names.add(n);
      else if (p.text) for (const n of loose(p.text)) names.add(n);
      else console.error(`開けない：${u}（${p.error}）`);
    }
    found[id] = { source: urls, names: [...names] };
    console.error(`${id}：${names.size}`);
  }
  fs.writeFileSync(OUT, JSON.stringify({ source: '選挙管理委員会の選挙結果', fetched_at: new Date().toISOString().slice(0, 10), councils: found }, null, 0).replace(/,"(?=[^"]+\/[^"]*":\{)/g, ',\n"') + '\n');
}
main();
