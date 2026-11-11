// 陳情項目と参考資料の一覧を、外部の AI にレビューを頼むための1つの Markdown にまとめる。
// 使い方：node scripts/export-ai.js を回したあとに node scripts/review-pack.js
// 出力：docs/外部レビュー用_陳情項目と参考資料.md
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'ai', 'petitions.json'), 'utf8'));
const sources = new Map(data.sources.map((s) => [s.id, s]));
const out = [];
const p = (s = '') => out.push(s);

const today = new Date().toISOString().slice(0, 10);
let itemCount = 0;
for (const t of data.themes) itemCount += t.items.length;

p('# 陳情項目と参考資料の一覧（外部レビュー用）');
p();
p(`作成日：${today}　項目数：${itemCount}　資料数：${data.sources.length}`);
p();
p('## このファイルについて');
p();
p('市民が地方議会や国に出す陳情・請願の文面を作るサイトの、陳情項目と、その理由を裏づける参考資料の一覧です。サイトでは、利用者が項目を選ぶと陳情書の文面ができ、各項目の「理由」と「参考資料」が添えられます。陳情書を読むのは自治体の議員・職員で、資料はその人たちを納得させるためのものです。');
p();
p('資料の選び方のきまり：');
p('- 事実・数字・条文は、できる限り一次資料（法令の原文、官公庁・自治体・裁判所・国際機関の公式資料、論文の原文）で確かめる。');
p('- 報道や解説サイトなどの二次資料は、信頼できるもの以外は使わない。使う場合は【二次資料】と印を付けている。');
p('- 海外の資料は、日本の制度を見直す参考例として使う。英語の資料の原文と訳は別のファイル（docs/英語の参考資料の訳.md）にある。');
p();
p('## お願いしたいこと');
p();
p('1. **資料の適切さ**：各項目の資料が、その項目の「理由」に書かれた事実や主張を本当に裏づけているか。数字・条文番号・題名・年の誤り、資料の読み違い、理由の言い過ぎ（資料が言っていないことを言っている）があれば、項目の id を挙げて指摘してください。');
p('2. **より良い資料**：議員・職員を納得させるのに、もっと強い資料（日本の法令・政府の統計や白書・国会の答弁書・他の自治体の先行例・査読のある論文・海外の公式資料）があれば、題名・発行元・年・URL を挙げてください。URL が不確かなときは、そう書いてください。');
p('3. **反対の資料**：項目の主張に反する、または弱める有力な資料があれば挙げてください。議員から反論されそうな点を先に知りたいためです。');
p('4. **足すべき陳情項目**：各テーマの目的に照らして、足すべき項目や、分けたりまとめたりしたほうがよい項目があれば、案と理由を挙げてください。');
p();
p('回答では、項目の id（例：l_shelter）を使ってください。');
p();

const scopeName = { national: '国（意見書の提出を求める）', local: '自治体' };
for (const t of data.themes) {
  p(`## テーマ：${t.name}（${t.id}）`);
  p();
  const purpose = (t.templates && (t.templates.purposeLocal || t.templates.purposeNational)) || '';
  if (purpose) {
    p(`目的：${purpose.replace(/\{宛先\}/g, '（宛先の自治体）').replace(/\{種類\}/g, '陳情')}`);
    p();
  }
  for (const it of t.items) {
    p(`### ${it.id}：${it.title || it.label}`);
    p();
    p(`- 宛先：${scopeName[it.scope] || it.scope}　分類：${it.category || ''}`);
    if (it.label && it.label !== it.title) p(`- 見出し：${it.label}`);
    p();
    p(`**求めること**：${(it.wording || '').replace(/\{宛先\}/g, '（宛先の自治体）')}`);
    p();
    p(`**理由**：${it.reason || ''}`);
    p();
    p('**参考資料**：');
    const refs = it.references || [];
    if (!refs.length) p('- （なし）');
    for (const r of refs) {
      const s = sources.get(r.sourceId) || {};
      const mark = s.kind === 'secondary' ? '【二次資料】' : '';
      const note = r.note || s.note;
      p(`- ${mark}${r.title || s.title}${s.url ? ` ${s.url}` : ''}${note ? `　— ${note}` : ''}`);
    }
    p();
  }
}

const file = path.join(root, 'docs', '外部レビュー用_陳情項目と参考資料.md');
fs.writeFileSync(file, out.join('\n'));
console.log(`${path.relative(root, file)} に ${itemCount} 項目・${data.sources.length} 資料を書きました`);
