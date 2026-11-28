#!/usr/bin/env node
// X に投稿した予定の、24時間後の数字を聞いて docs/調査/X投稿の記録.csv に1行足し、公開する。毎朝のメニューの n から呼ぶ。
//   node scripts/post-stats.js          … 済み（[x]）で、まだ記録のない投稿について、古い順に聞く
//   node scripts/post-stats.js --no-publish
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { parse } = require('./schedule-to-ics.js');
const { publish } = require('./post-done.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', '投稿予定');
const CSV = path.join(ROOT, 'docs', '調査', 'X投稿の記録.csv');
const pad = (n) => String(n).padStart(2, '0');
const stamp = (e) => `${e.year}-${pad(e.month)}-${pad(e.day)} ${pad(e.hour)}:${pad(e.min)}`;
const slot = (h) => (h < 10 ? '朝' : h < 15 ? '昼' : h < 19 ? '夕方' : '夜');
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// 済みで、記録の CSV にまだない投稿（古い順）
function pending(events, csvText) {
  const have = new Set(csvText.split(/\r?\n/).slice(1).map((l) => l.split(',')[0]));
  return events.filter((e) => e.done && !have.has(stamp(e))).sort((a, b) => stamp(a).localeCompare(stamp(b)));
}

// 1行を作る（見出しの順：投稿日時,時間帯,型,テーマ,項目id,本数(その日),24時間後の表示回数,いいね,返信,リンクのクリック,プロフィールのクリック,フォローの増減,メモ）
function row(e, events, n) {
  const sameDay = events.filter((x) => x.done && x.month === e.month && x.day === e.day).length;
  const theme = (e.link.match(/\/(kodomo|dansei|nihonjin|shiho|kenko|sonota)\//) || [])[1] || '';
  return [stamp(e), slot(e.hour), e.type, theme, '', sameDay, n.views, n.likes, n.replies, n.links, n.profile, n.follow, n.memo].map(csvCell).join(',');
}

async function main() {
  let events = [];
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.md') && /\d{4}/.test(n))) {
    events = events.concat(parse(fs.readFileSync(path.join(DIR, f), 'utf8').split(String.fromCharCode(13)).join(''), +f.match(/(\d{4})/)[1]));
  }
  const csv = fs.readFileSync(CSV, 'utf8');
  const list = pending(events, csv);
  if (!list.length) { console.log('数字を入れる投稿はありません（投稿したらメニューの x で済みにしてから）。'); return; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  for (const e of list) {
    console.log(`\n${stamp(e)}｜${e.type}　（X の投稿の「アクティビティ」を見る。表示回数を空のまま Enter で飛ばす）`);
    const ask = async (q) => (await rl.question(`  ${q}：`)).trim();
    const views = await ask('表示回数');
    if (!views) { console.log('  飛ばしました'); continue; }
    lines.push(row(e, events, { views, likes: await ask('いいね'), replies: await ask('返信'), links: await ask('リンクのクリック'), profile: await ask('プロフィールのクリック'), follow: await ask('フォローの増減（例 +3）'), memo: await ask('メモ（なくてよい）') }));
  }
  rl.close();
  if (!lines.length) return;
  fs.writeFileSync(CSV, csv.replace(/\s*$/, '\n') + lines.join('\n') + '\n');
  console.log(`${lines.length}件を記録しました。`);
  if (!process.argv.includes('--no-publish')) { publish(['docs/調査/X投稿の記録.csv'], 'X の投稿の24時間後の数字を記録する（post-stats.js）'); console.log('公開しました。'); }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { pending, row, stamp, slot };
