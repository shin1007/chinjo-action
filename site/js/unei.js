(() => {
  // /unei：運営が出したもの・出す予定（データは site/data/unei.js）
  const U = window.UNEI;
  const C = window.Common;
  if (!U || !C) return;
  const { esc, dateJa } = C;
  const THEME_NAME = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への参加', kenko: '国民の健康', sonota: 'その他の陳情' };
  const asks = {};
  (window.ASKS || []).forEach((a) => { if (!asks[a.id]) asks[a.id] = a; });
  const label = (id) => (asks[id] ? asks[id].label : id);
  const ymd = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
  const today = ymd(new Date(Date.now() + 9 * 3600e3));

  const sent = [...(U.sent || [])].sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('ueSent').innerHTML = sent.length ? `<table class="unei-table"><thead><tr><th>出した日</th><th>出した先</th><th>内容</th></tr></thead><tbody>${
    sent.map((r) => `<tr><td>${esc(dateJa(r.date))}</td><td>${esc(r.to)}<br><small>${esc(r.via || '')}</small></td><td>${r.ask ? `${esc(label(r.ask))}<br><small>${esc(THEME_NAME[r.theme] || '')}の国への項目</small>` : esc(r.title || '')}</td></tr>`).join('')
  }</tbody></table>` : '<p>まだありません。</p>';

  // チームみらい：週に1件。出した項目は飛ばし、まだの項目を start から7日ごとに並べる
  const m = U.mirai;
  const done = new Set(sent.filter((r) => r.to === 'チームみらい' && r.ask).map((r) => r.ask));
  const rest = m.order.filter((id) => !done.has(id));
  // 次の予定日は、最後に出した日から4日以上あけた、いつもの曜日（scripts/unei.js の nextDue と同じ決まり）。数日遅れても、次はいつもの曜日に戻る
  const lastDone = sent.filter((r) => r.to === 'チームみらい' && r.ask).map((r) => r.date).sort().pop();
  const wd = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
  let first = lastDone ? addDays(lastDone, 4) : m.start;
  while (wd(first) !== wd(m.start)) first = addDays(first, 1);
  const rows = rest.slice(0, 8).map((id, i) => [addDays(first, m.everyDays * i), id]);
  document.getElementById('ueMirai').innerHTML = `<p>出した項目：${done.size}件／全${m.order.length}件。次からの予定（毎週${esc(dateJa(m.start).slice(-2, -1))}曜日ごろ）：</p><table class="unei-table"><thead><tr><th>予定日</th><th>項目</th></tr></thead><tbody>${
    rows.map(([d, id]) => `<tr${d <= today ? ' class="unei-now"' : ''}><td>${esc(dateJa(d))}${d < today ? '（遅れています。出せる日に出します）' : ''}</td><td>${esc(label(id))}<br><small>${esc(THEME_NAME[m.themeOf[id]] || '')}</small></td></tr>`).join('')
  }</tbody></table>${rest.length > rows.length ? `<p class="small">ほか${rest.length - rows.length}件が続きます。</p>` : ''}`;

  const f = U.forms;
  const STATUS = { planned: '出す予定（運営者が手で出します。出したら「出したもの」に載せます）', done: '出した', tentative: '仮の予定', postponed: 'まだ出していません（項目の調査を進めてから出します）' };
  const targets = f.targets.filter((t) => !t.skip);
  const skipped = f.targets.filter((t) => t.skip);
  document.getElementById('ueForms').innerHTML = `<table class="unei-table"><thead><tr><th>日</th><th>テーマ</th><th>出す項目</th><th>状況</th></tr></thead><tbody>${
    f.rounds.map((r) => `<tr><td>${esc(dateJa(r.date))}</td><td>${esc(THEME_NAME[r.theme] || '')}</td><td>${r.chinjo ? `陳情：${esc(label(r.chinjo))}<br>` : ''}${r.yobo ? `要望：${esc(label(r.yobo))}` : ''}${!r.chinjo && !r.yobo ? '未定' : ''}${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</td><td>${esc(STATUS[r.status] || r.status)}</td></tr>`).join('')
  }</tbody></table>
  <p>対象（${targets.length}）：${targets.map((t) => `${esc(t.to)}${t.kind === 'yobo' ? '（要望）' : t.mail ? '（陳情・Word の様式を郵送）' : '（陳情）'}`).join('、')}</p>${
    skipped.length ? `<p class="small">対象から外したもの：${skipped.map((t) => `${esc(t.to)}（${esc(t.skip)}）`).join('、')}</p>` : ''}`;
})();
