#!/usr/bin/env node
// X に投稿した予定を「済み」（### [x]）にして、カレンダー（.ics）を作り直し、main に取り込んで公開する。
// 済みにした予定は、Slack のリマインドが送られなくなる。毎朝のメニュー（定期の提出.cmd）の x から呼ぶ。
//   node scripts/post-done.js                 … いまから見て一番近い過去（または30分以内）の未投稿の予定を済みにして公開
//   node scripts/post-done.js 12/1 7:30       … 日時を指定して済みにする
//   node scripts/post-done.js --dry           … どれを済みにするかを見るだけ
//   node scripts/post-done.js --no-publish    … 済みにするが、コミット・公開はしない
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parse } = require('./schedule-to-ics.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', '投稿予定');
const when = (e) => Date.UTC(e.year, e.month - 1, e.day, e.hour - 9, e.min);
const hhmm = (e) => `${e.hour}:${String(e.min).padStart(2, '0')}`;

// 済みにする予定を選ぶ。日時の指定（"12/1" と "7:30"）があればそれ、なければ now+30分までで一番新しい未投稿
function pick(events, nowMs, date, time) {
  const open = events.filter((e) => !e.done);
  if (date) {
    const [m, d] = date.split('/').map(Number);
    const [h, mi] = (time || '').split(':').map(Number);
    return open.filter((e) => e.month === m && e.day === d && (!time || (e.hour === h && e.min === mi)));
  }
  const past = open.filter((e) => when(e) <= nowMs + 30 * 60000).sort((a, b) => when(b) - when(a));
  return past.slice(0, 1);
}

// 見出しの [ ] を [x] にする
function mark(md, e) {
  const re = new RegExp(`^### \\[ \\]( ${e.month}月${e.day}日（.）0?${e.hour}:${String(e.min).padStart(2, '0')}｜)`, 'm');
  if (!re.test(md)) throw new Error(`見出しが見つかりません：${e.month}/${e.day} ${hhmm(e)}`);
  return md.replace(re, '### [x]$1');
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const pos = args.filter((a) => !a.startsWith('--'));
  const files = fs.readdirSync(DIR).filter((n) => n.endsWith('.md') && /\d{4}/.test(n));
  const changed = [];
  for (const f of files) {
    const file = path.join(DIR, f);
    let md = fs.readFileSync(file, 'utf8').split(String.fromCharCode(13)).join(''); // Windows で取り出すと CRLF になる
    const year = +f.match(/(\d{4})/)[1];
    const list = pick(parse(md, year), Date.now(), pos[0], pos[1]);
    for (const e of list) {
      console.log(`${dry ? '（見るだけ）' : '済みにします'}：${e.month}/${e.day} ${hhmm(e)}｜${e.type}`);
      if (!dry) md = mark(md, e);
    }
    if (list.length && !dry) { fs.writeFileSync(file, md); changed.push(file); }
  }
  if (!changed.length) { console.log(dry ? '' : '済みにする予定はありませんでした（日時を指定するなら：node scripts/post-done.js 12/1 7:30）'); return; }
  for (const file of changed) execFileSync('node', [path.join(__dirname, 'schedule-to-ics.js'), file], { stdio: 'inherit' });
  if (args.includes('--no-publish')) return;
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'inherit' });
  const branch = 'claude/post-done-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  git('checkout', '-q', 'main'); git('pull', '-q');
  git('checkout', '-q', '-b', branch);
  git('add', 'docs/投稿予定');
  git('commit', '-q', '-m', 'X に投稿した予定を済みにする（post-done.js）');
  git('push', '-q', '-u', 'origin', branch);
  execFileSync('gh', ['pr', 'create', '--fill', '--body', '投稿した予定を済みにする（scripts/post-done.js）。'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('gh', ['pr', 'merge', '--merge', '--delete-branch'], { cwd: ROOT, stdio: 'inherit' });
  git('checkout', '-q', 'main'); git('pull', '-q');
  console.log('公開しました（この予定の Slack のリマインドは送られません）。');
}

if (require.main === module) { try { main(); } catch (e) { console.error(e.message); process.exit(1); } }
module.exports = { pick, mark };
