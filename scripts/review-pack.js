// 陳情項目・参考資料・陳情書の文面を、外部の AI にレビューを頼むためのフォルダにまとめる。
// 使い方：node scripts/review-pack.js（themes/*/ を直接読む）
// 出力：docs/外部レビュー/
//   README.md                 … 全体の説明と渡し方
//   Grokへのプロンプト.md     … 貼り付けて使う依頼文
//   <テーマ>/項目と参考資料.md … 項目ごとの求めること・理由・資料
//   <テーマ>/陳情書の文面.md   … サイトが作る陳情書の文面（1項目1通）
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', '外部レビュー');
const fill = (s, v) => String(s || '').replace(/\{(内容|種類|宛先)\}/g, (_, k) => v[k]);

function loadTheme(id) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['theme.js', 'template.js', 'asks-national.js', 'asks-local.js']) {
    const p = path.join(root, 'themes', id, f);
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
  }
  const w = ctx.window;
  const asks = Array.isArray(w.ASKS) ? w.ASKS : Object.values(w.ASKS || {}).flat();
  return { id, theme: w.THEME || {}, template: w.TEMPLATE || {}, asks };
}

const themeIds = fs.readdirSync(path.join(root, 'themes'))
  .filter((d) => fs.existsSync(path.join(root, 'themes', d, 'template.js')));
const themes = themeIds.map(loadTheme);
const themeName = (t) => t.theme.name || t.theme.title || t.id;

// サイトの petition.js の buildText と同じ並びで、1項目1通の陳情書の文面を作る
function petitionText(t, it) {
  const nat = it.scope === 'national';
  const T = { ...t.template, ...(it.template || {}) };
  const v = { 内容: it.title, 種類: '陳情', 宛先: '○○市' };
  const L = ['令和　年　月　日', '', '○○市議会議長　　　　様', '', '住所　　　　　', '氏名　　　　　　　　印', ''];
  L.push(`件名　${fill(nat ? T.subjectNational : T.subjectLocal, v)}`, '');
  L.push('【陳情の趣旨】', `　${fill(nat ? T.purposeNational : T.purposeLocal, v)}`, '', '記', '');
  L.push(`一　${fill(it.text, v)}`, '', '【陳情の理由】', `1．${it.title}`, `　${it.reason}`, '', `　${T.closing}`);
  if ((it.refs || []).length) {
    L.push('', '【参考資料】');
    it.refs.forEach((r, i) => L.push(`${i + 1}　${r.t}${r.url ? `\n　　${r.url}` : ''}`));
  }
  if (nat && T.ikenshoTo) L.push('', '【意見書の提出先（案）】', T.ikenshoTo);
  L.push('', '以上');
  return L.join('\n');
}

const scopeName = { national: '国（議会から国へ意見書の提出を求める陳情）', local: '自治体（その自治体が自ら行う施策を求める陳情）' };
const today = new Date().toISOString().slice(0, 10);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const summary = [];
for (const t of themes) {
  const dir = path.join(outDir, themeName(t));
  fs.mkdirSync(dir, { recursive: true });
  const purpose = fill(t.template.purposeLocal, { 宛先: '（宛先の自治体）', 種類: '陳情' });
  const nRefs = t.asks.reduce((n, it) => n + (it.refs || []).length, 0);
  summary.push({ name: themeName(t), id: t.id, items: t.asks.length, refs: nRefs });

  const A = [`# ${themeName(t)}：陳情項目と参考資料`, '', `作成日：${today}　項目数：${t.asks.length}　参考資料：${nRefs}件（項目をまたぐ重複を含む）`, '',
    `テーマの目的：${purpose}`, '', `結びの文：${t.template.closing || ''}`, '',
    '資料の印：【二次資料】＝報道・解説など一次資料でないもの。印のないものは法令・公式資料・論文。', ''];
  for (const it of t.asks) {
    A.push(`## ${it.id}：${it.title}`, '', `- 宛先：${scopeName[it.scope] || it.scope}`, `- 分類：${it.category || ''}`);
    if (it.label && it.label !== it.title) A.push(`- 見出し：${it.label}`);
    A.push('', `**求めること**：${fill(it.text, { 宛先: '（宛先の自治体）' })}`, '', `**理由**：${it.reason}`, '', '**参考資料**：');
    if (!(it.refs || []).length) A.push('- （なし）');
    for (const r of it.refs || []) A.push(`- ${r.secondary ? '【二次資料】' : ''}${r.t}${r.url ? ` ${r.url}` : ''}${r.note ? `　— ${r.note}` : ''}`);
    A.push('');
  }
  fs.writeFileSync(path.join(dir, '項目と参考資料.md'), A.join('\n'));

  const B = [`# ${themeName(t)}：陳情書の文面`, '', 'サイトが利用者に出す陳情書の文面です。サイトの方針で、1通に1つの事項だけを書きます。宛先の議会・氏名は「○○」や空欄にしています。', ''];
  for (const it of t.asks) B.push(`## ${it.id}：${it.title}`, '', '```text', petitionText(t, it), '```', '');
  fs.writeFileSync(path.join(dir, '陳情書の文面.md'), B.join('\n'));
}

const R = ['# 外部レビュー用の資料', '', `作成日：${today}`, '',
  '市民が地方議会に出す陳情書の文面を作るサイト（陳情アクション）の、陳情項目・参考資料・陳情書の文面を、テーマごとのフォルダに分けたものです。外部の AI に、資料の適切さ・より良い資料・足すべき項目を見てもらうために作りました。', '',
  '## フォルダ', '', '| テーマ | フォルダ | 項目数 | 参考資料 |', '|---|---|---|---|',
  ...summary.map((s) => `| ${s.name}（${s.id}） | ${s.name}/ | ${s.items} | ${s.refs} |`), '',
  '各フォルダの中身：', '- `項目と参考資料.md`：項目ごとの求めること・理由・参考資料（題名・URL・根拠にした所）', '- `陳情書の文面.md`：サイトが作る陳情書の文面（1項目1通）', '',
  '英語の資料の原文と訳は `docs/英語の参考資料の訳.md`、原文を確かめられなかった資料は `docs/一次資料に当たれていない資料.md` にあります。', '',
  '## 渡し方', '', '1. `Grokへのプロンプト.md` の依頼文を貼る。', '2. テーマを1つ選び、そのフォルダの `項目と参考資料.md` と `陳情書の文面.md` を添付する（1回に1テーマ）。', '3. 英語の資料の読み違いも見てもらうなら、`docs/英語の参考資料の訳.md` も添える。', '',
  '作り直すとき：`node scripts/review-pack.js`'];
fs.writeFileSync(path.join(outDir, 'README.md'), R.join('\n'));

fs.copyFileSync(path.join(__dirname, 'review-prompt-grok.md'), path.join(outDir, 'Grokへのプロンプト.md'));
console.log(`docs/外部レビュー/ に ${themes.length} テーマ・${summary.reduce((n, s) => n + s.items, 0)} 項目を書きました`);
