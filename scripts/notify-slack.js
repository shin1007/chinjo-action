// 投稿予定（docs/投稿予定/*.md）のうち、まもなく投稿する時刻のものを、Slack に知らせる。
// X への投稿は、運営者が手でコピー＆ペーストして行う（自動では投稿しない）。
//   node scripts/notify-slack.js            … これから20分以内に投稿する予定を、Slack に送る
//   node scripts/notify-slack.js --dry-run  … 送らずに、送る内容だけを出す
//   node scripts/notify-slack.js --now 2026-11-24T07:20:00+09:00  … 時刻を指定して試す
// Slack の送り先（Incoming Webhook の URL）は、環境変数 SLACK_WEBHOOK_URL（GitHub の Secrets）で渡す。リポジトリには書かない。
// 画像・動画は、予定の「画像」の行のファイルを、公開リポジトリの URL（raw）で知らせる。
const fs = require('fs');
const path = require('path');
const { parse } = require('./schedule-to-ics.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', '投稿予定');
const RAW = 'https://raw.githubusercontent.com/shin1007/chinjo-action/main/';
const AHEAD_MIN = 20;

// 日本時間の予定の日時（ミリ秒）
const when = (e) => Date.UTC(e.year, e.month - 1, e.day, e.hour - 9, e.min);

// いまから AHEAD_MIN 分以内に始まる、未投稿の予定
function due(events, nowMs, aheadMin = AHEAD_MIN) {
  return events.filter((e) => !e.done && when(e) > nowMs && when(e) <= nowMs + aheadMin * 60000).sort((a, b) => when(a) - when(b));
}

const IMG = /\.(png|jpe?g|gif)$/i;
const VID = /\.(mp4|mov|webm)$/i;
const mediaUrl = (p) => RAW + p.split('/').map(encodeURIComponent).join('/');
// 「画像」の行（複数あれば、読点やカンマで区切る）から、ファイルの場所を取り出す
function mediaPaths(img) {
  return String(img || '').split(/[、,，\s]+/).map((s) => s.trim()).filter((s) => /\.[A-Za-z0-9]{2,4}$/.test(s));
}

// Slack に送る内容（blocks）。本文は、コードブロックに入れる（コピーしやすい）。
function payload(e) {
  const hh = `${e.hour}:${String(e.min).padStart(2, '0')}`;
  const title = `X に投稿する時刻です（${e.month}月${e.day}日 ${hh}｜${e.type}）`;
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: title.slice(0, 150) } },
    { type: 'section', text: { type: 'mrkdwn', text: '```' + e.text.replace(/```/g, "'''") + '```' } },
  ];
  const files = mediaPaths(e.img);
  for (const f of files) {
    const url = mediaUrl(f);
    if (IMG.test(f)) blocks.push({ type: 'image', image_url: url, alt_text: path.basename(f) });
    else blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `${VID.test(f) ? '動画' : 'ファイル'}：<${url}|${path.basename(f)}>（開いて保存し、X の投稿画面で添付します）` } });
  }
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `投稿前の確認：${e.check || 'なし'}\nリンク先：\`${e.link}\`　投稿したら、予定の \`[ ]\` を \`[x]\` に。` }] });
  return { text: title, blocks };
}

async function send(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Slack が ${res.status} を返しました：${(await res.text()).slice(0, 200)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const ni = args.indexOf('--now');
  const nowMs = ni >= 0 ? new Date(args[ni + 1]).getTime() : Date.now();
  if (!Number.isFinite(nowMs)) throw new Error('--now の日時が読めません');
  let events = [];
  for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.md'))) {
    const year = +(f.match(/(\d{4})/) || [])[1] || new Date(nowMs).getFullYear();
    events = events.concat(parse(fs.readFileSync(path.join(DIR, f), 'utf8'), year));
  }
  const list = due(events, nowMs);
  console.log(`いま ${new Date(nowMs).toISOString()}／予定 ${events.length} 件／これから${AHEAD_MIN}分以内 ${list.length} 件${dry ? '（dry-run）' : ''}`);
  const url = process.env.SLACK_WEBHOOK_URL;
  for (const e of list) {
    const body = payload(e);
    if (dry || !url) { console.log(JSON.stringify(body, null, 1)); continue; }
    await send(url, body);
    console.log(`Slack に送りました：${e.month}/${e.day} ${e.hour}:${String(e.min).padStart(2, '0')}`);
  }
  if (!dry && list.length && !url) console.log('SLACK_WEBHOOK_URL が設定されていないので、送っていません。');
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { due, payload, mediaPaths, mediaUrl, when };
