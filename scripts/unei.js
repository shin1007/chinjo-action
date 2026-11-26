// 運営が定期的に出す陳情・要望・政党への提言の道具（記録は site/data/unei.js。/unei に表示）
//
//   node scripts/unei.js status            … 今日やること（チームみらいの週1・議会への3か月ごとの回）と遅れを出す
//   node scripts/unei.js mirai --dry       … 次にチームみらいへ出す項目の文面だけを出す
//   node scripts/unei.js mirai             … ブラウザを開いて、AIインタビューに出し（追加の質問はスキップ、公開せずに提出）、記録に足す
//   node scripts/unei.js forms             … いまの回の対象（フォームの直リンク）と、作成画面の URL を出す
//   node scripts/unei.js record <出した先> <項目id> [YYYY-MM-DD]   … 手で出したものを記録に足す（例：record 三鷹市議会 n_restore）
//   node scripts/unei.js round-done [YYYY-MM-DD]                    … いまの回を「出した」にする
//   node scripts/unei.js ics               … リマインダー用のカレンダー（docs/提言/リマインダー.ics）を書き出す
//
// mirai は Playwright を使う。既定では C:/Users/shin1/.claude/tools/browser の Playwright を読む（PLAYWRIGHT_DIR で変えられる）。
// 記録を足したら、git でコミットして公開する（/unei と作成画面の札が変わる）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site/data/unei.js');
const THEMES = ['kodomo', 'nihonjin', 'shiho', 'dansei', 'kenko', 'sonota'];
const THEME_NAME = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への参加', kenko: '国民の健康', sonota: 'その他の陳情' };
const WEEK = '日月火水木金土';

const load = () => {
  const src = fs.readFileSync(DATA, 'utf8');
  const i = src.indexOf('window.UNEI = ');
  return { head: src.slice(0, i), data: JSON.parse(src.slice(i + 'window.UNEI = '.length).replace(/;\s*$/, '')) };
};
const save = ({ head, data }) => fs.writeFileSync(DATA, `${head}window.UNEI = ${JSON.stringify(data, null, 1)};\n`);

const asks = () => {
  const map = {};
  for (const t of THEMES) {
    for (const f of ['asks-national.js', 'asks-local.js']) {
      const ctx = { window: {} };
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'site/themes', t, f), 'utf8'), ctx);
      for (const a of ctx.window.ASKS || []) if (!map[a.id]) map[a.id] = { ...a, theme: t };
    }
  }
  return map;
};

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dateJa = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日（${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`; };

// チームみらい：まだ出していない項目のうち先頭と、その予定日（最後に出した日の7日後）
const nextMirai = (data) => {
  const sent = data.sent.filter((r) => r.to === 'チームみらい' && r.ask);
  const done = new Set(sent.map((r) => r.ask));
  const id = data.mirai.order.find((x) => !done.has(x));
  const last = sent.map((r) => r.date).sort().pop() || addDays(data.mirai.start, -data.mirai.everyDays);
  return { id, due: addDays(last, data.mirai.everyDays), left: data.mirai.order.length - done.size };
};
const currentRound = (data) => data.forms.rounds.find((r) => r.status !== 'done');

const miraiText = (a) => `${THEME_NAME[a.theme]}について、国への政策提言です（市民の陳情づくりを手伝う公開サイト「陳情アクション」の運営から、サイトに載せている国への陳情項目を週に1件ずつお送りしています）。今回は「${a.label}」です。\n求める内容：${a.text}\n理由：${a.reason}`;

function status() {
  const { data } = load();
  const t = today();
  const m = nextMirai(data);
  const A = asks();
  console.log(`今日：${dateJa(t)}`);
  if (m.id) console.log(`${m.due <= t ? '★ やる' : '  まだ'}　チームみらい：${dateJa(m.due)}${m.due < t ? '（遅れています）' : ''}　「${A[m.id] ? A[m.id].label : m.id}」（残り${m.left}件）→ node scripts/unei.js mirai`);
  else console.log('  チームみらい：全部の項目を出し終えました');
  const r = currentRound(data);
  if (r) console.log(`${r.date <= t ? '★ やる' : '  まだ'}　議会・自治体（${THEME_NAME[r.theme]}）：${dateJa(r.date)}${r.status === 'tentative' ? '（仮の予定）' : ''}　→ node scripts/unei.js forms`);
  return { miraiDue: m.id && m.due <= t, formsDue: r && r.date <= t };
}

function forms() {
  const { data } = load();
  const r = currentRound(data);
  if (!r) return console.log('予定の回がありません。site/data/unei.js の forms.rounds に足してください。');
  const A = asks();
  console.log(`回：${dateJa(r.date)}　テーマ：${THEME_NAME[r.theme]}`);
  console.log(`陳情：${r.chinjo ? A[r.chinjo].label : '未定'}　要望：${r.yobo ? A[r.yobo].label : '未定'}`);
  console.log(`文面は https://chinjo-action.vercel.app/${r.theme}/make で、出し先を選び、その項目だけを選んで作る。\n`);
  const done = new Set(data.sent.filter((s) => s.date >= r.date).map((s) => s.to));
  for (const x of data.forms.targets.filter((y) => !y.skip)) {
    console.log(`${done.has(x.to) ? '[済]' : '[  ]'} ${x.to}（${x.kind === 'yobo' ? '要望' : '陳情'}）\n     ${x.form || '(フォームの URL は案内のページから)'}\n     案内：${x.page}`);
  }
  console.log('\n出したら：node scripts/unei.js record <出した先> <項目id>　全部出したら：node scripts/unei.js round-done');
}

function record(to, id, date = today()) {
  const st = load();
  const A = asks();
  if (!to || !id || !A[id]) throw new Error('使い方：record <出した先> <項目id> [YYYY-MM-DD]（項目id が見つかりません）');
  const t = st.data.forms.targets.find((x) => x.to === to);
  st.data.sent.push({ date, to, via: t ? `${t.kind === 'yobo' ? '要望' : '陳情'}（オンラインのフォーム）` : '', ask: id, theme: A[id].theme });
  save(st);
  console.log(`記録しました：${dateJa(date)} ${to}「${A[id].label}」`);
}

function roundDone(date = today()) {
  const st = load();
  const r = currentRound(st.data);
  if (!r) return console.log('予定の回がありません。');
  r.status = 'done';
  r.date = date;
  // 次の回を仮に足す（3か月後・次のテーマ）。陳情番号の1番を狙う時期は、確かめたら手で直す
  const themes = st.data.forms.themes;
  if (!currentRound(st.data)) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + st.data.forms.everyMonths);
    st.data.forms.rounds.push({ date: d.toISOString().slice(0, 10), theme: themes[(themes.indexOf(r.theme) + 1) % themes.length], status: 'tentative' });
  }
  save(st);
  console.log(`回を「出した」にしました：${dateJa(date)}`);
}

async function mirai(dry) {
  const st = load();
  const m = nextMirai(st.data);
  if (!m.id) return console.log('全部の項目を出し終えました。');
  const a = asks()[m.id];
  const text = miraiText(a);
  console.log(`項目：${a.label}（${m.id}）　予定日：${dateJa(m.due)}\n---\n${text}\n---`);
  if (dry) return;

  const pwDir = process.env.PLAYWRIGHT_DIR || 'C:/Users/shin1/.claude/tools/browser';
  const { chromium } = require(require.resolve('playwright', { paths: [pwDir] }));
  const browser = await chromium.launch({ headless: !!process.env.HEADLESS });
  const page = await browser.newPage({ locale: 'ja-JP' });
  const btn = (name) => page.getByRole('button', { name });
  const visible = async (name) => btn(name).first().isVisible().catch(() => false);
  try {
    await page.goto(st.data.mirai.url);
    await btn(/テキストで答える/).click();
    await btn('インタビューを始める').click();
    const box = page.getByRole('textbox', { name: /メッセージを入力/ });
    await box.waitFor({ timeout: 30000 });
    await box.fill(text);
    await page.keyboard.press('Control+Enter');
    // 追加の質問はスキップし、「インタビューを終了する」が出たら押す。最後に「公開せずに提出」
    const end = Date.now() + 5 * 60e3;
    let submitted = false;
    while (Date.now() < end && !submitted) {
      await page.waitForTimeout(4000);
      if (await page.getByText('お話を受け取りました').isVisible().catch(() => false)) { submitted = true; break; }
      if (await visible('公開せずに提出') && await btn('公開せずに提出').isEnabled()) { await btn('公開せずに提出').click(); continue; }
      if (await visible('インタビューを終了する')) { await btn('インタビューを終了する').click(); continue; }
      if (await visible(/スキップする/) && await box.isEnabled().catch(() => false)) { await btn(/スキップする/).first().click(); await page.waitForTimeout(6000); }
    }
    if (!submitted) throw new Error('5分たっても提出が終わりませんでした。ブラウザの画面を確かめてください（記録には足していません）。');
    st.data.sent.push({ date: today(), to: 'チームみらい', via: '政策についてのご意見（AIインタビュー・非公開で提出）', ask: m.id, theme: a.theme });
    save(st);
    console.log(`提出して記録しました：${dateJa(today())}「${a.label}」。git でコミットして公開してください。`);
  } finally {
    await browser.close();
  }
}

// リマインダー：チームみらいは毎週（start の曜日）9時、議会・自治体の回はその日の9時。.ics をカレンダーに取り込む
function ics() {
  const { data } = load();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = (uid, date, summary, desc, rrule) => [
    'BEGIN:VEVENT', `UID:${uid}@chinjo-action`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Asia/Tokyo:${date.replace(/-/g, '')}T090000`, `DURATION:PT30M`,
    ...(rrule ? [rrule] : []), `SUMMARY:${summary}`, `DESCRIPTION:${desc.replace(/\n/g, '\\n')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT',
  ];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chinjo-action//unei//JA', 'BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'END:STANDARD', 'END:VTIMEZONE'];
  lines.push(...ev('mirai-weekly', nextMirai(data).due, 'チームみらいへ今週の提言', 'node scripts/unei.js mirai\n予定は https://chinjo-action.vercel.app/unei', `RRULE:FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(`${data.mirai.start}T00:00:00Z`).getUTCDay()]}`));
  for (const r of data.forms.rounds.filter((x) => x.status !== 'done')) {
    lines.push(...ev(`forms-${r.date}`, r.date, `議会・自治体へ陳情・要望（${THEME_NAME[r.theme]}）`, `node scripts/unei.js forms${r.status === 'tentative' ? '\n仮の予定。陳情番号の振り直しの時期を確かめてから決める' : ''}`));
  }
  lines.push('END:VCALENDAR');
  const out = path.join(ROOT, 'docs/提言/リマインダー.ics');
  fs.writeFileSync(out, `${lines.join('\r\n')}\r\n`);
  console.log(`書き出しました：${out}`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = {
  status, forms, ics,
  mirai: () => mirai(args.includes('--dry')),
  record: () => record(...args),
  'round-done': () => roundDone(...args),
}[cmd];
if (require.main !== module) {
  // テストなどから読むときは何もしない
} else if (!run) {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//   node')).map((l) => l.slice(5)).join('\n'));
} else {
  Promise.resolve(run()).catch((e) => { console.error(e.message); process.exit(1); });
}
module.exports = { nextMirai, miraiText, dateJa, addDays };
