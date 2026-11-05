(() => {
  const STORE = window.THEME.key('chinjo-builder-v1');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const KINDS = { council: '議会', mayor: '首長', member: '議員' };
  const DEFAULT_TITLE = { council: '議長', mayor: '市長', member: '議員' };
  const MAIL = { ok: '可', unknown: '未確認', no: '不可' };
  const BODY_KEYS = ['council', 'mayor', 'member', 'cover'];

  const state = Object.assign({
    sender: { era: 'reiwa' },
    recipients: [],
    asks: ['n_restore', 'n_joint', 'n_lawyer', 'l_visit', 'l_guidance'],
    blocks: ['crc', 'reform2024', 'supreme', 'no_prosecution', 'conflict', 'poverty', 'support_rate'],
    story: '',
    councilForm: 'chinjo',
    introducer: '',
    bodies: {},
  }, load());

  // 保存した内容が壊れていたり、保存できない環境でも、ビルダーは使えるようにする
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
  }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* この画面の間だけ残す */ } };

  // ダイアログを使わず、ボタンの二度押しで消去を確認する
  let clearArmed = false;
  $('#clearAll').addEventListener('click', (e) => {
    if (!clearArmed) {
      clearArmed = true;
      e.target.textContent = '本当に消去しますか？もう一度押してください';
      setTimeout(() => { clearArmed = false; e.target.textContent = '入力内容をすべて消去'; }, 4000);
      return;
    }
    try { localStorage.removeItem(STORE); } catch { /* 保存していなければ消すものもない */ }
    location.reload();
  });
  // 未入力の名前・住所は印刷時に下線の空欄にして、手書きで記入できるようにする
  const BLANK = '⁣';
  const escB = (s) => esc(s).replaceAll(BLANK, '<span class="blank"></span>');
  const { esc } = window.Common;
  const T = window.TEMPLATE;
  const fillTemplate = window.fillTemplate;

  // ---------- 差出人 ----------
  $$('[data-sender]').forEach((el) => {
    const k = el.dataset.sender;
    if (state.sender[k] != null) el.value = state.sender[k];
    el.addEventListener('input', () => { state.sender[k] = el.value; save(); updateSummary(); });
  });

  function formatDate() {
    const v = state.sender.date;
    const d = v ? new Date(v + 'T00:00:00') : new Date();
    const y = d.getFullYear();
    const yy = state.sender.era === 'ad' ? `${y}年` : `令和${y - 2018 === 1 ? '元' : y - 2018}年`;
    return `${yy}${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const senderBlock = (label) => {
    const s = state.sender;
    return [
      s.group ? `${label}　${s.group}` : null,
      `住所　${s.zip ? '〒' + s.zip + '　' : ''}${s.address || BLANK}`,
      `氏名　${s.name || BLANK}`,
      s.tel ? `電話　${s.tel}` : null,
      s.email ? `メール　${s.email}` : null,
    ].filter(Boolean).map((l) => '　　　　　　　　　　　　' + l).join('\n');
  };

  // ---------- 宛先 ----------
  const tbody = $('#recipientTable tbody');

  function newRecipient(over = {}) {
    return Object.assign({ print: true, kind: 'council', org: '', title: '議長', person: '', dept: '議会事務局', zip: '', address: '', mail: 'unknown' }, over);
  }

  function renderRecipients() {
    tbody.innerHTML = state.recipients.map((r, i) => `
      <tr data-i="${i}">
        <td><input type="checkbox" data-f="print" ${r.print ? 'checked' : ''}></td>
        <td><select data-f="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${r.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><input data-f="org" value="${esc(r.org)}" placeholder="○○市議会"></td>
        <td><input data-f="title" value="${esc(r.title)}" size="5"></td>
        <td><input data-f="person" value="${esc(r.person)}" size="8" placeholder="任意"></td>
        <td><input data-f="dept" value="${esc(r.dept)}" size="9"></td>
        <td><input data-f="zip" value="${esc(r.zip)}" size="8"></td>
        <td><input data-f="address" value="${esc(r.address)}" placeholder="住所"></td>
        <td><select data-f="mail">${Object.entries(MAIL).map(([k, v]) => `<option value="${k}" ${r.mail === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td class="row-actions">
          <a href="https://www.google.com/search?q=${encodeURIComponent((r.org || '') + ' 陳情 提出方法')}" target="_blank" rel="noopener" title="提出方法を検索">調べる</a>
          <button type="button" data-del title="削除">×</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="10" class="empty">宛先がまだありません。「＋ 宛先を追加」から登録してください。</td></tr>';
    updateSummary();
    renderPicker();
  }

  tbody.addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]');
    const f = e.target.dataset.f;
    if (!tr || !f) return;
    const r = state.recipients[tr.dataset.i];
    r[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    // 自分で直した住所は確認済みとみなす
    if (f === 'zip' || f === 'address') r.autoAddr = false;
    if (f === 'kind') {
      r.title = DEFAULT_TITLE[r.kind];
      r.dept = r.kind === 'council' ? '議会事務局' : '';
      renderRecipients();
    }
    save();
    updateSummary();
  });
  tbody.addEventListener('click', (e) => {
    if (!e.target.matches('[data-del]')) return;
    state.recipients.splice(e.target.closest('tr').dataset.i, 1);
    save();
    renderRecipients();
  });

  $('#addRecipient').addEventListener('click', () => {
    state.recipients.push(newRecipient());
    save();
    renderRecipients();
  });

  // ---------- 議会の選択（都道府県で絞り込み・市区町村名で検索、複数選択） ----------
  const pickPref = $('#pickPref');
  const pickQuery = $('#pickQuery');
  const pickKind = $('#pickKind');
  const pickList = $('#pickList');
  const picked = new Set();
  const PICK_LIMIT = 300;

  // 都道府県そのもの（都道府県議会・知事）と、その中の市区町村を1つの一覧にする
  const PLACES = window.Places.all();
  const placeKey = (pl) => pl.isPref ? pl.pref : pl.pref + pl.gun + pl.name;

  function mayorTitle(pl) {
    if (pl.isPref) return '知事';
    return { 市: '市長', 区: '区長', 町: '町長', 村: '村長' }[pl.name.slice(-1)] || '首長';
  }

  // 本庁舎の郵便番号・住所を自動で入れる（議会事務局の多くは本庁舎にある）
  function officeOf(pl) {
    const o = (window.OFFICES[pl.pref] || {})[pl.key];
    return o ? { zip: o[0], address: o[1], autoAddr: true } : {};
  }

  function recipientFor(pl, kind) {
    return kind === 'council'
      ? newRecipient({ org: pl.name + '議会', pref: pl.pref, ...officeOf(pl) })
      : newRecipient({ kind: 'mayor', org: pl.name, title: mayorTitle(pl), dept: '', pref: pl.pref, ...officeOf(pl) });
  }

  const isAdded = (pl, kind) => {
    const org = kind === 'council' ? pl.name + '議会' : pl.name;
    return state.recipients.some((r) => r.kind === kind && r.org === org && (!r.pref || r.pref === pl.pref));
  };

  function filtered() {
    const q = pickQuery.value.trim();
    const p = pickPref.value;
    if (!p && !q) return PLACES.filter((pl) => pl.isPref);
    return PLACES.filter((pl) => (!p || pl.pref === p) && (!q || pl.name.includes(q) || pl.gun.includes(q) || pl.pref.includes(q)));
  }

  function renderPicker() {
    const kind = pickKind.value;
    const list = filtered();
    const shown = list.slice(0, PICK_LIMIT);
    pickList.innerHTML = shown.map((pl) => {
      const key = placeKey(pl);
      const added = isAdded(pl, kind);
      const label = pl.isPref ? `${pl.name}（都道府県）` : `${pl.name}<small>${esc(pl.pref + pl.gun)}</small>`;
      return `<label class="pick ${added ? 'added' : ''}"><input type="checkbox" data-key="${esc(key)}" ${picked.has(key) ? 'checked' : ''} ${added ? 'disabled' : ''}> ${label}${added ? '<small>追加済み</small>' : ''}</label>`;
    }).join('') || '<p class="hint">該当する自治体がありません。</p>';
    const more = list.length > PICK_LIMIT ? `（${list.length}件中${PICK_LIMIT}件を表示。都道府県か名前で絞り込んでください）` : '';
    $('#pickCount').textContent = `${picked.size}件を選択中${more}`;
    if (!pickPref.value && !pickQuery.value.trim()) $('#pickCount').textContent += '　※都道府県を選ぶか名前で検索すると市区町村が出ます';
  }

  pickPref.innerHTML += window.PREFS.map((p) => `<option>${p}</option>`).join('');
  [pickPref, pickKind].forEach((el) => el.addEventListener('change', renderPicker));
  pickQuery.addEventListener('input', renderPicker);
  pickList.addEventListener('change', (e) => {
    const k = e.target.dataset.key;
    if (!k) return;
    e.target.checked ? picked.add(k) : picked.delete(k);
    // 一覧を描き直すとスクロール位置が戻るので、件数表示だけ更新する
    $('#pickCount').textContent = $('#pickCount').textContent.replace(/^\d+件/, `${picked.size}件`);
  });
  $('#pickAll').addEventListener('click', () => {
    filtered().slice(0, PICK_LIMIT).filter((pl) => !isAdded(pl, pickKind.value)).forEach((pl) => picked.add(placeKey(pl)));
    renderPicker();
  });
  $('#pickNone').addEventListener('click', () => { picked.clear(); renderPicker(); });
  $('#pickAdd').addEventListener('click', () => {
    const kind = pickKind.value;
    PLACES.filter((pl) => picked.has(placeKey(pl)) && !isAdded(pl, kind)).forEach((pl) => state.recipients.push(recipientFor(pl, kind)));
    picked.clear();
    save();
    renderRecipients();
    renderPicker();
  });

  // CSV
  const CSV_COLS = ['print', 'kind', 'pref', 'org', 'title', 'person', 'dept', 'zip', 'address', 'mail'];
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  $('#exportCsv').addEventListener('click', () => {
    const rows = [CSV_COLS.join(','), ...state.recipients.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(','))];
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '陳情宛先.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
  }

  $('#importCsv').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rows = parseCsv((await file.text()).replace(/^﻿/, ''));
    const head = rows.shift();
    rows.forEach((cells) => {
      const r = newRecipient();
      head.forEach((h, j) => { if (CSV_COLS.includes(h)) r[h] = cells[j] ?? ''; });
      r.print = r.print !== 'false';
      if (!KINDS[r.kind]) r.kind = 'council';
      if (!MAIL[r.mail]) r.mail = 'unknown';
      state.recipients.push(r);
    });
    e.target.value = '';
    save();
    renderRecipients();
  });

  // ---------- 求める事項・理由 ----------
  const askHtml = (a) => `<label class="check"><input type="checkbox" data-ask="${a.id}" ${state.asks.includes(a.id) ? 'checked' : ''}> ${esc(a.label)}</label>`;
  $('#asksNational').innerHTML = window.ASKS.filter((a) => a.scope === 'national').map(askHtml).join('');
  $('#asksLocal').innerHTML = window.ASKS.filter((a) => a.scope === 'local').map(askHtml).join('');
  $$('[data-ask]').forEach((el) => el.addEventListener('change', () => {
    state.asks = $$('[data-ask]:checked').map((x) => x.dataset.ask);
    save();
  }));

  const cats = [...new Set(window.BLOCKS.map((b) => b.cat))];
  $('#blockList').innerHTML = cats.map((cat) => `
    <details class="block-cat" open><summary>${esc(cat)}</summary>
      ${window.BLOCKS.filter((b) => b.cat === cat).map((b) => `
        <label class="block">
          <input type="checkbox" data-block="${b.id}" ${state.blocks.includes(b.id) ? 'checked' : ''}>
          <span class="block-body">
            <b>${esc(b.title)}</b>
            <span class="block-text">${esc(b.text)}</span>
            ${b.source ? `<span class="block-src">出典：${esc(b.source)}${b.url ? ` <a href="${esc(b.url)}" target="_blank" rel="noopener">原文を開く</a>` : ''}</span>` : ''}
            ${b.caution ? `<span class="block-caution">⚠ ${esc(b.caution)}</span>` : ''}
          </span>
        </label>`).join('')}
    </details>`).join('');
  $$('[data-block]').forEach((el) => el.addEventListener('change', () => {
    state.blocks = $$('[data-block]:checked').map((x) => x.dataset.block);
    save();
  }));

  const story = $('#story');
  story.value = state.story;
  story.addEventListener('input', () => { state.story = story.value; save(); });

  const councilForm = $('#councilForm');
  const introducer = $('#introducer');
  councilForm.value = state.councilForm;
  introducer.value = state.introducer;
  councilForm.addEventListener('change', () => { state.councilForm = councilForm.value; save(); updateSummary(); });
  introducer.addEventListener('input', () => { state.introducer = introducer.value; save(); });

  // ---------- 本文の生成 ----------

  function selected() {
    const asks = window.ASKS.filter((a) => state.asks.includes(a.id));
    return {
      national: asks.filter((a) => a.scope === 'national'),
      local: asks.filter((a) => a.scope === 'local'),
      blocks: window.BLOCKS.filter((b) => state.blocks.includes(b.id)),
      story: state.story.trim(),
    };
  }

  // 陳情は1件に1つの趣旨で出す。本文欄には1件ずつ区切り線で並べ、印刷時に別々の文書にする
  const SEP = '━━━━━━━━━━ 次の陳情 ━━━━━━━━━━';
  const splitDocs = (text) => text.split(SEP).map((t) => t.trim()).filter(Boolean);

  function reasons(ask, sel) {
    const out = [`1．${ask.title}`, `　${ask.reason}`, ''];
    sel.blocks.forEach((b, i) => out.push(`${i + 2}．${b.title.replace(/（引用欄）$/, '')}`, `　${b.text}`, ''));
    if (sel.story) out.push('（陳情者として）', '　' + sel.story.replace(/\n/g, '\n　'), '');
    return out;
  }

  function buildCouncilOne(ask, sel) {
    const kind = state.councilForm === 'seigan' ? '請願' : '陳情';
    const national = ask.scope === 'national';
    // {宛先} は印刷時に宛先ごとに置き換えるので、ここでは残す
    const vars = { 内容: ask.title, 種類: kind };
    const L = [`件名　${fillTemplate(national ? T.subjectNational : T.subjectLocal, vars)}`, ''];
    L.push(`【${kind}の趣旨】`);
    L.push(`　${fillTemplate(national ? T.purposeNational : T.purposeLocal, vars)}`);
    L.push('', '記', '', `一　${ask.text}`, '', `【${kind}の理由】`, ...reasons(ask, sel));
    L.push(`　${T.closing}`);
    if (national) L.push('', '【意見書の提出先（案）】', T.ikenshoTo);
    L.push('', '以上');
    return L.join('\n');
  }

  // 首長への要望は、その自治体が自ら取り組めることに限る
  function buildMayorOne(ask, sel) {
    const L = [`件名　${fillTemplate(T.mayorSubject, { 内容: ask.title })}`, ''];
    L.push(`　${T.mayorPurpose}`, '', '記', '', `一　${ask.text}`);
    L.push('', '【要望の理由】', ...reasons(ask, sel), '以上');
    return L.join('\n');
  }

  const buildCouncil = (sel) => [...sel.national, ...sel.local].map((a) => buildCouncilOne(a, sel)).join(`\n\n${SEP}\n\n`);
  const buildMayor = (sel) => sel.local.length
    ? sel.local.map((a) => buildMayorOne(a, sel)).join(`\n\n${SEP}\n\n`)
    : '（首長あての要望書は、「自治体の施策として求めること」を選ぶと作られます）';

  function buildMember(sel) {
    const L = [
      '拝啓　日頃より地域のためにご尽力いただき、心より感謝申し上げます。',
      '',
      ...window.THEME.memberIntro.flatMap((p) => [p, '']),
      '■ 実現をお願いしたいこと',
      ...[...sel.national, ...sel.local].map((a) => `・${a.text}`),
      '',
    ];
    if (sel.blocks.length) {
      L.push('■ 背景', ...sel.blocks.map((b) => `○${b.title.replace(/（引用欄）$/, '')}\n　${b.text}`), '');
    }
    if (sel.story) L.push('■ 私の思い', '　' + sel.story.replace(/\n/g, '\n　'), '');
    L.push('　ご多忙のところ恐縮ですが、議会でのご質問や意見書の提出など、お力添えをいただけましたら幸いです。また、直接お話をお聞きいただける機会をいただければ大変ありがたく存じます。', '', '敬具');
    return L.join('\n');
  }

  const COVER = `{日付}

{宛名}

{差出人}

　　　　　　{書類名}の送付について

拝啓　時下ますますご清栄のこととお慶び申し上げます。
　このたび、${window.THEME.coverPurpose}、別紙のとおり{書類名}を提出いたします。ご査収のうえ、お取り計らいくださいますようお願い申し上げます。
　なお、受理の可否や審査の日程が決まりましたら、下記連絡先までお知らせいただけますと幸いです。
　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　敬具

記

一　{書類名}　　{部数}部

連絡先　{連絡先}

以上`;

  const textareas = Object.fromEntries(BODY_KEYS.map((k) => [k, $('#body-' + k)]));
  BODY_KEYS.forEach((k) => {
    textareas[k].value = state.bodies[k] ?? (k === 'cover' ? COVER : '');
    textareas[k].addEventListener('input', () => { state.bodies[k] = textareas[k].value; save(); });
  });

  $('#generate').addEventListener('click', () => {
    const hasBody = BODY_KEYS.some((k) => k !== 'cover' && textareas[k].value.trim());
    if (hasBody && !confirmOverwrite()) return;
    const sel = selected();
    state.bodies.council = buildCouncil(sel);
    state.bodies.mayor = buildMayor(sel);
    state.bodies.member = buildMember(sel);
    ['council', 'mayor', 'member'].forEach((k) => (textareas[k].value = state.bodies[k]));
    save();
    textareas.council.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ブラウザのconfirmダイアログを使わず、ボタンの二度押しで上書きを確認する
  let overwriteArmed = false;
  function confirmOverwrite() {
    const btn = $('#generate');
    if (overwriteArmed) { overwriteArmed = false; btn.textContent = '本文をつくる'; return true; }
    overwriteArmed = true;
    btn.textContent = '編集中の本文を上書きします。もう一度押してください';
    setTimeout(() => { overwriteArmed = false; btn.textContent = '本文をつくる'; }, 4000);
    return false;
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    BODY_KEYS.forEach((k) => (textareas[k].hidden = k !== t.dataset.tab));
  }));

  // ---------- 宛先ごとの差し込み ----------
  const place = (r) => (r.org || '').replace(/議会$/, '') || '貴自治体';
  const addressee = (r) => [r.org, r.title, r.person || BLANK].filter(Boolean).join('　') + '　様';

  function docName(r) {
    if (r.kind === 'council') return state.councilForm === 'seigan' ? '請願書' : '陳情書';
    return r.kind === 'mayor' ? '要望書' : '';
  }

  function coverAddressee(r) {
    return r.kind === 'council' && r.dept ? `${r.org}　${r.dept}　御中` : addressee(r);
  }

  function fill(text, r) {
    const s = state.sender;
    return text
      .replaceAll('{宛先}', place(r))
      .replaceAll('{日付}', formatDate())
      .replaceAll('{宛名}', coverAddressee(r))
      .replaceAll('{差出人}', senderBlock('団体'))
      .replaceAll('{書類名}', docName(r) || '書簡')
      .replaceAll('{部数}', String(bodiesFor(r).length || 1))
      .replaceAll('{連絡先}', [s.tel, s.email].filter(Boolean).join('／') || '（上記住所）');
  }

  function bodiesFor(r) {
    if (r.kind === 'member') return [textareas.member.value];
    return splitDocs(r.kind === 'council' ? textareas.council.value : textareas.mayor.value);
  }

  // 宛先1件ぶんの文書（陳情書なら求める事項の数だけ）を返す
  function documentsFor(r) {
    const date = `　　　　　　　　　　　　　　　　　　　　　　　　${formatDate()}`;
    if (r.kind === 'member') {
      return [fill([date, '', addressee(r).replace(/様$/, '先生'), '', textareas.member.value, '', senderBlock('団体')].join('\n'), r)];
    }
    const name = docName(r);
    const label = r.kind === 'council' ? (state.councilForm === 'seigan' ? '請願者' : '陳情者') : '要望者';
    const head = [date, '', `　　　　　　　　　　${name}`, '', addressee(r), ''];
    head.push(senderBlock('団体').replace('　　　　　　　　　　　　氏名', `　　　　　　　　　　　　${label}氏名`) + '　　　印');
    if (r.kind === 'council' && state.councilForm === 'seigan') {
      head.push('', `　　　　　　　　　　　　紹介議員　${state.introducer || BLANK}　　　印`);
    }
    head.push('');
    return bodiesFor(r).map((body) => fill([...head, body].join('\n'), r));
  }

  // ---------- 印刷 ----------
  const KANJI_NUM = { 0: '〇', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
  const toVertical = (s) => (s || '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[0-9]/g, (d) => KANJI_NUM[d])
    .replace(/[-－‐―]/g, '｜');

  function zaichu(r) {
    if (!$('#optZaichu').checked) return '';
    return r.kind === 'member' ? '親展' : `${docName(r)}在中`;
  }

  // A4に80×140mmの宛名を4件ずつ並べ、切り取って長形4号（90×205mm）に貼る
  function cutPiece(r, type) {
    const lines = (r.address || '').split(/\s+/).filter(Boolean);
    const z = zaichu(r);
    const dept = r.dept ? `<p class="dept">${esc(r.org)}　${esc(r.dept)}</p>` : '';
    if (type === 'v') {
      return `<div class="piece v">
        <div class="zip">〒${r.zip ? esc(r.zip) : '<span class="blank"></span>'}</div>
        <div class="v-addr">${lines.map((l) => `<p>${esc(toVertical(l))}</p>`).join('') || '<p><span class="blank long"></span></p>'}</div>
        <div class="v-name">${dept}<p>${escB(addressee(r))}</p></div>
        ${z ? `<div class="v-zaichu">${esc(z)}</div>` : ''}
      </div>`;
    }
    return `<div class="piece h">
      <p>〒${r.zip ? esc(r.zip) : '<span class="blank"></span>'}</p>${lines.map((l) => `<p>${esc(l)}</p>`).join('') || '<p><span class="blank long"></span></p>'}
      ${dept}<p class="h-name">${escB(addressee(r))}</p>
      ${z ? `<p class="h-zaichu">${esc(z)}</p>` : ''}
    </div>`;
  }

  function cutSheets(list, type) {
    const pages = [];
    for (let i = 0; i < list.length; i += 4) {
      pages.push(`<section class="cut-sheet">${list.slice(i, i + 4).map((r) => cutPiece(r, type)).join('')}</section>`);
    }
    return pages.join('');
  }

  function targets() {
    return state.recipients.filter((r) => r.print && r.org);
  }

  function envTargets() {
    return targets().filter((r) => !($('#optMailOnly').checked && r.mail === 'no'));
  }

  function updateSummary() {
    const t = targets();
    const unknown = t.filter((r) => r.mail === 'unknown').length;
    const noAddr = t.filter((r) => !r.address).length;
    const auto = t.filter((r) => r.autoAddr).length;
    $('#printSummary').innerHTML = `印刷対象：${t.length}件（封筒 ${envTargets().length}件）`
      + (unknown ? `<br>⚠ 郵送の扱いが「未確認」の宛先が${unknown}件あります。郵送分は審査されず配布のみになる議会もあります。` : '')
      + (noAddr ? `<br>⚠ 住所が未入力の宛先が${noAddr}件あります。` : '')
      + (auto ? `<br>⚠ 住所を自動で入れた宛先が${auto}件あります（役所の本庁舎の住所。国の2014年のデータ）。庁舎の移転や、議会事務局が別の建物にある場合があるので、各議会のサイトで確認してください。` : '');
  }

  $('#optMailOnly').addEventListener('change', updateSummary);

  $('#printAll').addEventListener('click', () => {
    const list = targets();
    if (!list.length) { $('#printSummary').textContent = '印刷する宛先がありません。宛先リストの「印刷」にチェックを入れてください。'; return; }
    const html = [];
    list.forEach((r) => {
      if ($('#optCover').checked && r.kind !== 'member') html.push(`<section class="doc">${escB(fill(textareas.cover.value, r))}</section>`);
      if ($('#optBody').checked) documentsFor(r).forEach((d) => html.push(`<section class="doc">${escB(d)}</section>`));
    });
    if ($('#optEnvelope').checked) {
      const type = $('#envType').value;
      const envList = envTargets();
      html.push(cutSheets(envList, type));
    }
    $('#printRoot').innerHTML = html.join('');
    window.print();
  });

  renderRecipients();
  renderPicker();
})();
