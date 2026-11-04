// かんたん作成：選択肢を押していくだけで陳情書を作る。文面の組み立ては petition.js の Petition.build を使う。
(() => {
  const { copy, esc, flash } = window.Common;
  const { withSender } = window.Petition;
  const $ = (id) => document.getElementById(id);
  const STEPS = ['type', 'items', 'pref', 'council', 'role', 'done'];

  const REGIONS = [
    ['北海道・東北', 0, 7], ['関東', 7, 14], ['中部', 14, 23], ['近畿', 23, 30],
    ['中国', 30, 35], ['四国', 35, 39], ['九州・沖縄', 39, 47],
  ];
  const ROLES = [
    ['apart', '子どもと離れて暮らす親', '私自身、子どもと離れて暮らす親として、子どもが親の別居・離婚後も父母双方と関わり続けられる社会を願っています。'],
    ['grand', '孫と会えなくなった祖父母・親族', '私は孫と会えなくなった家族の一人として、子どもが家族とのつながりを保ち続けられる社会を願っています。'],
    ['parent', '子育て中の親', '子育て中の親として、どの子どもも父母双方から愛情を受けて育つことができる社会を願っています。'],
    ['citizen', '関心のある市民・支援者', '一市民として、親の別居・離婚によって子どもが一方の親との関係を失うことのない社会を願っています。'],
    ['none', '書かない', ''],
  ];

  const state = { step: 0, pref: '', councils: [], type: '', items: [], role: '' };

  // ---------- 選択肢の描画 ----------
  $('wzPrefs').innerHTML = REGIONS.map(([name, a, b]) => `
    <div class="wz-region"><span>${name}</span><div class="wz-grid">
      ${window.PREFS.slice(a, b).map((p) => `<button type="button" class="wz-chip" data-pref="${p}">${p}</button>`).join('')}
    </div></div>`).join('');

  // 議会名 → data/offices.js の鍵（都道府県庁は "@"、町村は郡名つき）
  // 同じ名前の市が別の県にもある（府中市・伊達市など）ので、選んだ議会は「都道府県/議会名」で持つ
  const officeKeys = {};
  const kanaOf = {};
  const idOf = (pref, name) => `${pref}/${name}`;
  const nameOf = (id) => id.slice(id.indexOf('/') + 1);
  const prefOf = (id) => id.slice(0, id.indexOf('/'));
  const names = () => state.councils.map(nameOf);
  function councilsOf(pref) {
    return window.Places.of(pref).map((pl) => {
      officeKeys[idOf(pref, pl.council)] = [pref, pl.key];
      // 読みも郡名（「…グン」）を外して、議会名と同じ範囲にする
      const kana = (window.KANA[pref] || {})[pl.key] || '';
      kanaOf[pl.council] = pl.gun && kana.includes('グン') ? kana.slice(kana.indexOf('グン') + 2) : kana;
      return pl.council;
    });
  }

  // 1つの議会に一度に多くの陳情を出すと、1件ごとの重みが薄れる（詳しい版と同じ目安）
  const { MANY } = window.Petition;
  function renderCount() {
    const s = STEPS[state.step];
    const el = $('wzCount');
    const n = state.items.length;
    el.hidden = !((s === 'items' || s === 'council') && n);
    if (el.hidden) return;
    const total = n * Math.max(1, state.councils.length);
    el.classList.toggle('warn', n > MANY);
    el.textContent = n > MANY
      ? `⚠ 1つの議会に${n}通を一度に出すと、1件ごとの重みが薄れます。優先したい内容を${MANY}つ以内に絞り、残りは次の定例会に回すのがおすすめです。（いまの選び方で ${total}通）`
      : state.councils.length ? `いまの選び方で、陳情書は ${total}通 になります。` : `内容1つにつき1通、陳情書ができます（いま${n}通）。`;
  }

  function renderCouncils() {
    const q = $('wzFilter').value.trim();
    $('wzCouncils').innerHTML = window.Yomi.filter(councilsOf(state.pref), q, (c) => kanaOf[c])
      .map((c, i) => {
        const id = idOf(state.pref, c);
        const on = state.councils.includes(id);
        const n = window.Report.count(id);
        return `<button type="button" class="wz-chip ${on ? 'on' : ''} ${i === 0 && !q ? 'wz-wide' : ''}" data-council="${id}" aria-pressed="${on}">${c}${window.Report.enabled ? `<small class="wz-n">${n ? `出した人 ${n}人` : 'まだ0人'}</small>` : ''}</button>`;
      })
      .join('') || `<p class="hint-sm wz-wide">「${esc(q)}」に当てはまる議会が見つかりません。${esc(state.pref)}以外の議会なら、下の「ほかの都道府県の議会も選ぶ」から選んでください。</p>`;
    $('wzPicked').textContent = state.councils.length ? `選択中：${state.councils.map(label).join('、')}` : '';
    renderDeadline();
    renderCount();
  }

  // 締切は作り終えてから気づくと間に合わないので、議会を選んだ時点で知らせる
  function renderDeadline() {
    const el = $('wzDeadline');
    el.hidden = !state.councils.length;
    if (el.hidden) return;
    el.innerHTML = `<p><b>⏰ 先に締切と出し方を確かめましょう。</b>締切は定例会（多くは2〜3月・6月・9月・12月）の1〜2週間前が多く、過ぎると次の定例会に回ります。住んでいない自治体の議会や郵送の陳情は、審査されず配布だけになることがあります。</p>
      <ul>${state.councils.map((c) => {
        const d = infoOf(c).deadline && clip(infoOf(c).deadline);
        const q = encodeURIComponent(`${search(c)} 陳情 提出 締切`);
        return `<li><b>${esc(label(c))}</b>：${d ? `「${esc(d)}」` : ''}<a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">締切を調べる</a>${howTo(infoOf(c))}</li>`;
      }).join('')}</ul>`;
  }

  // 出し方の目安。住民以外・郵送の陳情は配布だけになる議会があるので、作る前に選び直せるよう議会を選んだ時点で出す
  // 読み取れた議会は一部だけなので、書いていない議会は「わからない」として扱う
  const ONLY_HANDOUT = /配布|配付|参考資料/;
  function howTo(info) {
    const n = [];
    if (info.denshi) n.push('✅ 電子申請でも出せるようです。');
    const y = info.yusoNote && clip(info.yusoNote);
    if (y) n.push(`${ONLY_HANDOUT.test(y) ? '⚠ 郵送だと審査されないようです' : '郵送について'}：「${esc(y)}」`);
    const o = info.outsideNote && clip(info.outsideNote);
    if (o) n.push(`⚠ 住民以外の陳情について：「${esc(o)}」`);
    return n.length ? `<ul class="wz-notes">${n.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
  }

  function renderItems() {
    const scope = state.type === 'local' ? 'local' : 'national';
    $('wzItems').innerHTML = window.ASKS.filter((a) => a.scope === scope).map((a) => {
      const on = state.items.includes(a.id);
      const star = a.recommended ? '★ ' : '';
      return `<button type="button" class="wz-card ${on ? 'on' : ''}" data-item="${a.id}" aria-pressed="${on}"><b>${star}${a.label}</b><span>${a.reason.split('。')[0]}。</span></button>`;
    }).join('');
    renderCount();
  }

  $('wzRoles').innerHTML = ROLES.map(([k, label]) => `<button type="button" class="wz-card wz-small" data-role="${k}"><b>${label}</b></button>`).join('');

  // ---------- 画面の切り替え ----------
  function canNext() {
    const s = STEPS[state.step];
    return (s === 'pref' && state.pref) || (s === 'council' && state.councils.length)
      || (s === 'type' && state.type) || (s === 'items' && state.items.length) || (s === 'role' && state.role);
  }

  function show() {
    const s = STEPS[state.step];
    document.querySelectorAll('.wz-step').forEach((el) => (el.hidden = el.dataset.step !== s));
    $('wzBar').style.width = `${(state.step / (STEPS.length - 1)) * 100}%`;
    $('wzStepNo').textContent = s === 'done' ? '' : `${state.step + 1} / ${STEPS.length - 1}`;
    $('wzBack').hidden = state.step === 0;
    $('wzNext').hidden = s === 'done';
    $('wzNext').disabled = !canNext();
    $('wzRestart').hidden = s !== 'done';
    document.querySelectorAll('[data-pref]').forEach((b) => b.classList.toggle('on', b.dataset.pref === state.pref));
    document.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('on', b.dataset.type === state.type));
    document.querySelectorAll('[data-role]').forEach((b) => b.classList.toggle('on', b.dataset.role === state.role));
    $('wzPrefPicked').textContent = s === 'pref' && state.councils.length ? `選択中：${state.councils.map(label).join('、')}（ここで選んだ都道府県の議会を書き足せます）` : '';
    if (s === 'council') renderCouncils();
    if (s === 'items') renderItems();
    if (s === 'done') build();
    renderCount();
    saveLink(s === 'done');
  }

  // 画面が切り替わったら、新しい質問の見出しに読み上げ・キーボードの位置を移す
  function focusStep() {
    const h = document.querySelector('.wz-step:not([hidden]) h3');
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }

  function go(delta) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, state.step + delta));
    show();
    focusStep();
    $('wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 1つだけ選ぶ質問は、押したら次へ進む
  $('wizard').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.pref) {
      // 前に選んだ議会は残す（都道府県をまたいで選べるように）
      state.pref = d.pref;
      $('wzFilter').value = '';
      go(1);
    } else if (d.council) {
      const i = state.councils.indexOf(d.council);
      i < 0 ? state.councils.push(d.council) : state.councils.splice(i, 1);
      renderCouncils();
      $('wzNext').disabled = !canNext();
    } else if (d.type) {
      if (state.type !== d.type) state.items = window.ASKS.filter((a) => a.scope === (d.type === 'local' ? 'local' : 'national') && a.defaultOn && a.recommended).map((a) => a.id);
      state.type = d.type;
      go(1);
    } else if (d.item) {
      const i = state.items.indexOf(d.item);
      i < 0 ? state.items.push(d.item) : state.items.splice(i, 1);
      renderItems();
      $('wzNext').disabled = !canNext();
    } else if (d.role) {
      state.role = d.role;
      go(1);
    }
  });
  $('wzFilter').addEventListener('input', renderCouncils);
  $('wzMorePref').addEventListener('click', () => go(STEPS.indexOf('pref') - state.step));
  $('wzNext').addEventListener('click', () => canNext() && go(1));
  $('wzBack').addEventListener('click', () => go(-1));
  $('wzRestart').addEventListener('click', () => {
    Object.assign(state, { step: 0, pref: '', councils: [], type: '', items: [], role: '' });
    $('wzAiBox').hidden = true;
    $('wzSendBox').hidden = true;
    edits = {};
    saveEdits();
    go(0);
  });

  // ---------- 陳情書の作成 ----------
  // 議会ごとの情報（事務局の住所・提出方法の注意）。data/councils.js にあるのは自動で読み取ったもの
  const infoOf = (c) => { const [pref, key] = officeKeys[c] || []; return (window.COUNCILS[pref] || {})[key] || {}; };

  function formData() {
    const fd = new FormData();
    fd.append('type', state.type);
    state.items.forEach((k) => fd.append('items', k));
    fd.append('story', (ROLES.find(([k]) => k === state.role) || [])[2] || '');
    ['address', 'name', 'tel'].forEach((k) => fd.append(k, ''));
    return fd;
  }

  // 内容ごとに1つの欄で直す。2つ目以降の議会には、宛名と自治体名を差し替えて同じ文面を使う
  // 直した文面は内容ごとに、そのとき宛てた議会・立場と一緒に端末の中にだけ残す（再読み込み・選び直しで消えないように）
  const EDITS_KEY = 'wz-edits';
  let edits = {};
  try { edits = JSON.parse(localStorage.getItem(EDITS_KEY)) || {}; } catch { edits = {}; }
  const saveEdits = () => { try { localStorage.setItem(EDITS_KEY, JSON.stringify(edits)); } catch { /* 保存できない環境では、この画面の間だけ残す */ } };
  const placeOf = (c) => c.replace(/議会$/, '');
  const swapCouncil = (text, from, to) => (from === to ? text
    : text.split(from).join(to).split(placeOf(from)).join(placeOf(to)));
  const forCouncil = (text, c) => swapCouncil(text, nameOf(state.councils[0]), nameOf(c));

  function build() {
    const first = nameOf(state.councils[0]);
    const fd = formData();
    $('wzDocs').innerHTML = state.items.map((k, i) => {
      const it = window.ASKS.find((a) => a.id === k);
      const e = edits[k];
      // 前に別の議会あてに直した文面は、宛名と自治体名をいまの議会に差し替えて使う
      const text = withSender(e ? swapCouncil(e.text, e.council, first) : window.Petition.build(fd, first, [k]), sender);
      const others = state.councils.slice(1).map(label);
      return `<details class="wz-doc" ${i === 0 ? 'open' : ''}>
        <summary><b>${i + 1}. ${esc(it.label)}</b><span>${e ? '直した文面・' : ''}${state.councils.length}通</span></summary>
        ${e && e.role !== state.role ? '<p class="hint-sm warn">立場を選び直す前に直した文面です。最後の一文があなたの立場に合っているか確かめてください。</p>' : ''}
        ${others.length ? `<p class="hint-sm">下は${esc(first)}あての文面です。${others.map(esc).join('・')}あてにも、同じ内容で1通ずつ作ります。ここで直すと、宛名と自治体名を差し替えてすべての議会に反映されます。</p>` : ''}
        <textarea rows="16" data-key="${esc(k)}">${esc(text)}</textarea>
        <div class="out-toolbar"><button type="button" class="btn btn-small" data-doc-print="${i}">この内容だけPDFで保存（${state.councils.length}通）</button>${e ? `<button type="button" class="btn btn-small" data-doc-reset="${esc(k)}">元の文面に戻す</button>` : ''}</div>
      </details>`;
    }).join('');
    $('wzLabels').href = `/labels?c=${encodeURIComponent(state.councils.join(','))}`;
    $('wzSummary').textContent = `${state.councils.length}つの議会 × ${state.items.length}つの内容 ＝ 陳情書 ${state.councils.length * state.items.length}通`;
    renderOffices();
  }

  // 内容ごとの文面を、議会の数だけ広げる
  // 直していない内容は議会ごとに組み立て直す（「東京都」のような名前を本文ごと置き換えないように）
  const areas = () => [...$('wzDocs').querySelectorAll('textarea')];
  const docFor = (ta, c) => withSender(edits[ta.dataset.key] ? forCouncil(ta.value, c)
    : window.Petition.build(formData(), nameOf(c), [ta.dataset.key]), sender).trim();
  // 印刷するときは、議会ごとに鏡文（送付状）を先頭に重ねる（郵送で出すとき用。持参なら外せる）
  const withCover = (c, docs) => ($('wzCover').checked ? [window.Petition.cover(nameOf(c), docs, sender), ...docs] : docs);
  const expand = (ta) => state.councils.map((c) => ({ c, texts: withCover(c, [docFor(ta, c)]) }));
  const allDocs = () => state.councils.flatMap((c) => areas().map((ta) => docFor(ta, c)));
  // 議会ごとに、封筒に入れる文書（鏡文と陳情書）をまとめる
  const envelopes = () => state.councils.map((c) => ({ c, texts: withCover(c, areas().map((ta) => docFor(ta, c))) }));

  // ---------- PDF で保存 ----------
  // 文書を1つずつ新しいページから書き、封筒の表に貼る宛名と裏に貼る差出人（普通紙に8枚・切って貼る）を最後につける
  // 封筒ごとの枚数も返す（切手の目安に使う）
  async function makePdf(envs) {
    const doc = await window.PdfDoc.create();
    const sheets = envs.map(({ c, texts }) => ({ c, n: texts.reduce((a, t) => a + doc.addDocument(t), 0) }));
    if ($('wzWithLabels').checked) {
      const rows = envs.map(({ c }) => {
        const [pref, key] = officeKeys[c] || [];
        return { council: nameOf(c), ...window.Places.office(pref, key) };
      });
      doc.addLabels(window.PdfDoc.SHEETS.plain, window.PdfDoc.labelItems(rows, sender, { zaichu: true, from: true, back: true }));
    }
    return { bytes: await doc.bytes(), sheets };
  }

  // 封筒ごとの重さの目安と、貼る切手
  function showPostage(sheets) {
    $('wzPostage').innerHTML = `<p><b>切手の目安（角2封筒・定形外郵便）</b></p><ul>${sheets.map(({ c, n }) => {
      const p = window.Postage.estimate(n);
      if (!p.yen) return `<li>${esc(label(c))}：${n}枚・約${p.g}g。郵便局の窓口で出してください。</li>`;
      return `<li>${esc(label(c))}：${n}枚・約${p.g}g → <b>${p.yen}円</b>（${p.limit}gまで）${p.safe ? `。ぎりぎりなので、心配なら<b>${p.safe}円</b>分貼っておくと安心です` : ''}</li>`;
    }).join('')}</ul><p class="hint-sm">クリアファイル1枚と、宛名・差出人のラベル、のりを含めた重さです。切手は多めに貼っても届きます（多い分は戻りません）。不安なときは郵便局の窓口で量ってもらうのが確実です。<a href="/guide#send">送り方を見る</a></p>`;
    $('wzPostage').hidden = false;
  }
  const fileName = () => `陳情書_${nameOf(state.councils[0])}${state.councils.length > 1 ? `ほか${state.councils.length - 1}件` : ''}_${window.PdfDoc.today()}.pdf`;
  // all：すべての内容を保存したとき（このときだけ切手の目安を出す）
  async function savePdf(btn, envs, { share = false, all = false } = {}) {
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      const { bytes, sheets } = await makePdf(envs);
      if (all) showPostage(sheets);
      if (share) await window.PdfDoc.shareFile(bytes, fileName());
      else {
        window.PdfDoc.download(bytes, fileName());
        flash('PDFを保存しました');
      }
    } catch (e) {
      flash(`PDFを作れませんでした（${e.message}）。通信のよい所でもう一度試してください。`, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = text;
    }
  }
  $('wzDocs').addEventListener('input', (e) => {
    const k = e.target.dataset.key;
    if (!k) return;
    edits[k] = { text: e.target.value, council: nameOf(state.councils[0]), role: state.role };
    saveEdits();
  });
  $('wzDocs').addEventListener('click', (e) => {
    const i = e.target.dataset.docPrint;
    if (i !== undefined) savePdf(e.target, expand(areas()[i]));
    const k = e.target.dataset.docReset;
    if (k !== undefined) {
      delete edits[k];
      saveEdits();
      build();
    }
  });

  // 提出先：議会事務局の多くは本庁舎にあるので、その住所を出し、締切は公式サイトで調べてもらう
  // 都道府県をまたいで選んだときは、どこの議会かわかるよう都道府県名を添える
  const label = (c) => (new Set(state.councils.map(prefOf)).size > 1 && !nameOf(c).startsWith(prefOf(c)) ? `${nameOf(c)}（${prefOf(c)}）` : nameOf(c));
  const search = (c) => (nameOf(c).startsWith(prefOf(c)) ? nameOf(c) : `${prefOf(c)} ${nameOf(c)}`);
  // 案内ページから読み取った、提出のしかたで気をつけること
  // 自動で読み取ったので、サイトのメニューや書式一覧を拾ったものは出さず、長いものは切る
  const JUNK = /サイトマップ|文字サイズ|本文へ|メニュー|閉じる|ログイン|（PDF|（Word/;
  const clip = (t) => (JUNK.test(t) ? '' : t.length > 100 ? `${t.slice(0, 100)}…` : t);
  function notes(info) {
    const n = [];
    const add = (label, t) => { const c = t && clip(t); if (c) n.push(`${label}「${c}」`); };
    add('郵送：', info.yusoNote);
    add('住所が自治体の外の人：', info.outsideNote);
    add('締切：', info.deadline);
    if (info.denshi) n.push('電子申請でも出せるようです。');
    return n.length ? `<ul class="wz-notes">${n.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  }

  function renderOffices() {
    $('wzOffices').innerHTML = state.councils.map((c) => {
      const [pref, key] = officeKeys[c] || [];
      const info = infoOf(c);
      const [zip, addr] = info.office || (window.OFFICES[pref] || {})[key] || [];
      const q = encodeURIComponent(`${search(c)} 陳情 提出 締切`);
      const [site, page, council] = (window.SITES[pref] || {})[key] || [];
      const links = [
        page && `<a href="${esc(page)}" target="_blank" rel="noopener">陳情・請願の案内ページ</a>`,
        // 案内ページを持たない議会も多い。そのときは議会のページから事務局に問い合わせてもらう
        !page && council && `<a href="${esc(council)}" target="_blank" rel="noopener">議会のページ</a>`,
        // 案内ページが見つからなかった議会は、公式サイトの中だけを「陳情」で検索してもらう
        !page && site && `<a href="https://www.google.com/search?q=${encodeURIComponent(`site:${new URL(site).hostname} 陳情 OR 請願 議会`)}" target="_blank" rel="noopener">公式サイト内で「陳情」を検索</a>`,
        site && `<a href="${esc(site)}" target="_blank" rel="noopener">公式サイト</a>`,
        `<a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">${page ? '締切を検索' : '提出方法・締切を調べる'}</a>`,
        `<a href="https://www.google.com/search?q=${encodeURIComponent(`${search(c)} 議長`)}" target="_blank" rel="noopener">議長名を調べる</a>`,
      ].filter(Boolean).join('');
      return `<li><b>${esc(label(c))}事務局</b>
        <span>${addr ? `${zip ? '〒' + esc(zip) + '　' : ''}${esc(addr)}${info.office ? '' : '（本庁舎）'}` : '住所は公式サイトで確認してください'}</span>
        ${notes(info)}
        ${page ? '' : '<span>陳情の出し方のページが見つかりませんでした。小さな議会では案内ページを置いていないことも多いので、議会事務局に電話で出し方と締切を聞くのが確実です。</span>'}
        <span class="wz-links">${links}</span>
        ${window.Report.enabled ? `<button type="button" class="btn btn-small wz-report" data-report="${esc(c)}" ${window.Report.reported(c) ? 'disabled' : ''}>${window.Report.reported(c) ? '✓ 提出を報告しました' : '出したら押す：この議会に提出した'}</button>` : ''}</li>`;
    }).join('');
  }

  $('wzPdf').addEventListener('click', (e) => savePdf(e.currentTarget, envelopes(), { all: true }));
  $('wzShare').hidden = !window.PdfDoc.canShareFiles();
  $('wzShare').addEventListener('click', (e) => savePdf(e.currentTarget, envelopes(), { share: true, all: true }));

  // 差出人（あなた）の住所・氏名。入れるとすぐ、下の文面の住所・氏名の行に入る
  const sender = window.Common.bindSender($('wzSender'), () => {
    areas().forEach((ta) => { ta.value = withSender(ta.value, sender); });
  });
  $('wzSenderClear').addEventListener('click', () => {
    window.Common.forgetSender();
    $('wzSender').querySelectorAll('[data-sender]').forEach((el) => { el.value = ''; sender[el.dataset.sender] = ''; });
    areas().forEach((ta) => { ta.value = withSender(ta.value, sender); });
    window.Common.flash('この端末から住所・氏名を消しました');
  });

  // 提出の報告：議会ごとの件数を集めて、まだ誰も出していない議会に人を向ける
  $('wzOffices').addEventListener('click', async (e) => {
    const id = e.target.dataset.report;
    if (!id) return;
    e.target.disabled = true;
    const ok = await window.Report.report(id);
    e.target.textContent = ok ? '✓ 提出を報告しました。ありがとうございます' : '送れませんでした。もう一度押してください';
    e.target.disabled = ok;
  });
  // 件数が届いたら、議会・都道府県の選択肢に反映する
  $('wzCountHint').hidden = !window.Report.enabled;
  window.Report.loaded.then(() => {
    document.querySelectorAll('[data-pref]').forEach((b) => {
      const n = window.Report.prefCount(b.dataset.pref);
      if (n) b.title = `${n}つの議会に提出の報告があります`;
    });
    if (STEPS[state.step] === 'council') renderCouncils();
  });
  $('wzCopy').addEventListener('click', () => copy(allDocs().join(`\n\n${window.Petition.SEP}\n\n`)));

  // ---------- 選んだ内容をリンクに残す（再読み込み・スマホへの受け渡し用。個人情報は入れない） ----------
  function linkOf() {
    const q = new URLSearchParams({ t: state.type, i: state.items.join(','), p: state.pref, c: state.councils.join(','), r: state.role });
    return `${location.origin}${location.pathname}#w?${q}`;
  }
  function saveLink(done) {
    const url = done ? linkOf() : location.pathname + location.search;
    if (location.href !== url) history.replaceState(null, '', url);
  }
  function restore() {
    const m = location.hash.match(/^#w\?(.*)$/);
    if (!m) return false;
    const q = new URLSearchParams(m[1]);
    const t = q.get('t');
    const scope = t === 'local' ? 'local' : 'national';
    const items = (q.get('i') || '').split(',').filter((k) => window.ASKS.some((a) => a.id === k && a.scope === scope));
    const pref = q.get('p');
    if (!['local', 'ikensho'].includes(t) || !items.length || !window.PREFS.includes(pref)) return false;
    // 前の形式のリンク（議会名だけ）は、p の都道府県の議会として読む
    const councils = (q.get('c') || '').split(',').map((c) => (c.includes('/') ? c : idOf(pref, c)))
      .filter((c) => window.PREFS.includes(prefOf(c)) && councilsOf(prefOf(c)).includes(nameOf(c)));
    const role = q.get('r');
    if (!councils.length || !ROLES.some(([k]) => k === role)) return false;
    Object.assign(state, { type: t, items, pref, councils, role, step: STEPS.indexOf('done') });
    return true;
  }

  $('wzSend').addEventListener('click', () => {
    const url = linkOf();
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('wzQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    const subject = '陳情書（子どもの権利を守る陳情アクション）';
    $('wzMail').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`あとで開く陳情書のリンク：\n${url}`)}`;
    $('wzShare').hidden = !navigator.share;
    $('wzShare').onclick = () => navigator.share({ title: subject, url }).catch(() => {});
    $('wzSendBox').hidden = false;
  });
  $('wzLinkCopy').addEventListener('click', () => copy(linkOf(), 'リンクをコピーしました'));
  $('wzAi').addEventListener('click', () => {
    $('wzPrompt').value = window.Petition.buildPrompt(formData(), names());
    $('wzAiBox').hidden = false;
    $('wzAiBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (restore()) {
    show();
    $('generator').scrollIntoView();
  } else show();
})();
