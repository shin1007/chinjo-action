// かんたん作成：選択肢を押していくだけで陳情書を作る。文面の組み立ては petition.js の Petition.build を使う。
(() => {
  const { copy, esc, flash } = window.Common;
  const { withSender } = window.Petition;
  const $ = (id) => document.getElementById(id);
  // 最初の3つが選ぶ画面。そのあとに、できあがった文面の画面と、署名して出す画面が続く
  const STEPS = ['items', 'council', 'you', 'done', 'send'];
  const ASK_STEPS = 3;
  const STEP_NAMES = {
    items: '求める内容',
    council: '自治体',
    you: 'あなた',
    done: '文面確認',
    send: '印刷・提出',
  };

  const REGIONS = [
    ['北海道・東北', 0, 7], ['関東', 7, 14], ['中部', 14, 23], ['近畿', 23, 30],
    ['中国', 30, 35], ['四国', 35, 39], ['九州・沖縄', 39, 47],
  ];
  const ROLES = [...window.THEME.roles, ['none', '書かない', '']];

  // 最初は、おすすめ（★）で初めから選んである項目を選んでおく
  const firstItems = () => [];
  // テーマのページで「要望書」を選んで来たときは ?kind=request が付いている
  const startKind = () => (new URLSearchParams(location.search).get('kind') === 'request' ? 'request' : 'petition');
  const state = { step: 0, pref: '', councils: [], items: firstItems(), role: '', kind: startKind(), merge: false };
  const kindInputs = () => document.querySelectorAll('input[name="wzKind"]');
  const setKindInputs = () => kindInputs().forEach((r) => { r.checked = r.value === state.kind; });

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
  const placeOf = (id) => (window.Places.of(prefOf(id)).find((p) => p.council === nameOf(id)) || {});
  const municipalityName = (id) => placeOf(id).name || nameOf(id).replace(/議会$/, '');
  // 議会を選ばずに作るときは、議会名を空けた宛先を1つだけ置く（議会名と議長名は手書きで入れる）
  const NONE = '/　　　　　　議会';
  const isNone = (c) => c === NONE;
  const real = () => state.councils.filter((c) => !isNone(c));
  const names = () => real().map(nameOf);
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
  // 選んだ内容をまとめて1通にできるか。国あて（意見書）と自治体あてが混ざると文書の種類が決められないので、
  // どちらかにそろっていて、記の項目が五までのときだけ
  const MERGE_MAX = 5;
  const isNat = (k) => window.Petition.ITEMS[k].scope !== 'local';
  const canMerge = () => state.items.length >= 2 && state.items.length <= MERGE_MAX
    && new Set(state.items.map(isNat)).size === 1;
  // 1通ごとの内容のキー。まとめるときは「a+b+c」の1つ
  const docKeys = () => (state.merge && canMerge() ? [state.items.join('+')] : [...state.items]);
  const keysOf = (k) => k.split('+');
  const docLabel = (k) => keysOf(k).map((x) => window.Petition.ITEMS[x].label).join('・');
  function renderCount() {
    const s = STEPS[state.step];
    const el = $('wzCount');
    const n = state.items.length;
    el.hidden = !((s === 'items' || s === 'council') && n);
    if (el.hidden) return;
    const total = docKeys().length * Math.max(1, state.councils.length);
    el.classList.toggle('warn', n > MANY);
    el.classList.toggle('multi', total > 1);
    const destination = state.kind === 'request' ? '自治体' : '議会';
    const document = state.kind === 'request' ? '要望書' : '陳情書';
    el.textContent = n > MANY
      ? `⚠ ${document} ${total}通。1つの${destination}に${n}通では1件ごとの重みが薄れます。${MANY}つ以内に絞るのがおすすめです`
      : `${document} ${total}通ができます（内容${n} × ${destination}${Math.max(1, real().length)}）`;
  }

  function renderCouncils() {
    const q = $('wzFilter').value.trim();
    $('wzCouncils').innerHTML = window.Yomi.filter(councilsOf(state.pref), q, (c) => kanaOf[c])
      .map((c, i) => {
        const id = idOf(state.pref, c);
        const on = state.councils.includes(id);
        const n = window.Report.count(id);
        const name = municipalityName(id);
        return `<button type="button" class="wz-chip ${on ? 'on' : ''} ${i === 0 && !q ? 'wz-wide' : ''}" data-council="${id}" aria-pressed="${on}">${esc(name)}${state.kind === 'petition' ? chipMail(id) : ''}${state.kind === 'petition' && window.Report.enabled ? `<small class="wz-n">${n ? `提出報告 ${n}件` : 'まだ報告なし'}</small>` : ''}</button>`;
      })
      .join('') || `<p class="hint-sm wz-wide">「${esc(q)}」に当てはまる議会が見つかりません。${esc(state.pref)}以外の議会なら、上の都道府県から選んでください。</p>`;
    $('wzPicked').textContent = state.councils.length ? `選択中：${state.councils.map(label).join('、')}` : '';
    renderMailOk();
    renderDeadline();
    renderCount();
  }

  // 郵送でも審査される議会と、郵送だと議員に配付される議会は、都道府県を選ぶ前に全国分を見せる
  // （家から出せる議会を先に知ってもらう。配付だけでも議員に読んでもらえる）
  // 一覧は長いので、都道府県のボタンの上に折りたたんで置く
  const mailHandout = (pref) => councilsOf(pref).map((c) => idOf(pref, c)).filter((id) => { const r = mailRule(infoOf(id)); return r && r.c !== 'ok'; });
  const MAIL_BOXES = [
    [(p) => mailOk(p), 'ok', '📮 郵送で審査', '📮 郵送でも審査されるとわかっている議会', '家から送るだけで審査してもらえます。'],
    [mailHandout, 'jisan', '📮 郵送で配付', '📮 郵送すると議員に配付される議会', '審査はされなくても、陳情書の写しが議員に配られて読んでもらえます。持参すれば審査される議会や、住民なら審査される議会もあります（議会を選ぶ画面で議会ごとに出ます）。'],
  ].map((x) => { const el = document.createElement('details'); el.className = `wz-mailok ${x[1]}`; $('wzPrefs').before(el); return [el, ...x]; });
  function renderMailAll() {
    MAIL_BOXES.forEach(([box, list, c, badge, title, note]) => {
      box.hidden = state.kind === 'request';
      const groups = window.PREFS.map((p) => [p, list(p)]).filter(([, ids]) => ids.length);
      const n = groups.reduce((a, [, ids]) => a + ids.length, 0);
      document.querySelectorAll('[data-pref]').forEach((b) => {
        const k = (groups.find(([p]) => p === b.dataset.pref) || [])[1];
        if (k && !b.querySelector(`.wz-mk.${c}`)) b.insertAdjacentHTML('beforeend', `<small class="wz-mk ${c}">${badge} ${k.length}</small>`);
      });
      const open = box.open;
      box.innerHTML = `<summary><b>${title}（全国${n}）</b></summary><p class="hint-sm">${note}押すと選ばれ、下にその都道府県の議会の一覧が出ます。まだ調べきれていない議会も多いので、ここにない議会のほうが多くあります。</p>
        ${groups.map(([p, ids]) => `<div class="wz-region"><span>${esc(p)}</span><div class="wz-grid">${ids.map((id) => { const on = state.councils.includes(id); return `<button type="button" class="wz-chip ${on ? 'on' : ''}" data-mail-pick="${esc(id)}" aria-pressed="${on}">${esc(nameOf(id))}${c === 'ok' ? '' : chipMail(id)}</button>`; }).join('')}</div></div>`).join('')}`;
      box.open = open;
    });
  }

  // 審査されなくても議員に配付されるだけで読んでもらえるので、選ぶときに郵送の扱いを議会ごとに短く出す
  function chipMail(id) {
    const info = infoOf(id);
    const r = mailRule(info);
    if (!r) return '';
    const t = r.c === 'ok' ? '📮 郵送で審査' : /住民以外/.test(r.label) ? '📮 住民以外の郵送は配付' : r.c === 'none' ? '📮 郵送で配付（審査なし）' : '📮 郵送は配付（審査は持参）';
    return `<small class="wz-mk ${r.c}">${t}</small>`;
  }

  // 郵送でも審査される議会は家から出せて行動しやすいので、都道府県ごとにまとめて勧める
  const mailOk = (pref) => councilsOf(pref).map((c) => idOf(pref, c)).filter((id) => (mailRule(infoOf(id)) || {}).c === 'ok');
  function renderMailOk() {
    const ids = mailOk(state.pref);
    if (state.kind === 'request') { $('wzMailOk').hidden = true; return; }
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
    if (state.kind === 'request') { el.hidden = true; return; }
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
    if (info.policy) {
      const { mail_resident: resident, mail_nonresident: nonresident } = info.policy;
      if (resident === 'distribute' && nonresident === 'distribute') return { c: 'none', label: fixed.none };
      if (resident === 'distribute') return { c: 'jisan', label: fixed.jisan };
      if (resident === 'ok' && nonresident === 'distribute') return { c: 'outside', label: fixed.outside };
      if (resident === 'ok' && nonresident === 'ok') return { c: 'ok', label: fixed.ok };
      return { c: 'unknown', label: '郵送時の扱いは未確認です（公式案内を確認してください）' };
    }
    if (info.mail) return { c: info.mail === 'outside' ? 'jisan' : info.mail, label: fixed[info.mail] };
    const t = [info.yusoNote, info.outsideNote].filter((x) => x && /郵送/.test(x)).join(' ');
    if (!t) return null;
    if (/関わらず|持参（または郵送）/.test(t)) return { c: 'none', label: '持参でも郵送でも、陳情は審査されず配付だけのようです' };
    if (/郵送[^。]{0,8}可/.test(t)) return { c: 'ok', label: '📮 郵送で出せます' };
    if (/(市|町|村)外[^。]{0,12}郵送|外に住所[^。]{0,12}郵送/.test(t)) return { c: 'jisan', label: '🚶 住民以外が審査してもらうには持参が必要です（郵送は配付だけ）' };
    if (/配布|配付|参考|審議[はを]?行わ|審査[はを]?行わ|報告はありません|持参してください/.test(t)) return { c: 'jisan', label: '🚶 審査してもらうには持参が必要です（郵送は配付だけ）' };
    return { c: 'ok', label: '📮 郵送でも受け付けます' };
  }
  const mailBadge = (info) => { const r = mailRule(info); return r ? `<span class="wz-mail ${r.c === 'ok' ? 'ok' : r.c === 'none' ? 'none' : r.c === 'unknown' ? 'unknown' : 'jisan'}">${esc(r.label)}</span>` : ''; };
  const ONLY_HANDOUT = /配布|配付|参考資料/;
  function howTo(info) {
    const n = [];
    if (mailRule(info)) n.push(mailBadge(info));
    if (info.denshi) n.push('✅ 電子申請でも出せるようです。');
    if (info.policy) {
      const q = clip(info.policy.source_quote);
      if (q) n.push(`公式案内：「${esc(q)}」`);
      const note = clip(info.policy.note);
      if (note) n.push(`補足：「${esc(note)}」`);
      if (info.policy.source_url) n.push(`<a href="${esc(info.policy.source_url)}" target="_blank" rel="noopener">公式案内の根拠を見る</a>`);
      if (info.policy.confidence !== 'confirmed') n.push('⚠ この情報は確定情報ではありません。提出前に議会事務局へ確認してください。');
    } else {
      const y = info.yusoNote && clip(info.yusoNote);
      if (y) n.push(`${ONLY_HANDOUT.test(y) ? '⚠ 郵送だと審査されないようです' : '郵送について'}：「${esc(y)}」`);
      const o = info.outsideNote && clip(info.outsideNote);
      if (o) n.push(`⚠ 住民以外の陳情について：「${esc(o)}」`);
    }
    return n.length ? `<ul class="wz-notes">${n.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
  }

  // 項目は見出しごとに折りたたむ。選んだ項目がある見出しと、最初の見出しは開いておく
  const openCats = new Set();
  // 要望書は自治体あての文書なので、国への意見書を求める項目は選べない
  const usable = (a) => state.kind !== 'request' || !window.Petition.isNational(a);
  const catCount = (cat) => {
    const n = cat.querySelectorAll('[data-item].on').length;
    return `${cat.querySelectorAll('[data-item]').length}件${n ? `・<b>${n}件選択中</b>` : ''}`;
  };
  function renderItems() {
    state.items = state.items.filter((k) => window.Petition.ITEMS[k] && usable(window.Petition.ITEMS[k]));
    const groups = new Map();
    window.Petition.ordered().filter(usable).forEach((a) => {
      const k = a.category || 'そのほか';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    });
    $('wzItems').innerHTML = [...groups].map(([cat, list], gi) => {
      const open = openCats.has(cat) || list.some((a) => state.items.includes(a.id)) || (gi === 0 && !openCats.size);
      return `<details class="wz-cat" data-cat="${esc(cat)}"${open ? ' open' : ''}><summary><span>${esc(cat)}</span><small class="wz-cat-n"></small></summary><div class="wz-cards">${list.map((a) => {
        const on = state.items.includes(a.id);
        return `<button type="button" class="wz-card ${on ? 'on' : ''}" data-item="${a.id}" aria-pressed="${on}" data-text="${esc(a.label + a.reason)}"><b>${a.label}${window.Common.scopeTag(a)}</b><span>${a.reason.split('。')[0]}。</span></button>`;
      }).join('')}</div></details>`;
    }).join('');
    document.querySelectorAll('#wzItems .wz-cat').forEach((cat) => { cat.querySelector('.wz-cat-n').innerHTML = catCount(cat); });
    filterItems();
    renderCount();
  }
  function filterItems() {
    const q = $('wzItemFilter').value.trim();
    document.querySelectorAll('#wzItems .wz-cat').forEach((d) => {
      let hit = 0;
      d.querySelectorAll('[data-item]').forEach((el) => { const ok = !q || el.dataset.text.includes(q); el.hidden = !ok; hit += ok; });
      d.hidden = !hit;
      if (q && hit) d.open = true;
    });
  }
  $('wzItemFilter').addEventListener('input', filterItems);
  $('wzItems').addEventListener('toggle', (e) => {
    const c = e.target.dataset && e.target.dataset.cat;
    if (c && !$('wzItemFilter').value) (e.target.open ? openCats.add(c) : openCats.delete(c));
  }, true);

  $('wzRoles').innerHTML = ROLES.map(([k, label]) => `<button type="button" class="wz-card wz-small" data-role="${k}"><b>${label}</b></button>`).join('');
  setKindInputs();
  kindInputs().forEach((r) => r.addEventListener('change', () => {
    state.kind = r.value;
    if (state.step === 0) renderItems();
    updateNav();
    if (state.step >= ASK_STEPS) build();
    else if (state.step === 1) show();
    saveDraft();
  }));

  // ---------- 画面の切り替え ----------
  function canNext() {
    const s = STEPS[state.step];
    return (s === 'council' && state.councils.length) || (s === 'items' && state.items.length) || (s === 'you' && state.role) || s === 'done';
  }

  // 押せない理由を［次へ］のそばに出す
  function whyNotNext() {
    const s = STEPS[state.step];
    if (s === 'items' && !state.items.length) return '求める内容を1つ以上選んでください（いくつでも選べます）。';
    if (s === 'council' && !state.councils.length) return '自治体を選ぶか、「自治体を選ばずに作る」を押してください。';
    if (s === 'you' && !state.role) return '①あなたの立場を選んでください（住所・氏名は空のままでもかまいません）。';
    return '';
  }
  // 内容を選んだ段階で、できあがる文面の見本を見せる（住所・氏名と提出先は空けたまま）
  function renderPreview() {
    const box = $('wzPreview');
    const k = state.items[state.items.length - 1];
    box.hidden = STEPS[state.step] !== 'items' || !k;
    if (box.hidden) return;
    const it = window.Petition.ITEMS[k];
    $('wzPreviewTitle').textContent = `「${it.label}」の文面の見本を見る`;
    $('wzPreviewText').textContent = window.Petition.build(formData(), '〇〇市', [k]);
  }
  function updateNav() {
    $('wzNext').disabled = !canNext();
    $('wzNextWhy').textContent = whyNotNext();
    renderPreview();
  }

  function show() {
    const s = STEPS[state.step];
    if (state.councils.length > 1) state.councils = real();
    document.querySelectorAll('.wz-step').forEach((el) => (el.hidden = el.dataset.step !== s));
    const progress = state.step / (STEPS.length - 1);
    $('wzBar').style.width = `${progress * 100}%`;
    $('wzProgress').setAttribute('aria-valuenow', String(state.step + 1));
    $('wzStepNo').textContent = `${state.step + 1} / ${STEPS.length}　${STEP_NAMES[s]}`;
    document.querySelectorAll('[data-progress-step]').forEach((el, i) => {
      el.classList.toggle('is-current', i === state.step);
      el.classList.toggle('is-done', i < state.step);
      // 済んだステップは押すと戻れる
      if (i < state.step) {
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${el.textContent}にもどる`);
      } else ['tabindex', 'role', 'aria-label'].forEach((k) => el.removeAttribute(k));
    });
    $('wzBack').hidden = state.step === 0;
    $('wzNext').hidden = s === 'send';
    $('wzNext').textContent = s === 'done' ? '署名して出す →' : '次へ →';
    updateNav();
    $('wzRestart').hidden = state.step < ASK_STEPS;
    document.querySelectorAll('[data-pref]').forEach((b) => b.classList.toggle('on', b.dataset.pref === state.pref));
    document.querySelectorAll('[data-role]').forEach((b) => b.classList.toggle('on', b.dataset.role === state.role));
    $('wzPrefPicked').textContent = s === 'council' && real().length ? `選択中：${real().map(label).join('、')}（ほかの都道府県を選ぶと、その議会も書き足せます）` : '';
    // 都道府県を選ぶと、同じ画面の下にその都道府県の議会の一覧を出す
    $('wzCouncilBox').hidden = !state.pref;
    $('wzNearBtn').hidden = state.kind === 'request' || !navigator.geolocation || !window.ACCESS;
    $('wzNear').hidden = state.kind === 'request';
    if (s === 'council') {
      renderMailAll();
      if (state.pref) {
        $('wzCouncilTitle').textContent = `${state.pref}の自治体`;
        renderCouncils();
      }
    }
    if (s === 'items') renderItems();
    if (s === 'done') $('wzCheck').open = true;
    if (s === 'send') { renderCheckMail(); renderCheckLeft(); renderNow(); renderChairs(); }
    if (state.step >= ASK_STEPS) build();
    renderCount();
    saveLink(state.step >= ASK_STEPS);
    saveDraft();
  }

  // 画面が切り替わったら、新しい質問の見出しに読み上げ・キーボードの位置を移す
  function focusStep() {
    const h = document.querySelector('.wz-step:not([hidden]) h3');
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }

  function go(delta) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, state.step + delta));
    history.pushState({ step: state.step }, '', location.pathname + location.search);
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
      showCouncils();
    } else if (d.near) {
      // 近い議会を選んだら、その都道府県の議会の一覧へ進む（選んだ議会には印が付いている）
      state.pref = prefOf(d.near);
      if (!state.councils.includes(d.near)) state.councils.push(d.near);
      $('wzFilter').value = '';
      showCouncils();
    } else if (d.addNear) {
      // ④の近くの議会を宛先に加えて、陳情書を作り直す
      if (!state.councils.includes(d.addNear)) state.councils.push(d.addNear);
      show();
      // 増えたことが分かるように、いまの通数を知らせる
      const n = docKeys().length * state.councils.length;
      flash(`${label(d.addNear)}を加えました。いま${state.kind === 'request' ? '要望書' : '陳情書'}は全部で${n}通です`);
      renderNow(true);
    } else if (d.mailPick) {
      const i = state.councils.indexOf(d.mailPick);
      i < 0 ? state.councils.push(d.mailPick) : state.councils.splice(i, 1);
      if (i < 0) state.pref = prefOf(d.mailPick);
      show();
    } else if (d.mailAll) {
      mailOk(state.pref).forEach((id) => { if (!state.councils.includes(id)) state.councils.push(id); });
      renderCouncils();
      updateNav();
    } else if (d.global) {
      // 全国から探した議会・前に選んだ議会を選ぶと、その都道府県の一覧を開く
      if (!state.councils.includes(d.global)) state.councils.push(d.global);
      state.pref = prefOf(d.global);
      $('wzGlobal').value = '';
      $('wzGlobalHits').innerHTML = '';
      $('wzFilter').value = '';
      showCouncils();
    } else if (d.council) {
      const i = state.councils.indexOf(d.council);
      i < 0 ? state.councils.push(d.council) : state.councils.splice(i, 1);
      renderCouncils();
      updateNav();
    } else if (d.item) {
      const i = state.items.indexOf(d.item);
      i < 0 ? state.items.push(d.item) : state.items.splice(i, 1);
      // 描き直すと開いた見出しや位置が動くので、押したボタンと件数だけを直す
      b.classList.toggle('on', i < 0);
      b.setAttribute('aria-pressed', String(i < 0));
      const cat = b.closest('.wz-cat');
      cat.querySelector('.wz-cat-n').innerHTML = catCount(cat);
      renderCount();
      saveDraft();
      updateNav();
    } else if (d.role) {
      state.role = d.role;
      show();
    }
  });
  function showCouncils() {
    show();
    $('wzCouncilBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.addEventListener('popstate', (e) => {
    state.step = e.state && Number.isInteger(e.state.step) ? e.state.step : 0;
    show();
    focusStep();
    $('wizard').scrollIntoView({ block: 'start' });
  });
  $('wzSkip').addEventListener('click', () => {
    state.councils = [NONE];
    go(STEPS.indexOf('you') - state.step);
  });
  $('wzFilter').addEventListener('input', renderCouncils);
  $('wzMorePref').addEventListener('click', () => $('wzPrefs').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('wzOther').addEventListener('click', () => go(STEPS.indexOf('council') - state.step));
  $('wzNext').addEventListener('click', () => canNext() && go(1));
  $('wzBack').addEventListener('click', () => go(-1));
  $('wzRestart').addEventListener('click', () => {
    if (!confirm('選んだ議会と内容、直した文面が消えます。最初からやり直しますか？')) return;
    Object.assign(state, { step: 0, pref: '', councils: [], items: firstItems(), role: '', kind: startKind(), merge: false });
    setKindInputs();
    $('wzItemFilter').value = '';
    clearDraft();
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
    const policy = window.MailPolicy && window.MailPolicy.get(pref, key);
    return m ? { ...info, mail: m[0], yusoNote: m[1], policy } : { ...info, policy };
  };

  function formData() {
    const fd = new FormData();
    state.items.forEach((k) => fd.append('items', k));
    fd.append('kind', state.kind);
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
    renderMerge();
    const keys = docKeys();
    $('wzDocs').innerHTML = keys.map((k, i) => {
      const it = { label: docLabel(k) };
      const e = edits[k];
      // 前の日に直した文面は、日付だけを今日にする（出す日に合わせて直すのは、この欄でできる）
      if (e && e.day !== window.Common.reiwaToday()) {
        e.text = e.text.replace(/^(\s*)令和.{1,3}年\d{1,2}月\d{1,2}日/, `$1${window.Common.reiwaToday()}`);
        e.day = window.Common.reiwaToday();
        saveEdits();
      }
      // 前に別の議会あてに直した文面は、宛名と自治体名をいまの議会に差し替えて使う
      const text = withSender(e ? swapCouncil(e.text, e.council, first) : window.Petition.build(fd, first, keysOf(k)), sender);
      const others = state.councils.slice(1).map(label);
      return `<details class="wz-doc" ${i === 0 || keys.length <= 3 ? 'open' : ''}>
        <summary><b>${i + 1}. ${esc(it.label)}</b><span><i class="wz-edited"${e ? '' : ' hidden'}>直した文面・</i>${state.councils.length}通</span></summary>
        ${e && e.role !== state.role ? '<p class="hint-sm warn">立場を選び直す前に直した文面です。最後の一文があなたの立場に合っているか確かめてください。</p>' : ''}
        ${others.length ? `<p class="hint-sm">下は${esc(first)}あての文面です。${others.map(esc).join('・')}あてにも、同じ内容で1通ずつ作ります。ここで直すと、宛名と自治体名を差し替えてすべての議会に反映されます。</p>` : ''}
        <textarea class="wz-paper" rows="4" spellcheck="false" data-key="${esc(k)}" aria-label="${esc(it.label)}の文面">${esc(text)}</textarea>
        <p class="wz-docstat hint-sm" aria-live="polite"></p>
        <div class="out-toolbar"><button type="button" class="btn btn-small" data-doc-view="${i}">仕上がりを見る</button><button type="button" class="btn btn-small" data-doc-ai="${i}">生成AIで自分の言葉に直す</button><button type="button" class="btn btn-small" data-doc-reset="${esc(k)}"${e ? '' : ' hidden'}>元の文面に戻す</button></div>
      </details>`;
    }).join('');
    areas().forEach((ta) => { fit(ta); docStat(ta); });
    const document = state.kind === 'request' ? '要望書' : '陳情書';
    $('wzSummary').textContent = real().length
      ? `${state.councils.length}つの自治体 × ${keys.length === 1 && state.items.length > 1 ? `${state.items.length}つの内容をまとめた1通` : `${keys.length}つの内容`} ＝ ${document} ${state.councils.length * keys.length}通`
      : `自治体名を空けた${document} ${keys.length}通（提出先が決まったら手書きで入れてください）`;
    renderMatrix();
    renderOffices();
  }

  // まとめて1通にするかの切り替え。まとめられないときは理由を出す
  function renderMerge() {
    const n = state.items.length;
    const box = $('wzMerge');
    box.hidden = n < 2;
    if (box.hidden) return;
    const ok = canMerge();
    $('wzMergeOn').disabled = !ok;
    $('wzMergeOn').checked = ok && !!state.merge;
    $('wzMergeLabel').textContent = `選んだ${n}つの内容を、まとめて1通にする`;
    $('wzMergeWhy').textContent = ok
      ? 'まとめると、記の一・二…に内容が並ぶ1通になり、署名も1回で済みます。1つずつ分けると、議会が内容ごとに採否を決めやすくなります。'
      : n > MERGE_MAX ? `まとめられるのは${MERGE_MAX}つまでです。`
        : '国に意見書を出すよう求める内容と、自治体の取り組みを求める内容が混ざっているため、まとめられません（文書の種類が違います）。';
  }
  $('wzMergeOn').addEventListener('change', (e) => { state.merge = e.target.checked; build(); renderNow(); saveDraft(); });

  // 何通できるかを、宛先 × 内容の表で見せる。1通ずつでも、まとめて1つのPDFでも開ける
  function renderMatrix() {
    const docName = state.kind === 'request' ? '要望書' : '陳情書';
    const items = docKeys().map((k) => ({ label: docLabel(k) }));
    const total = items.length * state.councils.length;
    const head = `<tr><th scope="col">内容 ＼ 宛先</th>${state.councils.map((c) => `<th scope="col">${esc(isNone(c) ? '（宛先を空ける）' : municipalityName(c))}</th>`).join('')}</tr>`;
    const rows = items.map((it, i) => `<tr><th scope="row">${i + 1}. ${esc(it.label)}</th>${state.councils.map((c, j) => `<td><button type="button" class="btn btn-small" data-cell="${i}:${j}" aria-label="${esc(it.label)}・${esc(isNone(c) ? '宛先なし' : municipalityName(c))}あてを開く">1通を開く</button></td>`).join('')}</tr>`).join('');
    $('wzMatrix').innerHTML = `<div class="table-scroll"><table class="compare">${head}${rows}</table></div>
      ${total > 1 ? `<p class="hint-sm"><b>${docName}は1通ずつ別の紙になります</b>（1通ごとに署名が要ります）。上のボタンで1通ずつ開くか、下のボタンで${total}通を1つのPDFにまとめて開いて印刷できます。同じ議会に出す分は、1つの封筒にまとめて送れます。</p>
      <p><button type="button" id="wzAllPdf" class="btn btn-primary">${total}通をまとめてPDFで開く</button></p>` : ''}`;
  }
  $('wzMatrix').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'wzAllPdf') { viewPdf(b, null, allDocs()); return; }
    const [i, j] = b.dataset.cell.split(':').map(Number);
    viewPdf(b, null, [docFor(areas()[i], state.councils[j])]);
  });

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
  const docFor = (ta, c) => withChair(withSender(edits[ta.dataset.key] ? forCouncil(ta.value, c)
    : window.Petition.build(formData(), nameOf(c), keysOf(ta.dataset.key)), sender), c).trim();
  const allDocs = () => state.councils.flatMap((c) => areas().map((ta) => docFor(ta, c)));
  // 1通目の議会あての1通だけをPDFにして、新しいタブで開く（鏡文・宛名はつけない）
  // 開くのを待つとポップアップとして止められるので、タブは先に開いておく
  // texts を渡すと、その文面（何通でも）を1つのPDFにする。1通ずつ新しいページから始まる
  async function viewPdf(btn, ta, texts) {
    const win = window.open('', '_blank');
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      const doc = await window.PdfDoc.create();
      (texts || [docFor(ta, state.councils[0])]).forEach((t) => doc.addDocument(t));
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
    edits[k] = { text: e.target.value, council: nameOf(state.councils[0]), role: state.role, day: window.Common.reiwaToday() };
    saveEdits();
    fit(e.target);
    docStat(e.target, true);
    const d = e.target.closest('.wz-doc');
    d.querySelector('.wz-edited').hidden = false;
    d.querySelector('[data-doc-reset]').hidden = false;
  });
  // 閉じていた欄は高さを測れないので、開いたときに合わせ直す
  $('wzDocs').addEventListener('toggle', (e) => { if (e.target.open) fit(e.target.querySelector('textarea')); }, true);
  // 閉じた中では高さが測れないので、開いたときに合わせ直す
  $('wzCheck').addEventListener('toggle', (e) => { if (e.target.open) areas().forEach(fit); });
  $('wzDocs').addEventListener('click', (e) => {
    const v = e.target.dataset.docView;
    if (v !== undefined) viewPdf(e.target, areas()[v]);
    const a = e.target.dataset.docAi;
    if (a !== undefined) openRewrite(areas()[a]);
    const k = e.target.dataset.docReset;
    if (k !== undefined) {
      delete edits[k];
      saveEdits();
      build();
    }
  });

  // ---------- 生成AIで中身だけ直す ----------
  // 選んだ文面の趣旨と理由だけを AI に渡し、返ってきた答えをその2か所に入れ替える（1つ目の議会あての文面を直す）
  let rwArea = null;
  const rwPrompt = () => {
    $('wzRwPrompt').value = window.Petition.buildRewritePrompt(rwArea.value, nameOf(state.councils[0]), { local: $('wzRwLocal').value, story: $('wzRwStory').value });
  };
  function openRewrite(ta) {
    rwArea = ta;
    $('wzRwTitle').textContent = `「${ta.closest('.wz-doc').querySelector('summary b').textContent}」`;
    $('wzRwAnswer').value = '';
    $('wzRwPlans').hidden = true;
    rwPrompt();
    if (!$('wzRwPrompt').value) { flash('「陳情の趣旨」「陳情の理由」の見出しが見つからないので、AIに渡せません。元の文面に戻してから試してください。', 5000); return; }
    $('wzRwBox').hidden = false;
    $('wzRwBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  ['wzRwLocal', 'wzRwStory'].forEach((id) => $(id).addEventListener('input', () => rwArea && rwPrompt()));
  $('wzRwClose').addEventListener('click', () => { $('wzRwBox').hidden = true; });
  $('wzRwApply').addEventListener('click', () => {
    const out = rwArea && window.Petition.applyRewrite(rwArea.value, $('wzRwAnswer').value);
    if (!out) { flash('AIの答えに「【陳情の趣旨】」「【陳情の理由】」の目印が見つかりません。答えを丸ごと貼り付けるか、AIにもう一度頼んでください。', 6000); return; }
    rwArea.value = out;
    // AI が引いた計画は文面に入れず、原文で確かめてもらえるよう欄に残す
    const plans = window.Petition.rewritePlans($('wzRwAnswer').value);
    $('wzRwPlans').innerHTML = plans.length ? `<p><b>AIが引いた${esc(nameOf(state.councils[0]).replace(/議会$/, ''))}の計画</b>：文面に入った引用が、計画の原文と同じか確かめてください。</p><ul>${plans.map((pl) => `<li>${pl.url ? `<a href="${esc(pl.url)}" target="_blank" rel="noopener">${esc(pl.text)}</a>` : esc(pl.text)}</li>`).join('')}</ul>` : '';
    $('wzRwPlans').hidden = !plans.length;
    // 手で直したときと同じく、直した文面として端末に残す
    rwArea.dispatchEvent(new Event('input', { bubbles: true }));
    $('wzRwBox').hidden = !plans.length;
    rwArea.closest('.wz-doc').open = true;
    rwArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash(/【要確認/.test(out) ? '文面に入れました。「【要確認」の所を確かめて直してください。' : '文面に入れました。事実や数字を確かめてから印刷してください。', 5000);
  });

  // 提出先：議会事務局の多くは本庁舎にあるので、その住所を出し、締切は公式サイトで調べてもらう
  // 都道府県をまたいで選んだときは、どこの議会かわかるよう都道府県名を添える
  const label = (c) => (new Set(state.councils.map(prefOf)).size > 1 && !municipalityName(c).startsWith(prefOf(c)) ? `${municipalityName(c)}（${prefOf(c)}）` : municipalityName(c));
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
    if (state.kind === 'request') {
      $('wzOffices').innerHTML = real().map((c) => {
        const [pref, key] = officeKeys[c] || [];
        const [site] = (window.SITES[pref] || {})[key] || [];
        const name = municipalityName(c);
        const query = encodeURIComponent(`site:${site ? new URL(site).hostname : `${name} 公式`} 要望 OR ご意見 OR 提案`);
        const links = [
          site && `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(name)}の公式ホームページ</a>`,
          `<a href="https://www.google.com/search?q=${query}" target="_blank" rel="noopener">公式ホームページで「要望・ご意見」を探す</a>`,
        ].filter(Boolean).join('');
        return `<li><b>${esc(name)}役所</b><span>要望書の提出先は自治体ごとに異なります。公式ホームページで担当部署や提出方法を確認してください。</span><span class="wz-links">${links}</span></li>`;
      }).join('');
      $('wzChairLinks').innerHTML = '';
      $('wzNearby').innerHTML = '';
      return;
    }
    $('wzOffices').innerHTML = real().map((c) => {
      const [pref, key] = officeKeys[c] || [];
      const info = infoOf(c);
      const q = encodeURIComponent(`${search(c)} 陳情 提出 締切`);
      const [site, page, council] = (window.SITES[pref] || {})[key] || [];
      const links = [
        mailBadge(info) && page && `<a href="${esc(page)}" target="_blank" rel="noopener">陳情・請願の案内ページ</a>`,
        // 案内ページを持たない議会も多い。そのときは議会のページから事務局に問い合わせてもらう
        !page && council && `<a href="${esc(council)}" target="_blank" rel="noopener">議会のページ</a>`,
        // 案内ページが見つからなかった議会は、公式サイトの中だけを「陳情」で検索してもらう（確認方法の欄を出す議会では、案内ページ・公式サイトはそちらに載せる）
        mailBadge(info) && !page && site && `<a href="https://www.google.com/search?q=${encodeURIComponent(`site:${new URL(site).hostname} 陳情 OR 請願 議会`)}" target="_blank" rel="noopener">公式サイト内で「陳情」を検索</a>`,
        mailBadge(info) && site && `<a href="${esc(site)}" target="_blank" rel="noopener">公式サイト</a>`,
        `<a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">${page ? '締切を検索' : '提出方法・締切を調べる'}</a>`,
      ].filter(Boolean).join('');
      // 郵送で審査されるかが分からない議会は、確かめる先（電話・案内ページ・公式サイト）をその下にまとめる
      const guide = page
        ? `<a href="${esc(page)}" target="_blank" rel="noopener">陳情・請願の案内ページ</a>`
        : site && `<a href="https://www.google.com/search?q=${encodeURIComponent(`site:${new URL(site).hostname} 陳情 OR 請願 議会`)}" target="_blank" rel="noopener">陳情・請願の案内ページを検索</a>`;
      const badge = mailBadge(info);
      const check = [
        telHtml(pref, key, false).replace(/^\s*<span class="wz-tel">|<\/span>\s*$/g, ''),
        guide,
        site && `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(label(c).replace(/議会$/, ''))}の公式サイト</a>`,
      ].filter(Boolean).map((x) => `<li>${x}</li>`).join('');
      // 所在地は宛名の用紙・ラベルに入るので、ここには出さない
      return `<li><b>${esc(label(c))}事務局</b>
        <span class="wz-row"><b>郵送</b>（<a href="guide#send">送り方</a>）${badge || '<span class="wz-mail none">郵送で審査してもらえるかは載っていませんでした（事務局に確認を）</span>'}</span>
        ${badge ? '' : `<span class="wz-check-how">確認方法</span><ul class="wz-check-list">${check}</ul>`}
        ${accessHtml(pref, key) && `<span class="wz-row"><b>持参</b></span>${accessHtml(pref, key)}`}
        ${notes(info)}
        ${badge ? telHtml(pref, key, !page) : ''}
        ${page ? '' : '<span>陳情の出し方のページが見つかりませんでした。小さな議会では案内ページを置いていないことも多いので、議会事務局に電話で出し方と締切を聞くのが確実です。</span>'}
        <span class="wz-links">${links}</span>
        ${window.Report.enabled ? `<button type="button" class="btn btn-small wz-report" data-report="${esc(c)}" ${window.Report.reported(c) ? 'disabled' : ''}>${window.Report.reported(c) ? '✓ 提出を報告しました' : '出したら押す：この議会に提出した'}</button>` : ''}</li>`;
    }).join('');
    // ②の「議長の氏名を書き入れる」に、議会ごとの議長を調べるリンクを並べる
    $('wzChairLinks').innerHTML = real().map((c) => `<a href="https://www.google.com/search?q=${encodeURIComponent(`${search(c)} 議長`)}" target="_blank" rel="noopener">${esc(label(c))}の議長を調べる</a>`).join('　');
    renderNearby();
  }

  // ④ 選んだ議会の近くの議会。選んだ議会の真ん中から直線距離の近い順に、地図（点の位置）と一緒に出す
  function renderNearby() {
    const picked = state.councils.map((c) => accessOf(...(officeKeys[c] || []))).filter(Boolean);
    const box = $('wzNearby');
    if (!picked.length || !window.Places) { box.innerHTML = '<p class="hint-sm">位置の分かる議会を選ぶと、近くの議会を出します。</p>'; return; }
    const me = { lat: picked.reduce((t, a) => t + a[0], 0) / picked.length, lng: picked.reduce((t, a) => t + a[1], 0) / picked.length };
    const rad = Math.PI / 180;
    const dist = (a) => Math.hypot((a[1] - me.lng) * rad * Math.cos(me.lat * rad), (a[0] - me.lat) * rad) * 6371000;
    const near = window.Places.all()
      .map((pl) => ({ pl, id: idOf(pl.pref, pl.council), a: accessOf(pl.pref, pl.key) }))
      .filter((x) => x.a && !state.councils.includes(x.id))
      .map((x) => ({ ...x, d: dist(x.a) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    // 緯度・経度をそのまま平面に置く簡単な地図。経度は緯度に合わせて縮める
    const pts = [...state.councils.map((c) => ({ name: label(c), a: accessOf(...(officeKeys[c] || [])), on: true })).filter((p) => p.a),
      ...near.map((n) => ({ name: n.pl.council, a: n.a, on: false }))];
    const kx = Math.cos(me.lat * rad);
    const xs = pts.map((p) => p.a[1] * kx), ys = pts.map((p) => -p.a[0]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const W = 320, H = 220, pad = 30, sc = Math.min((W - pad * 2) / ((x1 - x0) || 1e-3), (H - pad * 2) / ((y1 - y0) || 1e-3));
    const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
    const map = `<svg class="wz-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="選んだ議会と近くの議会の位置">${pts.map((p, i) => {
      const x = ox + (xs[i] - x0) * sc, y = oy + (ys[i] - y0) * sc;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.on ? 6 : 4}" class="${p.on ? 'on' : ''}"/><text x="${(x + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(p.name.replace(/議会$/, ''))}</text>`;
    }).join('')}</svg>`;
    box.innerHTML = `${map}<p class="hint-sm">●大きい点が選んだ議会です。押すと宛先に加わり、陳情書が1通ずつ増えます。</p>
      <div class="wz-grid">${near.map((n) => `<button type="button" class="wz-chip" data-add-near="${esc(n.id)}" title="${esc(n.a[2])}駅（${esc(n.a[3])}）">${esc(n.pl.council)}<small class="wz-n">約${km(n.d)}・${esc(n.a[2])}駅</small></button>`).join('')}</div>`;
    near.forEach((n) => councilsOf(n.pl.pref));
  }

  // 差出人（あなた）の住所・氏名。入れるとすぐ、下の文面の住所・氏名の行に入る
  const sender = window.Common.bindSender($('wzSender'), () => {
    areas().forEach((ta) => { ta.value = withSender(ta.value, sender); });
  });
  $('wzRemember').checked = window.Common.remembers();
  $('wzRemember').addEventListener('change', (e) => {
    window.Common.setRemember(e.target.checked, sender);
    flash(e.target.checked ? '住所・氏名をこの端末に覚えておきます' : '住所・氏名をこの端末に残さないようにしました');
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
    const q = new URLSearchParams({ i: state.items.join(','), p: state.pref, c: state.councils.join(','), r: state.role });
    return `${location.origin}${location.pathname}#w?${q}`;
  }
  function saveLink(done) {
    const url = done ? linkOf() : location.pathname + location.search;
    history.replaceState({ step: state.step }, '', url);
  }
  function restore() {
    const m = location.hash.match(/^#w\?(.*)$/);
    if (!m) return false;
    const q = new URLSearchParams(m[1]);
    // 前の形式のリンクに付いている t（国か自治体か）は、項目から分かるので読まない
    const items = (q.get('i') || '').split(',').filter((k) => window.ASKS.some((a) => a.id === k));
    const pref = q.get('p');
    if (!items.length || !(window.PREFS.includes(pref) || q.get('c') === NONE)) return false;
    // 前の形式のリンク（議会名だけ）は、p の都道府県の議会として読む
    const councils = (q.get('c') || '').split(',').map((c) => (c.includes('/') ? c : idOf(pref, c)))
      .filter((c) => isNone(c) || (window.PREFS.includes(prefOf(c)) && councilsOf(prefOf(c)).includes(nameOf(c))));
    const role = q.get('r');
    if (!councils.length || !ROLES.some(([k]) => k === role)) return false;
    Object.assign(state, { items, pref, councils, role, step: STEPS.indexOf('done') });
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

  const top = encodeURIComponent(location.href.split('#')[0].replace(/\/make(\.html)?$/, ''));
  $('wzShareX').href = `https://x.com/intent/post?text=${encodeURIComponent(window.THEME.shareText)}&url=${top}`;
  $('wzShareLine').href = `https://social-plugins.line.me/lineit/share?url=${top}`;

  // ---------- 提出前の確認：選んだ議会ごとの郵送の扱い ----------
  function renderCheckMail() {
    const list = real();
    $('wzCheckMail').innerHTML = !list.length
      ? '<li>提出先を空けて作りました。出す先の議会名と議長名を書き入れ、その議会の郵送・持参の扱いを議会事務局で確かめてください。</li>'
      : list.map((id) => {
        const r = state.kind === 'petition' ? mailRule(infoOf(id)) : null;
        const label = state.kind === 'request' ? '要望書の受付窓口（秘書課・担当課など）を自治体の公式サイトで確かめてください'
          : r ? r.label : '';
        if (label) return `<li><b>${esc(municipalityName(id))}</b>：${esc(label)}${state.kind === 'petition' ? tipForm(id, true) : ''}</li>`;
        const [pref, key] = officeKeys[id] || [];
        return `<li><b>${esc(municipalityName(id))}</b>：このサイトではまだ扱いを調べられていません。議会事務局に電話で次のことを聞くと確実です。${telHtml(pref, key, false)}
          <ul class="wz-ask">
            <li>陳情は郵送でも受け付けますか。郵送だと審査されますか、議員への配付だけですか（住民以外が出す場合も）</li>
            <li>次の定例会に間に合う提出の締切はいつですか</li>
            <li>必要な部数（正本・写し）と、決まった書式があるか</li>
            <li>いまの議長のお名前（宛名に書き入れるため）</li>
            <li>電子申請やメールで出せるか</li>
          </ul>${tipForm(id, false)}</li>`;
      }).join('');
  }

  // 分かった議会の扱いを運営に送る（任意）。送るのは議会の手続きの情報だけ
  function tipForm(id, known) {
    if (!window.Report.tipsEnabled) return '';
    const name = esc(municipalityName(id));
    const radio = (k, opts) => opts.map(([v, t]) => `<label><input type="radio" name="${k}" value="${v}"> ${t}</label>`).join('');
    return `${known ? '' : '<p class="wz-tip-lead">📝 聞いて分かったら、下の「分かったことを共有する」を押して送れます（1分ほど・任意）。次に同じ議会に出す人の助けになります。</p>'}<details class="wz-tip"><summary>${known ? `${name}の情報が古い・違うときは、修正を送る（任意）` : `分かったことを共有する（任意）`}</summary>
      <form data-tip="${esc(id)}">
        <p class="hint-sm">電話や公式サイトで分かった<b>${name}の扱い</b>を送ると、確かめてこのサイトに反映します。次に同じ議会に出す人の助けになります。<b>送るのは下の欄の内容だけ</b>で、陳情書の文面・住所・氏名は送りません。分かったところだけで構いません。</p>
        <fieldset><legend>郵送した陳情は</legend>${radio('mail', [['review', '審査される'], ['distribute', '議員への配付だけ'], ['unknown', '分からない']])}</fieldset>
        <fieldset><legend>持参での提出</legend>${radio('bring', [['yes', 'できる'], ['no', 'できない'], ['unknown', '分からない']])}</fieldset>
        <fieldset><legend>電子申請・メールでの提出</legend>${radio('online', [['yes', 'できる'], ['no', 'できない'], ['unknown', '分からない']])}</fieldset>
        <label>電子申請のページのURL<input type="url" name="online_url" maxlength="300" placeholder="https://"></label>
        <label>締切の目安<input name="deadline" maxlength="100" placeholder="例：定例会の告示日の前日まで"></label>
        <label>部数・決まった書式<input name="copies" maxlength="100" placeholder="例：正本1部。書式は自由"></label>
        <label>情報のもと（案内ページのURL）<input type="url" name="source_url" maxlength="300" placeholder="https://"></label>
        <label>そのほか気をつけること<textarea name="note" rows="2" maxlength="300" placeholder="個人のことや陳情の中身は書かないでください"></textarea></label>
        <label class="wz-hp" aria-hidden="true">空けておく<input name="website" tabindex="-1" autocomplete="off"></label>
        <p><button type="submit" class="btn btn-small btn-primary">運営に送る</button> <span class="wz-tip-msg" role="status"></span></p>
      </form></details>`;
  }
  $('wzCheckMail').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = f.querySelector('.wz-tip-msg');
    const btn = f.querySelector('button[type="submit"]');
    const data = new FormData(f);
    // 人には見えない欄に何か入っていたら機械の送信とみなし、送ったふりだけする
    const bot = !!data.get('website');
    data.delete('website');
    const fields = {};
    for (const [k, v] of data) if (String(v).trim()) fields[k] = String(v).trim();
    if (!Object.keys(fields).length) { msg.textContent = '分かったことを1つ以上入れてください。'; return; }
    btn.disabled = true;
    msg.textContent = '送っています…';
    const ok = bot || await window.Report.tip(f.dataset.tip, fields);
    msg.textContent = ok ? '✓ 送信しました。ありがとうございます。運営が確かめてから、このサイトに反映します。' : '送れませんでした。時間をおいてもう一度押してください。';
    msg.classList.toggle('done', ok);
    btn.disabled = ok;
    if (ok) f.querySelectorAll('input, textarea').forEach((el) => { el.disabled = true; });
  });

  // 議長の氏名。入れると、その議会あてのすべての通の宛名に入る（この画面の間だけ。端末にも残さない）
  const chairs = {};
  const chairRe = /^(.*議長)　.*　様$/m;
  function withChair(text, c) {
    const name = chairs[c];
    return name ? text.replace(chairRe, `$1　${name}　様`) : text;
  }
  function renderChairs() {
    const list = real();
    $('wzChairs').innerHTML = list.map((c, i) => `<label>${esc(label(c))}の議長の氏名
      <input data-chair="${esc(c)}" value="${esc(chairs[c] || '')}" maxlength="20" autocomplete="off" placeholder="例：山田 太郎">
      <a href="https://www.google.com/search?q=${encodeURIComponent(`${label(c)} 議長`)}" target="_blank" rel="noopener">議長を調べる</a></label>`).join('');
    $('wzChairBox').hidden = !list.length || state.kind === 'request';
  }
  $('wzChairs').addEventListener('input', (e) => {
    const c = e.target.dataset.chair;
    if (!c) return;
    chairs[c] = e.target.value.trim();
    const all = real().every((id) => chairs[id]);
    if ($('wzChkChair').checked !== all) { $('wzChkChair').checked = all; renderCheckLeft(); }
    // 文面の欄（1つ目の議会あて）にも入れる
    if (c === state.councils[0]) areas().forEach((ta) => {
      ta.value = ta.value.replace(chairRe, `$1　${chairs[c] || window.Common.BLANK_TEXT}　様`);
    });
  });

  // 最終画面の「今やること」。印刷・コピーをいちばん上に置く
  function renderNow(bump) {
    const n = docKeys().length * Math.max(1, state.councils.length);
    const docName = state.kind === 'request' ? '要望書' : '陳情書';
    $('wzNowCount').textContent = n > 1
      ? `${docName}は全部で${n}通です。下のボタンで、${n}通を1つのPDFファイルにまとめて開きます（1通ごとに新しいページから始まります）。1通ずつ別の紙として出し、それぞれに署名が要ります。`
      : `${docName}は1通です。`;
    $('wzNowCount').classList.toggle('bump', !!bump);
    $('wzNowPdf').textContent = n > 1 ? `${n}通を印刷用のPDFで開く` : '印刷用のPDFを開く';
    $('wzNowDate').textContent = window.Common.reiwaToday();
    renderNowAsk();
  }
  // 「今やること」の1つ目：議会ごとに、分かっている扱いか、電話で聞くことを出す
  function renderNowAsk() {
    const list = real();
    let html;
    if (state.kind === 'request') {
      html = '<li>要望書の受付窓口（秘書課・担当課など）と、郵送・メールで出せるかを、自治体の公式サイトで確かめます。下の「くわしい手順」の②に、探すためのリンクがあります。</li>';
    } else if (!list.length) {
      html = '<li>出す先を決めたら、その議会事務局に「郵送でも審査されるか」「次の締切」「いまの議長の名前」を聞きます（電話で1分ほど）。</li>';
    } else {
      html = list.map((id) => {
        const info = infoOf(id);
        const r = mailRule(info);
        const name = `<b>${esc(municipalityName(id))}</b>`;
        if (r && r.c !== 'unknown') {
          const sure = !info.policy || info.policy.confidence === 'confirmed';
          const what = { none: '審査を求めるときは、紹介議員のいる請願にする方法があります。', jisan: '審査してもらうなら持参で出します。', outside: '住民でなければ、審査してもらうには持参で出します。' }[r.c] || '';
          return `<li>${name}：${esc(r.label)}。${what}${sure ? 'このサイトで議会の公式の案内から調べてあるので、電話は要りません。締切だけ公式サイトで確かめてください。' : 'ただし、まだ確定していない情報です。電話で一度確かめると確実です。'}</li>`;
        }
        const [pref, key] = officeKeys[id] || [];
        return `<li>${name}：扱いがまだ分かっていません。電話で「郵送でも審査されますか」「次の締切はいつですか」「いまの議長のお名前は」の3つを聞けば足ります（1分ほど）。${telHtml(pref, key, false)}</li>`;
      }).join('');
    }
    $('wzNowAsk').innerHTML = html;
    $('wzNowReport').hidden = !window.Report.enabled;
  }
  $('wzNowPdf').addEventListener('click', (e) => viewPdf(e.currentTarget, null, allDocs()));
  $('wzNowCopy').addEventListener('click', () => $('wzCopy').click());

  // 確かめた項目の数を出す。進むのは止めないが、残りがあれば知らせる
  const checks = () => [...document.querySelectorAll('.wz-checklist > ul > li > label > input')];
  function renderCheckLeft() {
    const left = checks().filter((c) => !c.checked).length;
    $('wzCheckLeft').textContent = left ? `⚠ まだ確かめていない項目が ${left}つ あります。チェックがないまま出すと、受け付けられなかったり審査されなかったりすることがあります。` : '✓ すべて確かめました。印刷して出せます。';
    $('wzCheckLeft').classList.toggle('done', !left);
    $('wzNowLeft').hidden = !left;
    $('wzNowLeft').textContent = `⚠ 下の「出す前に確かめること」が、まだ${left}つ残っています。印刷はできますが、出す前に確かめてください。`;
  }
  checks().forEach((c) => c.addEventListener('change', renderCheckLeft));

  // ---------- 済んだステップへ戻る ----------
  document.querySelectorAll('[data-progress-step]').forEach((el, i) => {
    const back = () => { if (i < state.step) go(i - state.step); };
    el.addEventListener('click', back);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back(); }
    });
  });

  // ---------- 全国の自治体から名前で探す ----------
  let allCouncils = null;
  const globalList = () => (allCouncils ||= window.PREFS.flatMap((p) => councilsOf(p).map((c) => idOf(p, c))));
  $('wzGlobal').addEventListener('input', () => {
    const q = $('wzGlobal').value.trim();
    if (!q) { $('wzGlobalHits').innerHTML = ''; return; }
    // 名前がそのまま一致する自治体を先に（「大分市」で大分県議会が先に出ないように）
    const rank = (id) => { const n = municipalityName(id); return n === q ? 0 : n.startsWith(q) ? 1 : 2; };
    const hits = window.Yomi.filter(globalList(), q, (id) => kanaOf[nameOf(id)])
      .map((id, i) => [id, rank(id), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([id]) => id).slice(0, 30);
    $('wzGlobalHits').innerHTML = hits.map((id) => `<button type="button" class="wz-chip" data-global="${esc(id)}">${esc(municipalityName(id))}<small class="wz-n">${esc(prefOf(id))}</small>${state.kind === 'petition' ? chipMail(id) : ''}</button>`).join('')
      || `<div class="wz-wide wz-nohit"><p>「${esc(q)}」に当てはまる自治体が見つかりません。</p><ul class="hint-sm"><li>「市」「町」を外す、ひらがなで読みを入れる（例：かまがや）と見つかることがあります。</li><li><button type="button" class="btn btn-small" data-to-prefs>都道府県から選ぶ</button>　<button type="button" class="btn btn-small" data-skip-council>自治体を選ばずに作る（提出先は手書き）</button></li></ul></div>`;
  });
  $('wzGlobalHits').addEventListener('click', (e) => {
    if (e.target.closest('[data-to-prefs]')) $('wzPrefs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (e.target.closest('[data-skip-council]')) $('wzSkip').click();
  });

  // ---------- 前に選んだ議会（議会名だけを残す） ----------
  const RECENT_KEY = 'chinjo-recent-councils';
  const recent = () => {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY)) || []).filter((c) => window.PREFS.includes(prefOf(c)) && councilsOf(prefOf(c)).includes(nameOf(c))); } catch { return []; }
  };
  function rememberCouncils() {
    if (!real().length) return;
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([...new Set([...real(), ...recent()])].slice(0, 8))); } catch { /* 覚えられなくても作れる */ }
  }
  function renderRecent() {
    const list = recent();
    $('wzRecent').hidden = !list.length;
    $('wzRecent').innerHTML = list.length ? `<p class="hint-sm">前に選んだ自治体</p><div class="wz-grid">${list.map((id) => `<button type="button" class="wz-chip" data-global="${esc(id)}">${esc(municipalityName(id))}<small class="wz-n">${esc(prefOf(id))}</small></button>`).join('')}</div>` : '';
  }

  // ---------- 下書き（選んだ内容・議会・立場だけ。住所・氏名は差出人として別に扱う） ----------
  const DRAFT_KEY = `chinjo-draft-${window.THEME.id}`;
  function saveDraft() {
    if (state.step >= ASK_STEPS) rememberCouncils();
    if (STEPS[state.step] === 'council') renderRecent();
    if (!state.items.length) return;
    const { step, pref, councils, items, role, kind, merge } = state;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, pref, councils, items, role, kind, merge })); } catch { /* 残せなくても作れる */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* 残していない */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (!d || !Array.isArray(d.items)) return null;
      const items = d.items.filter((k) => window.Petition.ITEMS[k]);
      if (!items.length) return null;
      const councils = (d.councils || []).filter((c) => isNone(c) || (window.PREFS.includes(prefOf(c)) && councilsOf(prefOf(c)).includes(nameOf(c))));
      const role = ROLES.some(([k]) => k === d.role) ? d.role : '';
      // 条件がそろっていない画面には進めない
      let step = Math.max(0, Math.min(Number(d.step) || 0, STEPS.length - 1));
      if (!councils.length) step = Math.min(step, 1);
      else if (!role) step = Math.min(step, 2);
      return { items, councils, role, step, pref: window.PREFS.includes(d.pref) ? d.pref : '', kind: d.kind === 'request' ? 'request' : 'petition', merge: !!d.merge };
    } catch { return null; }
  }

  if (restore()) {
    show();
    $('wizard').scrollIntoView();
  } else {
    const draft = loadDraft();
    show();
    if (draft) {
      $('wzResume').hidden = false;
      $('wzResumeYes').addEventListener('click', () => {
        Object.assign(state, draft);
        setKindInputs();
        $('wzResume').hidden = true;
        show();
        focusStep();
      });
      $('wzResumeNo').addEventListener('click', () => { clearDraft(); $('wzResume').hidden = true; });
    }
  }
})();
