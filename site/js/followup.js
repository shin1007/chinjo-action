/* global module */
// 提出したあとの「その後どうなりましたか」。提出の記録（議会・日付・内容）はこの端末の localStorage にだけ残す（サーバーには送らない）。
// 1週間後・1か月後・3か月後に、トップページと作成画面の上に問いを出す。答えは端末に保存し、
// 「集計に加える」を選んだ分だけ、議会名と結果（個人情報なし）を Supabase の outcomes に送る。
// 送る部分は supabase/schema.sql の outcomes と outcome_totals を反映するまで OUTCOME_LIVE を false にしておく（準備中）。
(() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  const OUTCOME_LIVE = false;
  const STORE = 'chinjo-submissions';
  const STAGES = [[1, 7], [2, 30], [3, 90]];
  const STAGE_LABEL = { 1: '1週間', 2: '1か月', 3: '3か月' };
  const RESULTS = [
    ['received', '受け付けられた（結果はまだ）'],
    ['distributed', '議員に配られた（審査はされない）'],
    ['reviewing', '審査中・継続審査'],
    ['adopted', '採択された'],
    ['not_adopted', '不採択だった'],
    ['not_accepted', '受け付けられなかった'],
    ['unknown', 'まだわからない'],
  ];
  const DAY = 86400000;

  const today = () => new Date().toISOString().slice(0, 10);
  const daysBetween = (from, to) => Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
  const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
  const read = () => { try { const v = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list.slice(-50))); } catch { /* 覚えられなくても支障はない */ } };

  // いま問う段階：経った日数で届いた最後の段階。答え済み・見送り済みなら null
  const dueStage = (rec, now = today()) => {
    const elapsed = daysBetween(rec.at, now);
    const reached = STAGES.filter(([, d]) => elapsed >= d).map(([s]) => s);
    if (!reached.length) return null;
    const stage = reached[reached.length - 1];
    if (rec.answers && rec.answers[stage]) return null;
    if (rec.snooze && rec.snooze >= now) return null;
    return stage;
  };

  const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const compact = (d) => d.replace(/-/g, '');
  // 端末のカレンダーに入れる予定（議会名と日付だけ。文面や氏名は入れない）
  const buildIcs = (rec) => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//chinjo-action//followup//JA', 'CALSCALE:GREGORIAN'];
    STAGES.forEach(([stage, days]) => {
      const start = addDays(rec.at, days);
      lines.push('BEGIN:VEVENT', `UID:${rec.at}-${compact(rec.id.replace(/\W/g, '') || 'x')}-${stage}@chinjo-action`,
        `DTSTAMP:${compact(today())}T000000Z`, `DTSTART;VALUE=DATE:${compact(start)}`, `DTEND;VALUE=DATE:${compact(addDays(start, 1))}`,
        `SUMMARY:${icsEscape(`陳情のその後を確かめる（${rec.id.split('/')[1] || ''}・${STAGE_LABEL[stage]}後）`)}`,
        `DESCRIPTION:${icsEscape('議会事務局に電話するか、議会のホームページ（会議録・議案・陳情の一覧）で、出した陳情がどう扱われたかを確かめます。')}`,
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  };

  // 提出の記録を足す（report.js から呼ぶ）。同じ議会・同じ日の二重は足さない
  const add = (id, asks = [], items = 1) => {
    const list = read();
    const at = today();
    if (list.some((r) => r.id === id && r.at === at)) return;
    list.push({ id, at, asks: asks.slice(0, 10), items, answers: {} });
    write(list);
  };

  async function send(id, stage, result) {
    if (!OUTCOME_LIVE) return false;
    const i = id.indexOf('/');
    const r = await fetch(`${URL}/rest/v1/outcomes`, {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ pref: id.slice(0, i), council: id.slice(i + 1), stage, result }),
    }).catch(() => null);
    return !!(r && r.ok);
  }

  const api = { add, read, dueStage, buildIcs, addDays, daysBetween, RESULTS, STAGE_LABEL };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') return;
  window.Followup = api;

  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icsUrl = (rec) => URL_.createObjectURL(new Blob([buildIcs(rec)], { type: 'text/calendar;charset=utf-8' }));
  const URL_ = window.URL;
  // 提出の記録のあとに出す「カレンダーに入れる」リンク
  api.icsLink = (id) => {
    const rec = read().filter((r) => r.id === id).pop();
    if (!rec) return null;
    const a = document.createElement('a');
    a.href = icsUrl(rec);
    a.download = 'chinjo-followup.ics';
    a.className = 'btn btn-small';
    a.textContent = '1週間後・1か月後・3か月後に確かめる予定をカレンダーに入れる（.ics）';
    return a;
  };

  const show = () => {
    const main = document.querySelector('main');
    if (!main || document.getElementById('followup')) return;
    const list = read();
    const idx = list.findIndex((r) => dueStage(r));
    if (idx < 0) return;
    const rec = list[idx];
    const stage = dueStage(rec);
    const elapsed = daysBetween(rec.at, today());
    const box = document.createElement('aside');
    box.id = 'followup';
    box.className = 'followup';
    box.setAttribute('aria-label', '提出した陳情のその後');
    box.innerHTML = `<div class="wrap"><p class="followup-q"><b>${esc(rec.id.split('/')[1] || '')}に陳情を出してから${elapsed}日（${STAGE_LABEL[stage]}の確認）。</b>その後どうなりましたか。</p>`
      + `<div class="followup-choices">${RESULTS.map(([v, t]) => `<button type="button" class="btn btn-small" data-result="${v}">${esc(t)}</button>`).join('')}</div>`
      + `<label class="followup-share"><input type="checkbox" id="followupShare" ${OUTCOME_LIVE ? 'checked' : 'disabled'}> 結果を、議会名と結果だけの匿名の集計に加える${OUTCOME_LIVE ? '' : '（準備中。答えはこの端末にだけ保存されます）'}</label>`
      + '<p class="hint-sm followup-note">出した記録も答えも、この端末のブラウザにだけ残ります（サイトの運営には送りません）。ブラウザのデータを消すと、この確認は出なくなります。<button type="button" class="btn btn-small" data-snooze>あとで</button> <button type="button" class="btn btn-small" data-skip>この確認をやめる</button></p></div>';
    main.insertBefore(box, main.firstChild);
    box.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      const all = read();
      const cur = all[idx];
      if (!cur || cur.id !== rec.id || cur.at !== rec.at) return;
      if (t.dataset.snooze !== undefined) { cur.snooze = addDays(today(), 3); write(all); box.remove(); return; }
      if (t.dataset.skip !== undefined) { cur.answers = { 1: 'skip', 2: 'skip', 3: 'skip' }; write(all); box.remove(); return; }
      if (!t.dataset.result) return;
      cur.answers = { ...(cur.answers || {}), [stage]: t.dataset.result };
      if (stage >= 2) cur.answers[1] = cur.answers[1] || 'skip';
      if (stage === 3) cur.answers[2] = cur.answers[2] || 'skip';
      write(all);
      const share = document.getElementById('followupShare');
      if (share && share.checked) await send(rec.id, stage, t.dataset.result);
      box.querySelector('.wrap').innerHTML = '<p class="followup-q"><b>ありがとうございます。</b>答えを残しました。</p>';
      setTimeout(() => box.remove(), 4000);
    });
  };
  show();
})();
