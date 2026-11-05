// かんたん作成：選択肢を押していくだけで陳情書を作る。文面の組み立ては petition.js の Petition.build を使う。
(() => {
  const { copy, esc, flash } = window.Common;
  const { withSender } = window.Petition;
  const $ = (id) => document.getElementById(id);
  const STEPS = ['type', 'items', 'pref', 'council', 'role', 'done'];
  const STEP_NAMES = { type: '何を求めるか', items: '求める内容', pref: '都道府県', council: '議会', role: 'あなたの立場' };

  const REGIONS = [
    ['北海道・東北', 0, 7], ['関東', 7, 14], ['中部', 14, 23], ['近畿', 23, 30],
    ['中国', 30, 35], ['四国', 35, 39], ['九州・沖縄', 39, 47],
  ];
  const ROLES = [...window.THEME.roles, ['none', '書かない', '']];

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
    renderMailOk();
    renderDeadline();
    renderCount();
  }

  // 郵送でも審査される議会は家から出せて行動しやすいので、都道府県ごとにまとめて勧める
  const mailOk = (pref) => councilsOf(pref).map((c) => idOf(pref, c)).filter((id) => (mailRule(infoOf(id)) || {}).c === 'ok');
  function renderMailOk() {
    const ids = mailOk(state.pref);
    const el = $('wzMailOk');
    el.hidden = !ids.length;
    if (el.hidden) return;
    const rest = ids.filter((id) => !state.councils.includes(id));
    el.innerHTML = `<p><b>📮 ${esc(state.pref)}で郵送でも審査される議会（${ids.length}）</b><br><span class="hint-sm">出向かなくても、家からまとめて送れます。</span></p>
      <div class="wz-grid">${ids.map((id) => { const on = state.councils.includes(id); return `<button type="button" class="wz-chip ${on ? 'on' : ''}" data-council="${esc(id)}" aria-pressed="${on}">${esc(nameOf(id))}</button>`; }).join('')}</div>
      ${rest.length ? `<button type="button" class="btn btn-small" data-mail-all="1">この${ids.length}つをまとめて選ぶ</button>` : ''}`;
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
  // 案内ページの一文から、郵送で出して審査してもらえるかを分ける。読み取れた議会だけで、書いていない議会は出さない
  // ok：郵送で出せる／jisan：審査してもらうには持参が必要／outside：住民以外の郵送は配付だけ／none：出し方に関わらず配付だけ
  function mailRule(info) {
    const fixed = { ok: '📮 郵送でも審査されます', jisan: '🚶 審査してもらうには持参が必要です（郵送は配付だけ）', outside: '🚶 住民以外が審査してもらうには持参が必要です（郵送は配付だけ）', none: '持参でも郵送でも、陳情は審査されず配付だけです' };
    if (info.mail) return { c: info.mail === 'outside' ? 'jisan' : info.mail, label: fixed[info.mail] };
    const t = [info.yusoNote, info.outsideNote].filter((x) => x && /郵送/.test(x)).join(' ');
    if (!t) return null;
    if (/関わらず|持参（または郵送）/.test(t)) return { c: 'none', label: '持参でも郵送でも、陳情は審査されず配付だけのようです' };
    if (/郵送[^。]{0,8}可/.test(t)) return { c: 'ok', label: '📮 郵送で出せます' };
    if (/(市|町|村)外[^。]{0,12}郵送|外に住所[^。]{0,12}郵送/.test(t)) return { c: 'jisan', label: '🚶 住民以外が審査してもらうには持参が必要です（郵送は配付だけ）' };
    if (/配布|配付|参考|審議[はを]?行わ|審査[はを]?行わ|報告はありません|持参してください/.test(t)) return { c: 'jisan', label: '🚶 審査してもらうには持参が必要です（郵送は配付だけ）' };
    return { c: 'ok', label: '📮 郵送でも受け付けます' };
  }
  const mailBadge = (info) => { const r = mailRule(info); return r ? `<span class="wz-mail ${r.c === 'ok' ? 'ok' : r.c === 'none' ? 'none' : 'jisan'}">${esc(r.label)}</span>` : ''; };
  const ONLY_HANDOUT = /配布|配付|参考資料/;
  function howTo(info) {
    const n = [];
    if (mailRule(info)) n.push(mailBadge(info));
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
    $('wzStepNo').textContent = s === 'done' ? '' : `${state.step + 1} / ${STEPS.length - 1}　${STEP_NAMES[s]}`;
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
    } else if (d.near) {
      // 近い議会を選んだら、その都道府県の議会の一覧へ進む（選んだ議会には印が付いている）
      state.pref = prefOf(d.near);
      if (!state.councils.includes(d.near)) state.councils.push(d.near);
      $('wzFilter').value = '';
      go(1);
    } else if (d.mailAll) {
      mailOk(state.pref).forEach((id) => { if (!state.councils.includes(id)) state.councils.push(id); });
      renderCouncils();
      $('wzNext').disabled = !canNext();
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
  $('wzOther').addEventListener('click', () => go(STEPS.indexOf('pref') - state.step));
  // 手紙の欄は閉じてあるので、開いてから移る
  $('wzToLetter')?.addEventListener('click', () => { $('letterFold').open = true; });
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
  // 公式サイトで確かめた郵送の扱い（data/mail.js）があれば、読み取った一文より優先する
  const infoOf = (c) => {
    const [pref, key] = officeKeys[c] || [];
    const info = (window.COUNCILS[pref] || {})[key] || {};
    const m = ((window.MAIL || {})[pref] || {})[key];
    return m ? { ...info, mail: m[0], yusoNote: m[1] } : info;
  };

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
  const EDITS_KEY = window.THEME.key('wz-edits');
  let edits = {};
  try { edits = JSON.parse(localStorage.getItem(EDITS_KEY)) || {}; } catch { edits = {}; }
  const saveEdits = () => { try { localStorage.setItem(EDITS_KEY, JSON.stringify(edits)); } catch { /* 保存できない環境では、この画面の間だけ残す */ } };
  const { swapCouncil } = window.Petition;
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
        <summary><b>${i + 1}. ${esc(it.label)}</b><span><i class="wz-edited"${e ? '' : ' hidden'}>直した文面・</i>${state.councils.length}通</span></summary>
        ${e && e.role !== state.role ? '<p class="hint-sm warn">立場を選び直す前に直した文面です。最後の一文があなたの立場に合っているか確かめてください。</p>' : ''}
        ${others.length ? `<p class="hint-sm">下は${esc(first)}あての文面です。${others.map(esc).join('・')}あてにも、同じ内容で1通ずつ作ります。ここで直すと、宛名と自治体名を差し替えてすべての議会に反映されます。</p>` : ''}
        <textarea class="wz-paper" rows="4" spellcheck="false" data-key="${esc(k)}" aria-label="${esc(it.label)}の文面">${esc(text)}</textarea>
        <p class="wz-docstat hint-sm" aria-live="polite"></p>
        <div class="out-toolbar"><button type="button" class="btn btn-small" data-doc-view="${i}">仕上がりを見る</button><button type="button" class="btn btn-small" data-doc-reset="${esc(k)}"${e ? '' : ' hidden'}>元の文面に戻す</button></div>
      </details>`;
    }).join('');
    areas().forEach((ta) => { fit(ta); docStat(ta); });
    $('wzLabels').href = `labels?c=${encodeURIComponent(state.councils.join(','))}`;
    $('wzSummary').textContent = `${state.councils.length}つの議会 × ${state.items.length}つの内容 ＝ 陳情書 ${state.councils.length * state.items.length}通`;
    renderOffices();
  }

  // 文面の欄は中身の長さに合わせて伸ばし、欄の中でスクロールしなくても全体を読めるようにする
  const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
  // 文字数と、直した文面が保存されたかを欄の下に出す
  const docStat = (ta, saved) => {
    const n = ta.value.replace(/\s/g, '').length;
    ta.closest('.wz-doc').querySelector('.wz-docstat').textContent = `${n.toLocaleString()}文字${saved ? '　✓ この端末に保存しました' : ''}`;
  };

  // 内容ごとの文面を、議会の数だけ広げる
  // 直していない内容は議会ごとに組み立て直す（「東京都」のような名前を本文ごと置き換えないように）
  const areas = () => [...$('wzDocs').querySelectorAll('textarea')];
  const docFor = (ta, c) => withSender(edits[ta.dataset.key] ? forCouncil(ta.value, c)
    : window.Petition.build(formData(), nameOf(c), [ta.dataset.key]), sender).trim();
  // 印刷するときは、議会ごとに鏡文（送付状）を先頭に重ねる（郵送で出すとき用。持参なら外せる）
  // 陳情書本体を外すと、鏡文だけ・宛名だけも印刷できる
  const withCover = (c, docs) => [
    ...($('wzCover').checked ? [window.Petition.cover(nameOf(c), docs, sender)] : []),
    ...($('wzBody').checked ? docs : []),
  ];
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
      doc.addLabels(window.PdfDoc.SHEETS.plain, window.PdfDoc.labelItems(rows, sender, { to: 'chair', zaichu: true, from: true, back: true }));
    }
    return { bytes: await doc.bytes(), sheets };
  }

  // 封筒ごとの重さの目安と、貼る切手
  function showPostage(sheets) {
    $('wzPostage').innerHTML = `<p><b>切手の目安（角2封筒・定形外郵便）</b></p><ul>${sheets.map(({ c, n }) => {
      const p = window.Postage.estimate(n);
      if (!p.yen) return `<li>${esc(label(c))}：${n}枚・約${p.g}g。郵便局の窓口で出してください。</li>`;
      return `<li>${esc(label(c))}：${n}枚・約${p.g}g → <b>${p.yen}円</b>（${p.limit}gまで）${p.safe ? `。ぎりぎりなので、心配なら<b>${p.safe}円</b>分貼っておくと安心です` : ''}</li>`;
    }).join('')}</ul><p class="hint-sm">クリアファイル1枚と、宛名・差出人のラベル、のりを含めた重さです。切手は多めに貼っても届きます（多い分は戻りません）。不安なときは郵便局の窓口で量ってもらうのが確実です。<a href="guide#send">送り方を見る</a></p>`;
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
  // 1通目の議会あての1通だけをPDFにして、新しいタブで開く（鏡文・宛名はつけない）
  // 開くのを待つとポップアップとして止められるので、タブは先に開いておく
  async function viewPdf(btn, ta) {
    const win = window.open('', '_blank');
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      const doc = await window.PdfDoc.create();
      doc.addDocument(docFor(ta, state.councils[0]));
      const url = URL.createObjectURL(new Blob([await doc.bytes()], { type: 'application/pdf' }));
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      if (win) win.close();
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
    fit(e.target);
    docStat(e.target, true);
    const d = e.target.closest('.wz-doc');
    d.querySelector('.wz-edited').hidden = false;
    d.querySelector('[data-doc-reset]').hidden = false;
  });
  // 閉じていた欄は高さを測れないので、開いたときに合わせ直す
  $('wzDocs').addEventListener('toggle', (e) => { if (e.target.open) fit(e.target.querySelector('textarea')); }, true);
  $('wzDocs').addEventListener('click', (e) => {
    const v = e.target.dataset.docView;
    if (v !== undefined) viewPdf(e.target, areas()[v]);
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


  // ---------- 持参するときの行き方 ----------
  // data/access.js：[緯度, 経度, 最寄り駅, 路線, 駅からの直線距離(m)]。道のりは直線の1.3倍、徒歩は分速80mとみる
  const accessOf = (pref, key) => ((window.ACCESS || {})[pref] || {})[key];
  const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`);
  function accessHtml(pref, key) {
    const a = accessOf(pref, key);
    if (!a) return '';
    const [lat, lng, st, line, d] = a;
    const walk = Math.ceil((d * 1.3) / 80);
    const train = d <= 2500
      ? `🚃 ${esc(st)}駅（${esc(line)}）から徒歩約${walk}分`
      : `🚃 最寄りの${esc(st)}駅（${esc(line)}）から約${km(d)}。バスかタクシーが便利です`;
    const to = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    return `<span class="wz-access">${train}</span>
        <span class="wz-links"><a href="${to}&travelmode=transit" target="_blank" rel="noopener">電車での行き方・運賃</a><a href="${to}&travelmode=driving" target="_blank" rel="noopener">車での行き方</a><span>（駐車場は公式サイトで確認してください）</span></span>`;
  }

  // 現在地から近い議会。都道府県をまたいで、直線距離の近い順に出す
  $('wzNearBtn').hidden = !navigator.geolocation || !window.ACCESS;
  $('wzNearBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '現在地を調べています…';
    navigator.geolocation.getCurrentPosition((p) => {
      const me = { lat: p.coords.latitude, lng: p.coords.longitude };
      const rad = Math.PI / 180;
      const dist = (a) => {
        const x = (a[1] - me.lng) * rad * Math.cos(((a[0] + me.lat) / 2) * rad);
        const y = (a[0] - me.lat) * rad;
        return Math.sqrt(x * x + y * y) * 6371000;
      };
      const near = window.Places.all()
        .map((pl) => ({ pl, a: accessOf(pl.pref, pl.key) }))
        .filter((x) => x.a)
        .map((x) => ({ ...x, d: dist(x.a) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 8);
      $('wzNear').innerHTML = near.map(({ pl, d }) => {
        councilsOf(pl.pref);
        return `<button type="button" class="wz-chip" data-near="${esc(idOf(pl.pref, pl.council))}">${esc(pl.council)}<small class="wz-n">約${km(d)}</small></button>`;
      }).join('');
      $('wzNear').hidden = false;
      btn.disabled = false;
      btn.textContent = '📍 現在地から近い議会を探す';
    }, () => {
      btn.disabled = false;
      btn.textContent = '現在地が分かりませんでした。もう一度試す';
    }, { timeout: 10000, maximumAge: 600000 });
  });

  // 電話：data/tel.js → [gikai：議会事務局の番号／main：公式サイトのトップにあった役所の番号, 番号, 載っていたページ]
  // 案内ページがない議会では、出し方・締切・郵送の扱いを電話で聞いてもらう
  function telHtml(pref, key, ask) {
    const t = ((window.TEL || {})[pref] || {})[key];
    if (!t) return '';
    const [kind, no, src] = t;
    const who = kind === 'gikai' ? '議会事務局' : '役所（「議会事務局につないでください」と伝える）';
    return `<span class="wz-tel">📞 ${who}：<a href="tel:${esc(no.replace(/-/g, ''))}">${esc(no)}</a>（<a href="${esc(src)}" target="_blank" rel="noopener">載っていたページ</a>）</span>
        ${ask ? '<span class="hint-sm">電話では「陳情を出したいので、出し方と次の締切、郵送でも審査されるか教えてください」と聞けば足ります。平日の昼間につながります。</span>' : ''}`;
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
        ${mailBadge(info) || '<span class="wz-mail none">郵送で審査してもらえるかは載っていませんでした（事務局に確認を）</span>'}
        <span class="wz-chair">⚠ 宛名の「議長」のあとに、議長の氏名を必ず書き入れてください（下の「議長名を調べる」で確認）。</span>
        ${accessHtml(pref, key)}
        ${notes(info)}
        ${telHtml(pref, key, !page)}
        ${page ? '' : '<span>陳情の出し方のページが見つかりませんでした。小さな議会では案内ページを置いていないことも多いので、議会事務局に電話で出し方と締切を聞くのが確実です。</span>'}
        <span class="wz-links">${links}</span>
        ${window.Report.enabled ? `<button type="button" class="btn btn-small wz-report" data-report="${esc(c)}" ${window.Report.reported(c) ? 'disabled' : ''}>${window.Report.reported(c) ? '✓ 提出を報告しました' : '出したら押す：この議会に提出した'}</button>` : ''}</li>`;
    }).join('');
  }

  // 印刷するものを1つも選んでいなければ、PDF を作らずに知らせる
  const picked = () => ['wzBody', 'wzCover', 'wzWithLabels'].some((id) => $(id).checked) || (flash('印刷するものを選んでください'), false);
  $('wzPdf').addEventListener('click', (e) => picked() && savePdf(e.currentTarget, envelopes(), { all: true }));

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
    const subject = `陳情書（${window.THEME.name}）`;
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
