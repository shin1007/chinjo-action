// 投稿予定（docs/投稿予定/*.md）から、カレンダー用の .ics を作る。
//   node scripts/schedule-to-ics.js docs/投稿予定/2026年11-12月.md   … 同じ名前の .ics を書き出す
// 1件が1つの予定になる。予定の説明に、本文・画像・投稿前の確認が入るので、
// スマホのカレンダーで予定を開いて、説明から本文をコピーして X に貼れる。
// 通知は、予定の15分前と、予定の時刻（Google カレンダーが取り込み時に通知を引き継がない場合は、カレンダーの既定の通知を設定する）。
// 時刻は日本時間（UTC+9）として読み、UTC で書き出す。
const fs = require('fs');
const path = require('path');

// 予定の見出し「### [ ] 11月24日（火）07:30｜A 入口」と、その下の項目・コードブロックを読む。
function parse(md, year) {
  const events = [];
  const parts = md.split(/^### /m).slice(1);
  for (const part of parts) {
    const head = part.split('\n')[0];
    const m = head.match(/^\[( |x)\]\s*(\d+)月(\d+)日（.）(\d{1,2}):(\d{2})｜(.+)$/);
    if (!m) continue;
    const code = part.match(/```\n([\s\S]*?)\n```/);
    const link = (part.match(/^- リンク先：`([^`]*)`/m) || [])[1] || '';
    const img = (part.match(/^- 画像：(.+)$/m) || [])[1] || '';
    const check = (part.match(/^- 投稿前の確認：(.+)$/m) || [])[1] || '';
    events.push({ done: m[1] === 'x', month: +m[2], day: +m[3], hour: +m[4], min: +m[5], type: m[6].trim(), link, img: img.replace(/`/g, ''), check, text: code ? code[1] : '', year });
  }
  return events;
}

const pad = (n) => String(n).padStart(2, '0');
// 日本時間の日時を UTC の YYYYMMDDTHHMMSSZ に
function utc(e, addMin = 0) {
  const d = new Date(Date.UTC(e.year, e.month - 1, e.day, e.hour - 9, e.min + addMin));
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// RFC 5545：1行は75オクテットまで。超えたら、改行して先頭に空白を1つ付けて続ける（UTF-8 の文字の途中では切らない）
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
}

function build(events, stamp = new Date()) {
  const ds = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}${pad(stamp.getUTCSeconds())}Z`;
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chinjo-action//x-schedule//JA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:陳情アクション X投稿予定', 'X-WR-TIMEZONE:Asia/Tokyo'];
  for (const e of events) {
    const first = e.text.split('\n')[0];
    const desc = [`【本文（そのままコピーして X に貼る）】`, e.text, '', `型：${e.type}`, `リンク先：${e.link}`, `画像：${e.img || 'なし'}`, `投稿前の確認：${e.check}`].join('\n');
    L.push('BEGIN:VEVENT', `UID:x-${e.year}${pad(e.month)}${pad(e.day)}T${pad(e.hour)}${pad(e.min)}@chinjo-action`, `DTSTAMP:${ds}`, `DTSTART:${utc(e)}`, `DTEND:${utc(e, 15)}`,
      `SUMMARY:${esc(`X投稿：${e.type}｜${first}`.slice(0, 60))}`, `DESCRIPTION:${esc(desc)}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:X の投稿の15分前', 'TRIGGER:-PT15M', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:X の投稿の時刻', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('使い方：node scripts/schedule-to-ics.js docs/投稿予定/2026年11-12月.md'); process.exit(1); }
  const md = fs.readFileSync(file, 'utf8');
  const year = +(path.basename(file).match(/(\d{4})/) || [])[1] || new Date().getFullYear();
  const events = parse(md, year).filter((e) => !e.done);
  const out = file.replace(/\.md$/, '.ics');
  fs.writeFileSync(out, build(events));
  console.log(`${events.length} 件の予定を ${out} に書き出しました（投稿済みの [x] は除く）`);
}
module.exports = { parse, build, utc, fold, esc };
