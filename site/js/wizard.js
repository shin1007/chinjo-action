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

  // トップページの検索から来たときは ?item= の項目を初めから選んでおく
  const linkedItem = new URLSearchParams(location.search).get('item');
  // ?item=a,b のように、いくつか並べて渡すこともできる（トップの「言葉でさがす」で見出しごとにまとめて選ぶとき）
  const firstItems = () => (linkedItem || '').split(',').filter((k) => window.ASKS.some((a) => a.id === k));
  // テーマのページで「要望書」を選んで来たときは ?kind=request が付いている
  // ?kind がないときも、?item= で渡された内容が要望書向けだけなら、要望書から始める（陳情書では選べないため）
  const startKind = () => {
    const kind = new URLSearchParams(location.search).get('kind');
    if (kind === 'request') return 'request';
    if (kind) return 'petition';
    const linked = firstItems().map((k) => window.ASKS.find((a) => a.id === k));
    return linked.length && linked.every((a) => !window.Petition.usableFor(a, 'petition')) ? 'request' : 'petition';
  };
  // mode：何を作るか（petition＝陳情書だけ／request＝要望書だけ／both＝両方）。?kind=both で両方から始める
  // kind：いま画面に出している文書。両方を作るときは、文面の画面で陳情書と要望書を切り替える
  const state = { step: 0, pref: '', councils: [], items: firstItems(), role: '', kind: startKind(), mode: new URLSearchParams(location.search).get('kind') === 'both' ? 'both' : startKind(), merge: false, reply: false };
  const kindInputs = () => document.querySelectorAll('input[name="wzKind"]');
  const setKindInputs = () => kindInputs().forEach((r) => { r.checked = r.value === state.mode; });
  // 両方を作るときは、選んだ内容を向きで振り分ける。陳情向けは陳情書に、要望向けは要望書に、どちらでもよい内容は両方に入れる
  const forKind = (kind) => (k) => !!window.Petition.ITEMS[k] && window.Petition.usableFor(window.Petition.ITEMS[k], kind);
  const countOf = (kind) => state.items.filter(forKind(kind)).length;
  // いま出している文書に入る内容
  const cur = () => (state.mode === 'both' ? state.items.filter(forKind(state.kind)) : state.items);
  // 両方を作るとき、いまの文書に入る内容がなければ、もう一方を出す
  const fixKind = () => {
    if (state.mode !== 'both') { state.kind = state.mode; return; }
    if (!countOf(state.kind)) state.kind = state.kind === 'request' ? 'petition' : 'request';
  };
  const docNameOf = (kind) => (kind === 'request' ? '要望書' : '陳情書');

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
  const headOf = (name) => window.Petition.headOf(name);
  // 議会を選ばずに作るときは、議会名を空けた宛先を1つだけ置く（議会名と議長名は手書きで入れる）
  const NONE = '/　　　　　　議会';
  const isNone = (c) => c === NONE;
  const real = () => state.councils.filter((c) => !isNone(c));
  const names = () => real().map(nameOf);
  function councilsOf(pref) {
    return window.Places.of(pref).map((pl) => {
      officeKeys[idOf(pref, pl.council)] = [pref, pl.key];
      // 読みも郡名（「…グン」）を外して、議会名と同じ範囲にする
      const kana = ((window.KANA || {})[pref] || {})[pl.key] || '';
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
  const canMerge = () => cur().length >= 2 && cur().length <= MERGE_MAX
    && new Set(cur().map(isNat)).size === 1;
  // 1通ごとの内容のキー。まとめるときは「a+b+c」の1つ
  const docKeys = () => (state.merge && canMerge() ? [cur().join('+')] : [...cur()]);
  const keysOf = (k) => k.split('+');
  const docLabel = (k) => keysOf(k).map((x) => window.Petition.ITEMS[x].label).join('・');
  function renderCount() {
    const s = STEPS[state.step];
    const el = $('wzCount');
    const n = cur().length;
    // 自治体のステップで、まだ議会を選んでいないうちは通数を出さない（何もできていないのに「1通」と出て紛らわしい）
    el.hidden = !((s === 'items' || (s === 'council' && real().length)) && n);
    if (el.hidden) return;
    const total = docKeys().length * Math.max(1, state.councils.length);
    el.classList.toggle('warn', n > MANY);
    el.classList.toggle('multi', total > 1);
    if (state.mode === 'both') {
      const m = Math.max(1, real().length);
      const p = countOf('petition');
      const r = countOf('request');
      el.classList.toggle('warn', p > MANY || r > MANY);
      el.textContent = `陳情書 ${p * m}通（議会あて）・要望書 ${r * m}通（知事・市区町村長あて）ができます${p && r ? '' : `。選んだ内容は${p ? 'どれも陳情書向けなので、要望書はできません' : 'どれも要望書向けなので、陳情書はできません'}`}`;
      return;
    }
    const destination = state.kind === 'request' ? '自治体' : '議会';
    const document = state.kind === 'request' ? '要望書' : '陳情書';
    // 分野（見出し）がばらばらだと1通にまとめにくく、伝わり方も散るので知らせる
    const cats = new Set(state.items.map((k) => (window.Petition.ITEMS[k] || {}).category || 'そのほか')).size;
    el.textContent = n > MANY
      ? `⚠ ${document} ${total}通。1つの${destination}に${n}通では1件ごとの重みが薄れます。${MANY}つ以内に絞るのがおすすめです`
      : `${document} ${total}通ができます（内容${n} × ${destination}${Math.max(1, real().length)}）${cats > 1 ? `。選んだ内容が${cats}つの分野に分かれています。同じ分野にまとめると、1通にまとめて出しやすくなります` : ''}`;
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

  // 郵送でも審査される議会は、都道府県を選ぶ前に全国分を見せる（家から出せる議会を先に知ってもらう）
  // 一覧は長いので、都道府県のボタンの上に折りたたんで置く
  const MAIL_BOXES = [
    [(p) => mailOk(p), 'ok', '📮 郵送で審査', '📮 郵送でも審査されるとわかっている議会', '家から送るだけで審査してもらえます。'],
  ].map((x) => { const el = document.createElement('details'); el.className = `wz-mailok ${x[1]}`; $('wzPrefs').before(el); return [el, ...x]; });
  const ids0 = (groups) => groups.flatMap(([, ids]) => ids);
  const allOn = (ids) => ids.every((id) => state.councils.includes(id));
  let zipPrefs = null;
  function renderMailAll() {
    // 要望書は議会に出さないので、郵送の扱いの一覧も都道府県のボタンの印も出さない
    document.querySelectorAll('[data-pref] .wz-mk').forEach((m) => { m.hidden = state.kind === 'request'; });
    if (state.kind === 'request') { MAIL_BOXES.forEach(([box]) => { box.hidden = true; }); return; }
    MAIL_BOXES.forEach(([box, list, c, badge, title, note]) => {
      box.hidden = false;
      const allGroups = window.PREFS.map((p) => [p, list(p)]).filter(([, ids]) => ids.length);
      document.querySelectorAll('[data-pref]').forEach((b) => {
        const k = (allGroups.find(([p]) => p === b.dataset.pref) || [])[1];
        if (k && !b.querySelector(`.wz-mk.${c}`)) b.insertAdjacentHTML('beforeend', `<small class="wz-mk ${c}">${badge} ${k.length}</small>`);
      });
      // 郵便番号を3けた以上入れると、その地域の都道府県だけに絞る
      const groups = zipPrefs ? allGroups.filter(([p]) => zipPrefs.includes(p)) : allGroups;
      const n = groups.reduce((a, [, ids]) => a + ids.length, 0);
      const area = zipPrefs ? zipPrefs.join('・') : '全国';
      box.hidden = !!zipPrefs && !n;
      const open = box.open;
      box.innerHTML = `<summary><b>${title}（${esc(area)}${n}）</b></summary><p class="hint-sm">${zipPrefs ? `郵便番号から${esc(area)}に絞っています（欄を空にすると全国に戻ります）。` : ''}${note}押すと選ばれ、下にその都道府県の議会の一覧が出ます。まだ調べきれていない議会も多いので、ここにない議会のほうが多くあります。</p>
        <p><button type="button" class="btn btn-small" data-mail-box="${esc(ids0(groups).join(','))}">${allOn(ids0(groups)) ? `${esc(area)}の${n}議会の選択をすべて外す` : `${esc(area)}の${n}議会をすべて選ぶ`}</button></p>
        ${groups.map(([p, ids]) => `<div class="wz-region"><span>${esc(p)} <button type="button" class="btn btn-small wz-region-all" data-mail-box="${esc(ids.join(','))}">${allOn(ids) ? '外す' : 'すべて選ぶ'}</button></span><div class="wz-grid">${ids.map((id) => { const on = state.councils.includes(id); return `<button type="button" class="wz-chip ${on ? 'on' : ''}" data-mail-pick="${esc(id)}" aria-pressed="${on}">${esc(nameOf(id))}${c === 'ok' ? '' : chipMail(id)}</button>`; }).join('')}</div></div>`).join('')}`;
      box.open = open;
    });
  }

  // 審査されなくても議員に配付されるだけで読んでもらえるので、選ぶときに郵送の扱いを議会ごとに短く出す
  function chipMail(id) {
    const info = infoOf(id);
    const r = mailRule(info);
    if (!r) return '';
    // 配付になることは、議会を選んだあとの「出し方と締切の目安」で控えめに伝える。選ぶ前の一覧では、郵送で審査される議会だけに印を付ける
    if (r.c !== 'ok') return '';
    return '<small class="wz-mk ok">📮 郵送で審査</small>';
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

  // 出し方と締切の目安を、議会を選んだ時点で出す（締切を過ぎても次の定例会に回るだけなので、強くは求めない）
  function renderDeadline() {
    const el = $('wzDeadline');
    if (state.kind === 'request') { el.hidden = true; return; }
    el.hidden = !state.councils.length;
    if (el.hidden) return;
    el.innerHTML = `<p><b>出し方と締切の目安</b>：締切は定例会（多くは2〜3月・6月・9月・12月）の1〜2週間前が多く、過ぎると次の定例会に回ります。住んでいない自治体の議会や郵送の陳情は、審査ではなく議員への配付になることがあります（配付でも議員には読んでもらえます）。</p>
      <ul>${state.councils.map((c) => {
        const i = intakeOf(c, 'chinjo');
        const d = clip((i && i.deadline) || infoOf(c).deadline || '');
        const q = encodeURIComponent(`${search(c)} 陳情 提出 締切`);
        const how = i && (i.auto || []).includes('deadline') ? '<small class="wz-checked">（公式ページから自動で読み取り）</small>' : '';
        return `<li><b>${esc(label(c))}</b>：${d ? `「${esc(d)}」${how}` : ''}<a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">締切を調べる</a>${howTo(infoOf(c), c)}</li>`;
      }).join('')}</ul>`;
  }

  // 出し方の目安。住民以外・郵送の陳情は議員に配るだけになる議会があるので、作る前に選び直せるよう議会を選んだ時点で出す
  // 読み取れた議会は一部だけなので、書いていない議会は「わからない」として扱う
  // 案内ページの一文から、郵送で出して審査してもらえるかを分ける。読み取れた議会だけで、書いていない議会は出さない
  // ok：郵送で出せる／jisan：審査してもらうには持参が必要／outside：住民以外の郵送は議員に配るだけ／none：出し方に関わらず議員に配るだけ
  function mailRule(info) {
    const fixed = { ok: '📮 郵送でも審査されます', jisan: '🚶 審査してもらうには持参が必要です（郵送すると議員に配付されます）', outside: '🚶 住民以外が審査してもらうには持参が必要です（郵送すると議員に配付されます）', none: 'この議会の陳情は、持参でも郵送でも議員に配付されます（委員会の審査はありません）' };
    if (info.policy) {
      const { mail_resident: resident, mail_nonresident: nonresident } = info.policy;
      if (resident === 'distribute' && nonresident === 'distribute') return { c: 'none', label: fixed.none };
      if (resident === 'distribute') return { c: 'jisan', label: fixed.jisan };
      if (resident === 'ok' && nonresident === 'distribute') return { c: 'outside', label: fixed.outside };
      if (resident === 'ok' && nonresident === 'ok') return { c: 'ok', label: fixed.ok };
      if (resident === 'ok') return { c: 'unknown', label: '📮 住民の郵送は審査されます（住民以外の郵送の扱いは、まだ確かめられていません）' };
      if (nonresident === 'distribute') return { c: 'unknown', label: '住民以外の郵送は議員に配付されます（住民の郵送の扱いは、まだ確かめられていません）' };
      return { c: 'unknown', label: '郵送したときの扱いは、まだ確かめられていません' };
    }
    if (info.mail) return { c: info.mail === 'outside' ? 'jisan' : info.mail, label: fixed[info.mail] };
    const t = [info.yusoNote, info.outsideNote].filter((x) => x && /郵送/.test(x)).join(' ');
    if (!t) return null;
    if (/関わらず|持参（または郵送）/.test(t)) return { c: 'none', label: 'この議会の陳情は、持参でも郵送でも議員に配付されるようです（委員会の審査はありません）' };
    if (/郵送[^。]{0,8}可/.test(t)) return { c: 'ok', label: '📮 郵送で出せます' };
    if (/(市|町|村)外[^。]{0,12}郵送|外に住所[^。]{0,12}郵送/.test(t)) return { c: 'jisan', label: '🚶 住民以外が審査してもらうには持参が必要です（郵送すると議員に配付されます）' };
    if (/配布|配付|参考|審議[はを]?行わ|審査[はを]?行わ|報告はありません|持参してください/.test(t)) return { c: 'jisan', label: '🚶 審査してもらうには持参が必要です（郵送すると議員に配付されます）' };
    return { c: 'ok', label: '📮 郵送でも受け付けます' };
  }
  // 扱いを最後に確かめた日。data/mail-policy.js は1件ごとの確認日、旧 data/mail.js から移した分はファイルの確認日（11/5・11/6）、
  // data/councils.js の一文から読み取った分は機械的に読み取った日
  const ymd = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[1]}年${+m[2]}月${+m[3]}日` : ''; };
  // 確かめてから3か月（90日）より古い情報は、出す前に確かめ直してもらう
  const STALE_DAYS = 90;
  const isStale = (d) => { const t = Date.parse(d || ''); return !Number.isNaN(t) && Date.now() - t > STALE_DAYS * 86400000; };
  function checkedOn(info) {
    const p = info.policy;
    if ((p && /^旧 mail\.js/.test(p.note)) || (!p && info.mail)) return '2026年11月5〜6日に議会の公式案内で確認';
    if (p && ymd(p.verified_at)) return `${ymd(p.verified_at)}に議会の公式案内で確認`;
    if (info.yusoNote || info.outsideNote) return '2026年11月4日に議会の公式ページから自動で読み取り';
    return '';
  }
  const checkedDate = (info) => { const p = info.policy; if ((p && /^旧 mail\.js/.test(p.note)) || (!p && info.mail)) return '2026-11-05'; if (p && p.verified_at) return p.verified_at; return (info.yusoNote || info.outsideNote) ? '2026-11-04' : ''; };
  const checkedTag = (info) => { const t = checkedOn(info); return t ? `<small class="wz-checked">（${esc(t)}${isStale(checkedDate(info)) ? '。3か月以上前なので、出す前に公式の案内で確かめてください' : ''}）</small>` : ''; };
  const mailBadge = (info) => { const r = mailRule(info); return r ? `<span class="wz-mail ${r.c === 'ok' ? 'ok' : r.c === 'none' ? 'none' : r.c === 'unknown' ? 'unknown' : 'jisan'}">${esc(r.label)}</span>${r.c === 'unknown' ? '' : checkedTag(info)}` : ''; };
  const ONLY_HANDOUT = /配布|配付|参考資料/;
  // 受け付け方のデータベース（data/intake.js）の陳情の郵送の扱い。mail.js・mail-policy.js にない議会で使う
  // 値：review 審査する／distribute 配付だけ／accept 受け付けるが扱いは書いていない／no 受け付けない／unknown
  function intakeMail(id) {
    const d = intakeOf(id, 'chinjo');
    if (!d || !d.mail) return '';
    const [r, o] = d.mail;
    const NOT_YET = '、まだこのサイトで確かめられていません';
    let t = '';
    if (r === 'review' && o === 'review') t = '📮 郵送でも審査されます';
    else if (r === 'review' && o === 'distribute') t = '📮 住民の郵送は審査されます（住民以外の郵送は議員に配付されます）';
    else if (r === 'distribute' && o === 'distribute') t = '郵送した陳情は議員に配付されます（審査してもらうには持参します）';
    else if (r === 'no' && o === 'no') t = '郵送では受け付けていません（持参で出します）';
    else if (r === 'review') t = `📮 住民の郵送は審査されます（住民以外の郵送の扱いは${NOT_YET}）`;
    else if (r === 'accept') t = `📮 郵送で出せます（審査されるか、議員への配付になるかは${NOT_YET}）`;
    else if (o === 'distribute') t = `住民以外の郵送は議員に配付されます（住民の郵送の扱いは${NOT_YET}）`;
    else if (o === 'no') t = `住民以外は郵送では出せません（住民の郵送の扱いは${NOT_YET}）`;
    if (!t) return '';
    const auto = (d.auto || []).includes('mail') ? '<small class="wz-checked">（公式ページから自動で読み取り）</small>' : '<small class="wz-checked">（議会の公式案内で確認）</small>';
    return `<span class="wz-mail ${r === 'review' && o === 'review' ? 'ok' : 'unknown'}">${t}</span>${auto}`;
  }
  function howTo(info, id) {
    const n = [];
    const im = !mailRule(info) && id ? intakeMail(id) : '';
    if (mailRule(info)) n.push(mailBadge(info));
    else if (im) n.push(im);
    // 扱いが分からない議会も多いので、分からないことを控えめに伝える（出すのをためらわせないよう、警告の形にはしない）
    else n.push('<span class="wz-mail unknown">郵送や、住民以外が出した陳情の扱いは、まだこのサイトで確かめられていません。審査されず議員に配付される議会もあるので、気になるときは議会事務局に聞いてみてください。</span>');
    if (info.denshi) n.push('✅ 電子申請でも出せるようです（紙・封筒・切手は要りません）。');
    if (info.policy) {
      const q = clip(info.policy.source_quote);
      if (q) n.push(`公式案内：「${esc(q)}」`);
      const note = clip(info.policy.note);
      if (note) n.push(`補足：「${esc(note)}」`);
      if (info.policy.source_url) n.push(`<a href="${esc(info.policy.source_url)}" target="_blank" rel="noopener">公式案内の根拠を見る</a>`);
      if (info.policy.confidence !== 'confirmed') n.push('⚠ この情報は確定情報ではありません。提出前に議会事務局へ確認してください。');
    } else {
      const y = info.yusoNote && clip(info.yusoNote);
      if (y) n.push(`${ONLY_HANDOUT.test(y) ? '郵送だと議員に配付される（審査はされない）ようです' : '郵送について'}：「${esc(y)}」`);
      const o = info.outsideNote && clip(info.outsideNote);
      if (o) n.push(`住民以外の陳情について：「${esc(o)}」`);
    }
    if (id) n.push(...intakeNotes(id, 'chinjo'), ...kaitoNotes(id));
    return n.length ? `<ul class="wz-notes">${n.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
  }

  // 参考資料を添えるときの部数（ref_copies）。コンビニの白黒コピーは1枚10円（トップの費用の目安と同じ）。1ページの資料を n 部なら n 枚
  const refCopiesCost = (n) => `参考資料1ページにつき${n}枚、コンビニの白黒コピーで約${n * 10}円`;
  // 出す議会のうち、参考資料の部数が決まっている議会（作成画面の最終画面と出し方メモに出す）
  function refCopiesRows() {
    return real().map((c) => {
      const d = intakeOf(c, 'chinjo');
      return d && d.ref_copies ? { name: `${label(c)}`, n: d.ref_copies, text: clip(d.copies || '') } : null;
    }).filter(Boolean);
  }

  // 受け付け方のデータベース（data/intake.js）から、公式サイト・事務局の回答で確かめたことだけを出す
  const intakeOf = (id, kind) => {
    const [pref, key] = officeKeys[id] || [];
    return ((window.INTAKE || {})[kind || (state.kind === 'request' ? 'yobo' : 'chinjo')] || {})[`${pref}/${key}`];
  };
  const OK = (v) => v === 'accept' || v === 'review';
  const viaText = (v) => (OK(v[0]) && OK(v[1]) ? '' : OK(v[0]) ? '（住民の方）' : '（住民以外の方）');
  function intakeNotes(id, kind) {
    const d = intakeOf(id, kind);
    if (!d) return [];
    const n = [];
    const fieldOf = [];
    const push = (f, t) => { fieldOf.push(f); n.push(t); };
    const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`;
    if (d.form && d.form.some(OK)) push('form', `✅ Webフォーム・電子申請で出せます${viaText(d.form)}。${d.form_url ? link(d.form_url, 'フォームを開く') : '案内ページからフォームへ進みます'}（文面は「文面をすべてコピー」で貼り付けます）。`);
    if (d.email && d.email.some(OK)) push('email', `✅ メールで出せます${viaText(d.email)}${d.email_addr ? `：${esc(d.email_addr)}` : '（あて先は案内ページで確かめます）'}。`);
    if (kind === 'yobo' && d.mail && d.mail.some(OK)) push('mail', `📮 郵送で出せます${viaText(d.mail)}${d.mail_address ? `。送り先：〒${esc(d.mail_zip || '')}　${esc(d.mail_address)}${d.mail_to ? `　${esc(d.mail_to)}` : ''}` : '（送り先の部署は案内ページで確かめます）'}。`);
    if (kind === 'yobo' && d.mail && !d.mail.some(OK) && d.mail.includes('no')) push('mail', '郵送では受け付けていません。');
    if (d.form && !d.form.some(OK) && d.form.includes('no')) push('form', 'Webフォーム・電子申請では受け付けていません。');
    if (d.email && !d.email.some(OK) && d.email.includes('no')) push('email', 'メールでは受け付けていません。');
    if (d.name_published === 'yes') push('name_published', '⚠ 陳情者の氏名は、会議録や文書表などで公開されます。');
    if (d.name_published === 'no') push('name_published', '陳情者の氏名は公開されないと案内されています。');
    if (d.statement === 'yes') push('statement', '委員会で陳情者が趣旨を説明（意見陳述）できます。');
    if (d.result_notice === 'yes') push('result_notice', '審査の結果を知らせてもらえます。');
    if (d.reply === 'yes') push('reply', '回答をもらえます（希望したとき・内容によるときもあります）。');
    if (d.reply === 'no') push('reply', '個別の回答はしないと案内されています。');
    if (d.anonymous_ok === 'no') push('anonymous_ok', '匿名では受け付けていません（住所・氏名を書きます）。');
    if (d.anonymous_ok === 'yes') push('anonymous_ok', '匿名でも受け付けますが、回答はもらえないことがあります。');
    if (d.format_url) push('format_url', `📄 この議会は書式の例（様式・記入例）を出しています：${link(d.format_url, esc(d.format_title || '様式を開く'))}。このサイトの文面を、その様式に写して出すと確実です。`);
    if (d.format) push('format', `書式：「${esc(clip(d.format))}」`);
    if (d.ref_copies) push('ref_copies', `⚠ <b>参考資料を添える（議員に配ってもらう）ときは、${d.ref_copies}部（コピー）</b>を求める議会です。印刷の部数に足してください（${refCopiesCost(d.ref_copies)}）。公式案内：「${esc(clip(d.copies))}」`);
    else if (d.copies) push('copies', `部数：「${esc(clip(d.copies))}」`);
    // 機械で読み取っただけの項目には印を付ける
    const auto = new Set(d.auto || []);
    const mark = (t, f) => (auto.has(f) ? `${t}<small class="wz-checked">（公式ページから自動で読み取り）</small>` : t);
    const out = n.map((t, i) => mark(t, fieldOf[i]));
    if (d.page_url && !(kind === 'yobo' && requestLinks(id).page === d.page_url)) out.push(`${link(d.page_url, '公式の案内ページを開く')}<small class="wz-checked">（${esc(ymd(d.at))}に確認）</small>`);
    // パブリックコメント（制度の案への意見募集）の一覧。自治体（首長部局）のページなので、要望の側のデータから出す
    const pc = (intakeOf(id, 'yobo') || {}).pubcom_url;
    if (pc) out.push(`📝 この自治体は、計画や条例の案への意見募集（パブリックコメント）もしています：${link(pc, '意見募集のページを開く')}`);
    else if (id) out.push(`📝 この自治体のパブリックコメント（意見募集）のページ：調査中。<a href="${esc(window.Common.askUrl(`${municipalityName(id)}のパブリックコメントのページ`, '意見募集のページの URL を教えてください', 'council_procedure'))}" target="_blank" rel="noopener">ご存じなら、ご意見で教えてください</a>`);
    if (isStale(d.at)) out.push(`⚠ このサイトで確かめたのは${esc(ymd(d.at))}で、3か月以上たっています。変わっていることがあるので、出す前に公式の案内ページで確かめてください。`);
    return out;
  }

  // 自治体が公開している「寄せられた意見と回答」（data/kaito.js）。選んでいる項目に関係のある回答は1件ずつ、なければ一覧のページへ
  function kaitoNotes(id) {
    const [pref, key] = officeKeys[id] || [];
    const k = ((window.KAITO || {})[`${pref}/${key}`]);
    if (!k) return [];
    const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
    const mine = new Set(state.items.map((i) => `${window.THEME.id}/${i}`));
    const hits = k.i.filter((x) => x[4].some((a) => mine.has(a)));
    const out = [];
    if (hits.length) {
      out.push(`選んだ内容に近い、過去に寄せられた意見と${esc(headOf(municipalityName(id)))}の回答：<ul>${hits.slice(0, 5).map((x) => `<li>${link(x[1], x[0])}${x[2] ? `（${esc(ymd(x[2]) || x[2].replace(/^(\d{4})-0?(\d+)$/, '$1年$2月'))}${esc(x[3] || '')}）` : '（日付は読み取れませんでした）'}</li>`).join('')}</ul><small class="wz-checked">（機械で選び、題名を見て確かめたものです。回答の中身は開いて確かめてください）</small>`);
    }
    out.push(`${link(k.l[0], hits.length ? '過去の意見と回答の一覧を開く' : '過去に寄せられた意見と回答の一覧を開く')}<small class="wz-checked">（${esc(k.l[1])}。${esc(ymd(k.l[2]))}に${k.l[3] ? '確認' : '自動で見つけたページ'}）</small>`);
    return out;
  }

  // 項目は見出しごとに折りたたむ。選んだ項目がある見出しと、最初の見出しは開いておく
  const openCats = new Set();
  // 要望書は自治体あての文書なので、国への意見書を求める項目と、議会の判断が要る陳情向けの項目は選べない。
  // 陳情書では、役所の担当課が運用で対応できる要望向けの項目は選べない（要望書のほうで選ぶ）
  const usable = (a) => (state.mode === 'both'
    ? window.Petition.usableFor(a, 'petition') || window.Petition.usableFor(a, 'request')
    : window.Petition.usableFor(a, state.kind));
  // いまの出し方では選べない項目の数と、そちらに切り替えるボタン
  function renderRouteNote() {
    const other = state.kind === 'request' ? 'petition' : 'request';
    const n = window.ASKS.filter((a) => !usable(a)).length;
    const el = $('wzRouteNote');
    if (state.mode === 'both') {
      el.hidden = false;
      $('wzRouteCount').textContent = `（陳情書に${countOf('petition')}つ・要望書に${countOf('request')}つ）`;
      el.textContent = '選んだ内容は、向きで自動で振り分けます。国への意見書や、条例・予算など議会の判断が要る内容は陳情書に、役所の担当課が自分でできる内容は要望書に、どちらにも向く内容は両方に入ります。';
      return;
    }
    el.hidden = !n;
    $('wzRouteCount').textContent = n ? `（${state.kind === 'request' ? '陳情書' : '要望書'}なら、ほかに${n}件選べます）` : '';
    if (!n) return;
    el.innerHTML = state.kind === 'request'
      ? `要望書では、役所の担当課が自分の判断でできることを選べます。国への意見書や、条例・予算など議会の判断が要る内容（${n}件）は、陳情書のほうにあります。<button type="button" class="btn btn-small" data-switch-kind="${other}">陳情書で選ぶ</button>`
      : `陳情書では、議会に取り上げてもらう内容を選べます。通知・窓口・研修・公表など、役所の担当課が運用で対応できる内容（${n}件）は、要望書のほうにあります。<button type="button" class="btn btn-small" data-switch-kind="${other}">要望書で選ぶ</button>`;
  }
  $('wzRouteNote').addEventListener('click', (e) => {
    const to = e.target.dataset && e.target.dataset.switchKind;
    if (!to) return;
    state.kind = to;
    state.mode = to;
    setKindInputs();
    renderItems();
    updateNav();
    saveDraft();
  });
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
        const doc = state.kind === 'request' ? '要望' : '陳情';
        return `<button type="button" class="wz-card ${on ? 'on' : ''}" data-item="${a.id}" aria-pressed="${on}" data-text="${esc(a.label + a.reason)}"><b>${a.label}${window.Common.scopeTag(a)}</b><span>${a.reason.split('。')[0]}。</span><span class="wz-card-row">${window.Common.askTags(a) ? `<span class="ask-tags">${window.Common.askTags(a)}</span>` : ''}<span class="wz-bg" data-easy="/${window.THEME.id}/easy/${a.id}" title="なぜこの${doc}が必要か・どう役立つか（新しいタブで開きます）">この${doc}の意義 ↗</span></span>${a.pair && window.Petition.ITEMS[a.pair] ? `<small class="wz-pair">あわせて出すのがおすすめ：${esc(window.Petition.ITEMS[a.pair].label)}</small>` : ''}</button>`;
      }).join('')}</div></details>`;
    }).join('');
    document.querySelectorAll('#wzItems .wz-cat').forEach((cat) => { cat.querySelector('.wz-cat-n').innerHTML = catCount(cat); });
    renderRouteNote();
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
    renderItemsAll();
  }
  // 見えている内容（開いている見出しの中で、絞り込みに当てはまるもの）をまとめて選ぶ・外す
  const visibleItems = () => [...document.querySelectorAll('#wzItems .wz-cat[open]:not([hidden]) [data-item]:not([hidden])')];
  function renderItemsAll() {
    const vis = visibleItems();
    const all = vis.length && vis.every((b) => state.items.includes(b.dataset.item));
    $('wzItemsAll').hidden = !vis.length;
    $('wzItemsAll').textContent = all ? `見えている${vis.length}件の選択をすべて外す` : `見えている${vis.length}件をすべて選ぶ`;
    $('wzItemsAll').dataset.all = all ? '1' : '';
    $('wzItemsAllNote').textContent = vis.length > 3 && !all ? '（たくさん選ぶと、1件ごとに陳情書が1通ずつできます）' : '';
  }
  $('wzItemsAll').addEventListener('click', () => {
    const vis = visibleItems().map((b) => b.dataset.item);
    if ($('wzItemsAll').dataset.all) state.items = state.items.filter((k) => !vis.includes(k));
    else vis.forEach((k) => { if (!state.items.includes(k)) state.items.push(k); });
    const q = $('wzItemFilter').value;
    renderItems();
    $('wzItemFilter').value = q;
    filterItems();
    saveDraft();
    updateNav();
  });
  $('wzItemFilter').addEventListener('input', filterItems);
  $('wzItems').addEventListener('toggle', (e) => {
    const c = e.target.dataset && e.target.dataset.cat;
    if (c && !$('wzItemFilter').value) (e.target.open ? openCats.add(c) : openCats.delete(c));
    if (c) renderItemsAll();
  }, true);

  $('wzRoles').innerHTML = ROLES.map(([k, label]) => `<button type="button" class="wz-card wz-small" data-role="${k}"><b>${label}</b></button>`).join('');
  setKindInputs();
  kindInputs().forEach((r) => r.addEventListener('change', () => {
    state.mode = r.value;
    state.kind = r.value === 'both' ? 'petition' : r.value;
    fixKind();
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
    if (s === 'items' && !state.items.length) return '求める内容を1つ以上選んでください';
    if (s === 'you' && !state.role) return '①あなたの立場を選んでください（住所・氏名は空でもかまいません）';
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
  // 陳情書と要望書で言い方が違う所。data-doc-name は文書の名前、data-request-html は要望書のときの中身
  function renderKindText() {
    const request = state.kind === 'request';
    document.querySelectorAll('[data-doc-name]').forEach((el) => { el.textContent = request ? '要望書' : '陳情書'; });
    document.querySelectorAll('[data-request-html]').forEach((el) => {
      if (el.dataset.petitionHtml === undefined) el.dataset.petitionHtml = el.innerHTML;
      el.innerHTML = request ? esc(el.dataset.requestHtml) : el.dataset.petitionHtml;
    });
  }
  function updateNav() {
    // 見出しとタブの題を、作る文書（陳情書・要望書）に合わせる
    const heading = state.mode === 'both' ? '陳情書・要望書をつくる' : `${state.kind === 'request' ? '要望書' : '陳情書'}をつくる`;
    document.querySelectorAll('#generator h1, .hero-crumb b').forEach((h) => { if (/をつくる$/.test(h.textContent)) h.textContent = heading; });
    document.title = document.title.replace(/^[^｜]*をつくる/, heading);
    document.querySelectorAll('[data-petition-only]').forEach((el) => { el.hidden = state.kind === 'request'; });
    renderKindText();
    const lead = document.querySelector('#generator .lead-sm');
    if (lead) lead.textContent = state.mode === 'both' ? '選択肢を押していくだけで、議会に出す陳情書と、市区町村長・知事に出す要望書が両方できます。' : state.kind === 'request' ? '選択肢を押していくだけで、市区町村長・知事に出せる要望書ができます。' : '選択肢を押していくだけで、議会に出せる陳情書ができます。';
    $('wzNext').disabled = !canNext();
    // 選び終えたら［次へ］を目立たせて、押せばよいことが分かるようにする
    $('wzNext').classList.toggle('is-ready', !!canNext() && STEPS[state.step] !== 'done');
    $('wzNextWhy').textContent = whyNotNext();
    renderPreview();
  }

  function show() {
    const s = STEPS[state.step];
    fixKind();
    // 自治体ごとのデータ（data/pref/*.js）は、選んだ都道府県の分だけ読み込む。届いたら描き直す
    const need = [state.pref, ...state.councils.map(prefOf)];
    if (!window.PrefData.has(need)) window.PrefData.load(need).then(show);
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
    if (s === 'send') $('wzHotline').hidden = !cur().some(isNat);
    if (s === 'send') { renderCheckMail(); renderNow(); renderCheckLeft(); renderChairs(); }
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
    // カードの中の「この陳情の意義」は、選ぶ・外すをせずに説明のページを開く
    const easy = e.target.closest('[data-easy]');
    if (easy) { window.open(easy.dataset.easy, '_blank', 'noopener'); return; }
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
    } else if (d.mailBox) {
      // 郵送の扱いの一覧から、全国・都道府県ごとにまとめて選ぶ（全部選ばれていれば外す）
      const ids = d.mailBox.split(',').filter(Boolean);
      if (allOn(ids)) state.councils = state.councils.filter((id) => !ids.includes(id));
      else ids.forEach((id) => { if (!state.councils.includes(id)) state.councils.push(id); });
      if (!state.pref && ids.length) state.pref = prefOf(ids[0]);
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
      renderItemsAll();
      renderCount();
      if (state.mode === 'both') renderRouteNote();
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
    // 選んだ都道府県の分（data/pref/）が届くまでは、全国分の郵送の一文（data/council-mail.js）だけで判断する
    const info = (window.COUNCILS[pref] || {})[key] || ((window.COUNCILS_MAIL || {})[pref] || {})[key] || {};
    const m = ((window.MAIL || {})[pref] || {})[key];
    const policy = window.MailPolicy && window.MailPolicy.get(pref, key);
    return m ? { ...info, mail: m[0], yusoNote: m[1], policy } : { ...info, policy };
  };

  function formData() {
    const fd = new FormData();
    cur().forEach((k) => fd.append('items', k));
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
  // 陳情書と要望書は文面が違うので、直した文面は別々に残す（陳情書は前からのキーのまま）
  const ek = (k) => (state.kind === 'request' ? `request:${k}` : k);
  const { swapCouncil } = window.Petition;
  // 要望書で「回答を希望する」を選んだときだけ、最後に回答のお願いを入れる
  const replied = (text) => window.Petition.withReply(text, state.kind === 'request' && state.reply);
  const forCouncil = (text, c) => swapCouncil(text, nameOf(state.councils[0]), nameOf(c));

  function build() {
    const first = nameOf(state.councils[0]);
    const fd = formData();
    renderMerge();
    renderReply();
    renderKindTabs();
    renderEligible();
    const keys = docKeys();
    // 意見書の案は、国に意見書を求める陳情のときだけ選べる
    const P = window.Petition;
    $('wzIkensho').closest('label').hidden = state.kind === 'request' || !keys.some((k) => keysOf(k).some((x) => P.ITEMS[x] && P.isNational(P.ITEMS[x])));
    // 差出人が空なら、入れるとそのまま出せる形になることを知らせる
    $('wzNoSender').hidden = !!(sender.address || sender.name);
    $('wzDocs').innerHTML = keys.map((k, i) => {
      const it = { label: docLabel(k) };
      const e = edits[ek(k)];
      // 前に別の議会あてに直した文面は、宛名と自治体名をいまの議会に差し替えて使う
      const text = replied(withSender(e ? swapCouncil(e.text, e.council, first) : window.Petition.build(fd, first, keysOf(k)), sender));
      const others = state.councils.slice(1).map(label);
      return `<details class="wz-doc" ${i === 0 || keys.length <= 3 ? 'open' : ''}>
        <summary><b>${i + 1}. ${esc(it.label)}</b><span><i class="wz-edited"${e ? '' : ' hidden'}>直した文面・</i>${state.councils.length}通</span></summary>
        ${e && e.role !== state.role ? '<p class="hint-sm warn">立場を選び直す前に直した文面です。最後の一文があなたの立場に合っているか確かめてください。</p>' : ''}
        ${others.length ? `<p class="hint-sm">下は${esc(first)}あての文面です。${others.map(esc).join('・')}あてにも、同じ内容で1通ずつ作ります。ここで直すと、宛名と自治体名を差し替えてすべての議会に反映されます。</p>` : ''}
        <textarea class="wz-paper" rows="4" spellcheck="false" data-key="${esc(k)}" aria-label="${esc(it.label)}の文面">${esc(text)}</textarea>
        <p class="wz-docstat hint-sm" aria-live="polite"></p>
        <div class="out-toolbar"><button type="button" class="btn btn-small" data-doc-ai="${i}">生成AIで自分の言葉に直す</button><button type="button" class="btn btn-small" data-doc-reset="${esc(k)}"${e ? '' : ' hidden'}>元の文面に戻す</button></div>
      </details>`;
    }).join('');
    areas().forEach((ta) => { fit(ta); docStat(ta); });
    const document = state.kind === 'request' ? '要望書' : '陳情書';
    $('wzSummary').textContent = real().length
      ? `${state.councils.length}つの自治体 × ${keys.length === 1 && cur().length > 1 ? `${cur().length}つの内容をまとめた1通` : `${keys.length}つの内容`} ＝ ${document} ${state.councils.length * keys.length}通`
      : `自治体名を空けた${document} ${keys.length}通（提出先が決まったら手書きで入れてください）`;
    renderMatrix();
    renderOffices();
  }

  // 要望書の回答を希望するか。要らない人もいるので、選んだときだけ文面に入れる
  function renderReply() {
    const box = $('wzReply');
    if (!box) return;
    box.hidden = state.kind !== 'request';
    $('wzReplyOn').checked = !!state.reply;
  }
  if ($('wzReplyOn')) $('wzReplyOn').addEventListener('change', (e) => {
    state.reply = e.target.checked;
    build(); renderNow(); saveDraft();
  });

  // まとめて1通にするかの切り替え。まとめられないときは理由を出す
  function renderMerge() {
    const n = cur().length;
    const box = $('wzMerge');
    box.hidden = n < 2;
    if (box.hidden) return;
    const ok = canMerge();
    const radios = [...document.querySelectorAll('input[name="wzMergeOn"]')];
    radios.forEach((r) => {
      r.disabled = !ok && r.value === 'merge';
      r.checked = r.value === (ok && state.merge ? 'merge' : 'split');
    });
    $('wzMergeLabel').textContent = `選んだ${n}つの内容を、1つずつ分けて出すか、まとめて1通にするか`;
    $('wzMergeWhy').textContent = ok
      ? ''
      : n > MERGE_MAX ? `まとめられるのは${MERGE_MAX}つまでです。`
        : '国に意見書を出すよう求める内容と、自治体の取り組みを求める内容が混ざっているため、まとめられません（文書の種類が違います）。';
  }
  document.querySelectorAll('input[name="wzMergeOn"]').forEach((r) => r.addEventListener('change', (e) => {
    if (!e.target.checked) return;
    state.merge = e.target.value === 'merge';
    build(); renderNow(); saveDraft();
  }));

  // 何通できるかを、宛先 × 内容の表で見せる。1通ずつでも、まとめて1つのPDFでも開ける
  function renderMatrix() {
    const docName = state.kind === 'request' ? '要望書' : '陳情書';
    const items = docKeys().map((k) => ({ label: docLabel(k) }));
    const total = items.length * state.councils.length;
    const head = `<tr><th scope="col">内容 ＼ 宛先</th>${state.councils.map((c) => `<th scope="col">${esc(isNone(c) ? '（宛先を空ける）' : municipalityName(c))}</th>`).join('')}</tr>`;
    const rows = items.map((it, i) => `<tr><th scope="row">${i + 1}. ${esc(it.label)}</th>${state.councils.map((c, j) => `<td>1通</td>`).join('')}</tr>`).join('');
    $('wzMatrix').innerHTML = `<div class="table-scroll"><table class="compare">${head}${rows}</table></div>
      ${total > 1 ? `<p class="hint-sm"><b>${docName}は1通ずつ別の紙になります</b>（1通ごとに署名が要ります）。印刷用のPDFは、次の画面で${total}通を1つにまとめて開けます。同じ議会に出す分は、1つの封筒にまとめて送れます。</p>` : ''}`;
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
  const docFor = (ta, c) => replied(withChair(withSender(edits[ek(ta.dataset.key)] ? forCouncil(ta.value, c)
    : window.Petition.build(formData(), nameOf(c), keysOf(ta.dataset.key)), sender), c)).trim();
  // ---------- 要望書を出せる人（住民だけ・市に関わりのある人だけ）と、差出人の住所 ----------
  // eligible：resident＝住民だけ／related＝在住・在勤・在学など市に関わりのある人だけ（公式サイトで確かめた自治体だけ。data/intake/yobo.jsonl）
  const eligibleOf = (c) => (isNone(c) ? '' : (intakeOf(c, 'yobo') || {}).eligible || '');
  // 差出人の住所がその自治体の中か。住所が空なら null（判断しない）
  const livesIn = (c) => {
    const a = (sender.address || '').replace(/\s/g, '');
    if (!a) return null;
    const name = municipalityName(c);
    if (name === prefOf(c)) return a.startsWith(name) || !window.PREFS.some((p) => a.startsWith(p));
    return a.includes(name.replace(/^.*郡/, ''));
  };
  // 在勤・在学などで市に関わりがあると答えた自治体
  const related = new Set();
  const reqBlocked = (c) => {
    if (state.kind !== 'request') return false;
    const el = eligibleOf(c);
    if (!el || livesIn(c) !== false) return false;
    return el === 'resident' || !related.has(c);
  };
  // 文書を作る宛先。要望書では、出す資格のない自治体を外す
  const targets = () => state.councils.filter((c) => !reqBlocked(c));
  function renderEligible() {
    const box = $('wzEligible');
    const head = (c) => window.Petition.requestTo(municipalityName(c));
    const rows = state.kind !== 'request' ? [] : real().map((c) => {
      const el = eligibleOf(c);
      const lives = livesIn(c);
      const town = municipalityName(c);
      const who = el === 'resident' ? `${town}に住んでいる人だけ` : `${town}に住んでいる人・通勤や通学をしている人など、${town}に関わりのある人だけ`;
      const page = (intakeOf(c, 'yobo') || {}).page_url;
      const src = page ? `（<a href="${esc(page)}" target="_blank" rel="noopener">公式の案内</a>による）` : '（公式の案内による）';
      if (!el) return lives === false ? `<li>${esc(town)}：差出人の住所が${esc(town)}ではありません。${esc(head(c))}あての要望を、住民以外からも受け付けるかは、このサイトではまだ確かめられていません（調査中）。出す前に案内ページで確かめてください。<a href="${esc(window.Common.askUrl(`${town}の要望を出せる人`, '住民以外からも受け付けるか、公式の案内ページの URL を教えてください', 'council_procedure'))}" target="_blank" rel="noopener">公式の案内ページを知っていれば、ご意見で教えてください</a></li>` : '';
      if (lives === null) return `<li>${esc(head(c))}への要望を出せるのは、<b>${esc(who)}</b>です${src}。下の「差出人」に住所を入れると、出せるかを確かめます。</li>`;
      if (lives) return '';
      if (el === 'resident') return `<li class="warn">⛔ <b>${esc(head(c))}への要望を出せるのは、${esc(who)}です</b>${src}。差出人の住所が${esc(town)}ではないので、${esc(town)}あての要望書は作りません。議会あての陳情書なら、住所に関係なく受け付ける議会もあります。</li>`;
      return `<li class="${related.has(c) ? '' : 'warn'}">${related.has(c) ? '' : '⛔ '}<b>${esc(head(c))}への要望を出せるのは、${esc(who)}です</b>${src}。差出人の住所が${esc(town)}ではありません。${related.has(c) ? `${esc(town)}に関わりがあるとのことなので、${esc(town)}あての要望書も作ります。` : `このままでは${esc(town)}あての要望書は作りません。`}<br><label><input type="checkbox" data-related="${esc(c)}"${related.has(c) ? ' checked' : ''}> ${esc(town)}に通勤・通学している（または${esc(town)}にある団体として出す）</label>${related.has(c) ? '<span class="hint-sm">要望書の中で、どう関わっているか（勤め先・学校など）を一言書き添えると伝わります。</span>' : ''}</li>`;
    }).filter(Boolean);
    box.hidden = !rows.length;
    box.innerHTML = rows.length ? `<p><b>この要望書を出せる人</b></p><ul>${rows.join('')}</ul>${real().length && !targets().filter((c) => !isNone(c)).length ? '<p class="warn">選んだ自治体には、いまの住所では要望書を出せません。</p>' : ''}` : '';
  }
  $('wzEligible').addEventListener('change', (e) => {
    const c = e.target.dataset && e.target.dataset.related;
    if (!c) return;
    if (e.target.checked) related.add(c); else related.delete(c);
    build();
  });
  const allDocs = () => targets().flatMap((c) => areas().map((ta) => docFor(ta, c)));
  $('wzDocs').addEventListener('input', (e) => {
    const k = e.target.dataset.key;
    if (!k) return;
    edits[ek(k)] = { text: e.target.value, council: nameOf(state.councils[0]), role: state.role, day: window.Common.reiwaToday() };
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
    const a = e.target.dataset.docAi;
    if (a !== undefined) openRewrite(areas()[a]);
    const k = e.target.dataset.docReset;
    if (k !== undefined) {
      delete edits[ek(k)];
      saveEdits();
      build();
    }
  });

  // ---------- 生成AIで中身だけ直す ----------
  // 選んだ文面の趣旨と理由だけを AI に渡し、返ってきた答えをその2か所に入れ替える（1つ目の議会あての文面を直す）
  let rwArea = null;
  const kindWord = () => (state.kind === 'request' ? '要望' : '陳情');
  const rwPrompt = () => {
    $('wzRwPrompt').value = window.Petition.buildRewritePrompt(rwArea.value, nameOf(state.councils[0]), { local: $('wzRwLocal').value, story: $('wzRwStory').value });
  };
  function openRewrite(ta) {
    rwArea = ta;
    $('wzRwTitle').textContent = `「${ta.closest('.wz-doc').querySelector('summary b').textContent}」`;
    $('wzRwAnswer').value = '';
    $('wzRwPlans').hidden = true;
    rwPrompt();
    if (!$('wzRwPrompt').value) { flash(`「${kindWord()}の趣旨」「${kindWord()}の理由」の見出しが見つからないので、AIに渡せません。元の文面に戻してから試してください。`, 5000); return; }
    $('wzRwBox').hidden = false;
    $('wzRwBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  ['wzRwLocal', 'wzRwStory'].forEach((id) => $(id).addEventListener('input', () => rwArea && rwPrompt()));
  $('wzRwClose').addEventListener('click', () => { $('wzRwBox').hidden = true; });
  $('wzRwApply').addEventListener('click', () => {
    const out = rwArea && window.Petition.applyRewrite(rwArea.value, $('wzRwAnswer').value);
    if (!out) { flash(`AIの答えに「【${kindWord()}の趣旨】」「【${kindWord()}の理由】」の目印が見つかりません。答えを丸ごと貼り付けるか、AIにもう一度頼んでください。`, 6000); return; }
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
    navigator.geolocation.getCurrentPosition(async (p) => {
      // 近い議会は全国から探すので、ここだけは全都道府県の行き方を読み込む
      await window.PrefData.loadAll();
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

  // 提出の記録：選んだ内容（「テーマ/項目id」）と、その議会に同じ内容の記録があるか
  const askIds = () => [...new Set(cur().flatMap(keysOf))].map((k) => `${window.THEME.id}/${k}`);
  const sameAsks = (c) => {
    const mine = new Set(askIds());
    return window.Report.asked(c).filter((r) => mine.has(r.ask));
  };
  const sameHtml = (c) => {
    const same = sameAsks(c);
    if (!same.length) return '';
    const names = same.map((r) => `「${esc((window.Petition.ITEMS[r.ask.split('/')[1]] || {}).label || r.ask)}」（最後は${esc(String(r.last || '').slice(0, 7))}）`).join('、');
    return `<span class="wz-row wz-same"><b>同じ内容</b>この議会には、${names}の提出の記録があります。同じ趣旨の陳情は、まとめて1件として扱われたり、すでに結論が出ていると審査されなかったりすることがあります。出す前に、議会事務局に扱いを確かめてください。</span>`;
  };
  // いたずら対策：この画面で PDF を開く・保存する・文面をコピーするまでは、記録のボタンを押せない
  // 印刷・コピーのあとで押せる。出し方メモの QR コードから来たときは、もう印刷してあるので最初から押せる
  let printed = false;
  const markPrinted = () => { if (!printed) { printed = true; renderReportBtns(); renderOffices(); } };
  const reportBtn = (c) => !printed && !window.Report.reported(c)
    ? `<button type="button" class="btn btn-small wz-report" disabled>${esc(label(c))}に出した（記録する）</button>`
    : `<button type="button" class="btn btn-small wz-report" data-report="${esc(c)}" ${window.Report.reported(c) ? 'disabled' : ''}>${window.Report.reported(c) ? `✓ ${esc(label(c))}への提出を記録しました` : `${esc(label(c))}に出した（記録する）`}</button>`;
  function renderReportBtns() {
    if (!$('wzNowReportBtns')) return;
    $('wzNowReportBtns').innerHTML = window.Report.enabled ? real().map(reportBtn).join(' ') + (printed ? '' : '<span class="hint-sm">上の「印刷用のPDFを開く」「PDFを保存する」「文面をすべてコピー」のどれかを使うと、押せるようになります。</span>') : '<span class="wz-notfound">準備中です。記録を受け付けられるようになったら、ここにボタンが出ます。</span>';
  }

  function renderOffices() {
    renderReportBtns();
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
        ${sameHtml(c)}
        ${badge ? telHtml(pref, key, !page) : ''}
        ${page ? '' : `<span>陳情の出し方のページが見つかりませんでした（調査中）。小さな議会では案内ページを置いていないことも多いので、議会事務局に電話で出し方と締切を聞くのが確実です。<a href="${esc(window.Common.askUrl(`${label(c)}の陳情の出し方`, '出し方の案内ページの URL を教えてください', 'council_procedure'))}" target="_blank" rel="noopener">案内ページを知っていれば、ご意見で教えてください</a></span>`}
        ${badge ? '' : `<span class="hint-sm">郵送の扱い：調査中。<a href="${esc(window.Common.askUrl(`${label(c)}の陳情の郵送の扱い`, '郵送で審査されるかが分かる公式の案内ページの URL を教えてください', 'council_procedure'))}" target="_blank" rel="noopener">分かる方は、ご意見で教えてください</a></span>`}
        <span class="wz-links">${links}</span>
        ${window.Report.enabled ? reportBtn(c) : ''}</li>`;
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

  $('wzToSender').addEventListener('click', () => {
    go(STEPS.indexOf('you') - state.step);
    setTimeout(() => { const el = $('wzSender').querySelector('[data-sender="address"]'); if (el) el.focus(); }, 50);
  });
  // 差出人（あなた）の住所・氏名。入れるとすぐ、下の文面の住所・氏名の行に入る
  const sender = window.Common.bindSender($('wzSender'), () => {
    areas().forEach((ta) => { ta.value = withSender(ta.value, sender); });
    // 住所が変わると、要望書を出せる自治体が変わる
    if (state.kind === 'request' && real().some(eligibleOf)) renderEligible();
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
  const onReport = async (e) => {
    const id = e.target.dataset.report;
    if (!id) return;
    e.target.disabled = true;
    e.target.textContent = '送っています…（数秒かかります）';
    const ok = await window.Report.report(id, cur().length, askIds());
    e.target.textContent = ok ? '✓ 提出を報告しました。ありがとうございます' : '送れませんでした。もう一度押してください';
    e.target.disabled = ok;
    if (ok) {
      renderReportBtns();
      const ics = window.Followup && window.Followup.icsLink(id);
      if (ics) $('wzNowReportBtns').append(' ', ics);
    }
  };
  $('wzOffices').addEventListener('click', onReport);
  $('wzNowReportBtns').addEventListener('click', onReport);
  // 同じ内容の記録が届いたら、議会の案内に出し直す
  window.Report.asksLoaded.then(() => { if (window.Report.asksLive) renderOffices(); });
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
  // 共有リンク。議会は全国地方公共団体コード（5桁）、区切りは「.」にして、日本語を % で書き換えずに済むようにする
  // （QR コードが小さくなる）。コードが分からない議会（「国あてだけ」など）があるときは、前の形式の名前で書く
  function linkOf() {
    const pl = (c) => (isNone(c) ? null : window.Places.of(prefOf(c)).find((x) => x.council === nameOf(c)));
    const codes = state.councils.map((c) => (pl(c) || {}).code);
    const pp = String(window.PREFS.indexOf(state.pref) + 1).padStart(2, '0');
    if (codes.every(Boolean) && window.PREFS.includes(state.pref)) {
      return `${location.origin}${location.pathname}#w?i=${state.items.join('.')}&p=${pp}&c=${codes.join('.')}&r=${encodeURIComponent(state.role)}${state.mode === 'both' ? '&k=b' : ''}`;
    }
    const q = new URLSearchParams({ i: state.items.join(','), p: state.pref, c: state.councils.join(','), r: state.role, ...(state.mode === 'both' ? { k: 'b' } : {}) });
    return `${location.origin}${location.pathname}#w?${q}`;
  }
  // 短い形式（数字のコード）の議会と都道府県を、名前に戻す
  const fromCode = (c) => { const pl = /^\d{5}$/.test(c) && window.Places.byCode(c); return pl ? idOf(pl.pref, pl.council) : c; };
  const prefFrom = (p) => (/^\d{2}$/.test(p || '') ? window.PREFS[Number(p) - 1] || '' : p);
  function saveLink(done) {
    const url = done ? linkOf() : location.pathname + location.search;
    history.replaceState({ step: state.step }, '', url);
  }
  let fromMemo = false;
  function restore() {
    const m = location.hash.match(/^#w\?(.*)$/);
    if (!m) return false;
    const q = new URLSearchParams(m[1]);
    // 前の形式のリンクに付いている t（国か自治体か）は、項目から分かるので読まない
    const items = (q.get('i') || '').split(/[.,]/).filter((k) => window.ASKS.some((a) => a.id === k));
    const pref = prefFrom(q.get('p'));
    if (!items.length || !(window.PREFS.includes(pref) || q.get('c') === NONE)) return false;
    // 前の形式のリンク（議会名だけ）は、p の都道府県の議会として読む
    const councils = (q.get('c') || '').split(/[.,]/).map(fromCode).map((c) => (c.includes('/') ? c : idOf(pref, c)))
      .filter((c) => isNone(c) || (window.PREFS.includes(prefOf(c)) && councilsOf(prefOf(c)).includes(nameOf(c))));
    const role = q.get('r');
    if (!councils.length || !ROLES.some(([k]) => k === role)) return false;
    // s=send：出し方メモの QR コードから来たとき。出した議会を選んだまま「印刷・提出」の画面を開き、記録のボタンを押せるようにする
    const toSend = q.get('s') === 'send';
    Object.assign(state, { items, pref, councils, role, step: STEPS.indexOf(toSend ? 'send' : 'done'), ...(q.get('k') === 'b' ? { mode: 'both' } : {}) });
    fromMemo = toSend;
    return true;
  }

  // QR コードを作る道具（vendor/qrcode.js）は、このボタンを押したときに初めて読み込む
  const loadQr = () => (window.qrcode ? Promise.resolve() : new Promise((ok, ng) => {
    const s = document.createElement('script');
    s.src = '/vendor/qrcode.js';
    s.onload = ok;
    s.onerror = ng;
    document.head.append(s);
  }));
  $('wzSend').addEventListener('click', async () => {
    try { await loadQr(); } catch { flash('QRコードを作れませんでした。電波の良いところでもう一度押してください'); return; }
    const url = linkOf();
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    $('wzQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    const docName = state.kind === 'request' ? '要望書' : '陳情書';
    const subject = `${docName}（${window.THEME.name}）`;
    $('wzMail').href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`あとで開く${docName}のリンク：\n${url}`)}`;
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
        if (label) return `<li><b>${esc(municipalityName(id))}</b>：${esc(label)}${r ? checkedTag(infoOf(id)) : ''}${state.kind === 'petition' ? tipForm(id, true) : ''}</li>`;
        const [pref, key] = officeKeys[id] || [];
        return `<li><b>${esc(municipalityName(id))}</b>：このサイトではまだ扱いを調べられていません。議会事務局に電話で次のことを聞くと確実です。${telHtml(pref, key, false)}
          <ul class="wz-ask">
            <li>陳情は郵送でも受け付けますか。郵送だと審査されますか、議員に配るだけですか（住民以外が出す場合も）</li>
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
        <fieldset><legend>郵送した陳情は</legend>${radio('mail', [['review', '審査される'], ['distribute', '議員に配るだけ'], ['unknown', '分からない']])}</fieldset>
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
  // 公式の議員名簿から読み取った議長（scripts/roster-chairs.js）。入っていない欄にだけ入れ、読み取ったことを添える
  const rosterCache = {};
  const chairAuto = {};
  const loadRosterPref = (pref) => (rosterCache[pref] ||= fetch(`/data/roster/${encodeURIComponent(pref)}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  async function fillChairs(list) {
    let changed = false;
    for (const c of list) {
      const [pref, key] = officeKeys[c] || [];
      if (!pref || chairs[c]) continue;
      const r = (await loadRosterPref(pref))[`${pref}/${key}`];
      if (r && r.chair) { chairs[c] = r.chair; chairAuto[c] = r; changed = true; }
    }
    if (changed && STEPS[state.step] === 'send') {
      renderChairs(true);
      const all = real().every((id) => chairs[id]);
      if ($('wzChkChair').checked !== all) { $('wzChkChair').checked = all; renderCheckLeft(); }
      const c0 = state.councils[0];
      if (chairs[c0]) areas().forEach((ta) => { ta.value = ta.value.replace(chairRe, `$1　${chairs[c0]}　様`); });
    }
  }
  function renderChairs(filled) {
    const list = real();
    $('wzChairs').innerHTML = list.map((c) => {
      const a = chairAuto[c];
      const note = a && chairs[c] === a.chair ? `<small class="wz-checked">（${esc(ymd(a.chair_checked_at))}に<a href="${esc(a.url)}" target="_blank" rel="noopener">議会の公式の議員名簿</a>から自動で読み取りました）</small>` : '';
      return `<label>${esc(label(c))}の議長の氏名
      <input data-chair="${esc(c)}" value="${esc(chairs[c] || '')}" maxlength="20" autocomplete="off" placeholder="例：山田 太郎">
      <a href="https://www.google.com/search?q=${encodeURIComponent(`${label(c)} 議長`)}" target="_blank" rel="noopener">議長を調べる</a>${note}</label>`;
    }).join('');
    $('wzChairBox').hidden = !list.length || state.kind === 'request';
    if (!filled && state.kind !== 'request') fillChairs(list);
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
    renderNowRefCopies();
    renderNowAsk();
  }
  // 参考資料を添えるときの部数が決まっている議会を、印刷の前に知らせる（陳情書そのものは、出す先1つにつき1通のまま）
  function renderNowRefCopies() {
    let box = $('wzNowRef');
    if (!box) {
      box = document.createElement('div');
      box.id = 'wzNowRef';
      $('wzNowCount').after(box);
    }
    const rows = state.kind === 'request' ? [] : refCopiesRows();
    box.hidden = !rows.length;
    box.className = 'wz-ref-copies';
    box.innerHTML = rows.length
      ? `<p><b>⚠ 参考資料を添える議会があります。印刷の部数に足してください。</b>${esc(docNameOf(state.kind))}そのものは、出す先1つにつき1通のままです。</p><ul class="wz-notes">${rows.map((r) => `<li>${esc(r.name)}：参考資料を添える（議員に配ってもらう）ときは<b>${r.n}部</b>（${esc(refCopiesCost(r.n))}）。公式案内：「${esc(r.text)}」</li>`).join('')}</ul><p class="hint-sm">参考資料を添えないなら、不要です。出す前に、議会事務局に今の決まりを確かめてください。</p>`
      : '';
  }
  // 要望書の出し方のページ。都道府県・政令指定都市・人口の多い市区町村は、公式サイトで確かめたページ（data/request-pages.js）へ直接案内する。
  // ないところは公式サイトの中を検索する。「要望」で探すと、県や市が国へ出した要望書の一覧が出てくるので、言葉に入れない
  function requestLinks(id) {
    const [pref, key] = officeKeys[id] || [];
    const [site] = (window.SITES[pref] || {})[key] || [];
    const page = (window.REQUEST_PAGES || {})[`${pref}/${key}`];
    const name = municipalityName(id);
    const head = headOf(name);
    const q = `${site ? `site:${new URL(site).hostname}` : name} ${head}への手紙 OR 市民の声 OR 県民の声 OR ご意見 OR ご提案 -パブリックコメント`;
    return { page: page && page[0], title: page && page[1], results: `https://www.google.com/search?q=${encodeURIComponent(q)}` };
  }


  // 持参・郵送の送り先（議会事務局の住所）を、出す段落に1行ずつ出す。宛名の用紙と同じ住所
  function sendTo() {
    const rows = real().map((c) => {
      const [pref, key] = officeKeys[c] || [];
      const o = pref ? window.Places.office(pref, key) : {};
      return o.address ? `<li>${esc(label(c))}：〒${esc(o.zip)}　${esc(o.address)}${o.main ? '<small class="wz-checked">（役所の本庁舎。議会事務局が別の建物のこともあります）</small>' : ''}</li>` : '';
    }).filter(Boolean);
    return rows.length ? `<br>送り先・持っていく先：<ul class="wz-notes">${rows.join('')}</ul>` : '';
  }

  // 要望書は議会に出すものではないので、議長・締切・郵送の審査・提出報告など議会の手続の欄は出さない
  function renderKindParts() {
    const request = state.kind === 'request';
    $('wzNowChairItem').hidden = request;
    $('wzNowAskH').textContent = request ? '出し方のページを開く' : '出し方を決める';
    $('wzNowReport').hidden = request;
    $('wzNowHow').innerHTML = request
      ? '<b>出す</b>上で開いたページに書かれた方法（窓口・郵送・メール・フォームなど）で出します。宛名の知事・市区町村長と「様」のあいだは、氏名を書き入れても空けたままでも構いません。メールやフォームで出すときは、「文面をすべてコピー」した文を貼り付けます。'
      : `<b>出す</b>持参・郵送・電子申請。議会ごとの出し方は、下の「くわしい手順」の②にあります。締切を過ぎても、次の定例会で扱われます。${sendTo()}`;
    renderAlso();
    document.querySelectorAll('[data-petition-only]').forEach((el) => { el.hidden = request; });
  }

  // 陳情書と要望書の両方を作るときは、ここで切り替える。片方だけのときは、両方を作る形に切り替えるボタンを出す
  function kindTabs() {
    return ['petition', 'request'].map((k) => {
      const n = countOf(k);
      const on = state.kind === k;
      return `<button type="button" class="btn btn-small${on ? ' btn-primary' : ''}" aria-pressed="${on}" data-also-tab="${k}"${n ? '' : ' disabled'}>${docNameOf(k)}（内容${n}つ）${on ? '　表示中' : ''}</button>`;
    }).join(' ');
  }
  function renderKindTabs() {
    const box = $('wzKindTabs');
    box.hidden = state.mode !== 'both';
    if (box.hidden) return;
    box.innerHTML = `<p><b>陳情書と要望書の両方を作っています。</b>いまは<b>${docNameOf(state.kind)}</b>を表示しています。もう一方は、下のボタンで切り替えて確かめます。</p><div class="out-toolbar">${kindTabs()}</div>`;
  }
  function renderAlso() {
    const box = $('wzAlso');
    box.hidden = false;
    if (state.mode === 'both') {
      const tabs = ['petition', 'request'].map((k) => {
        const n = countOf(k);
        const on = state.kind === k;
        return `<button type="button" class="btn btn-small${on ? ' btn-primary' : ''}" aria-pressed="${on}" data-also-tab="${k}"${n ? '' : ' disabled'}>${docNameOf(k)}（内容${n}つ）${on ? '　表示中' : ''}</button>`;
      }).join(' ');
      box.innerHTML = `<p><b>陳情書と要望書の両方を作っています。</b>下のボタンで切り替えて、それぞれ確かめて印刷します。陳情書は議会（議長あて）、要望書は役所（知事・市区町村長あて）に出すので、<b>郵送するなら封筒を分けて、切手もそれぞれに貼ります</b>。</p><div class="out-toolbar">${tabs}</div>`;
      return;
    }
    const other = state.kind === 'request' ? 'petition' : 'request';
    const ok = state.items.filter(forKind(other)).length;
    box.innerHTML = ok
      ? `<p><b>同じ内容を、${other === 'request' ? '要望書として市区町村長・知事' : '陳情書として議会'}にも出せます。</b>陳情書は議会に、要望書は役所に届きます。両方出すと、議会と行政の両方に検討してもらえます。</p>${ok < state.items.length ? `<p class="hint-sm">選んだ内容のうち${ok}つが${docNameOf(other)}にできます。</p>` : ''}<button type="button" class="btn btn-small" data-also="both">陳情書と要望書の両方を作る</button>`
      : `<p class="hint-sm">いま選んでいる内容は、どれも${docNameOf(other)}にはできないものです。</p>`;
  }
  const onKindClick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.also === 'both') state.mode = 'both';
    else if (b.dataset.alsoTab) state.kind = b.dataset.alsoTab;
    else return;
    setKindInputs();
    show();
    e.currentTarget.scrollIntoView({ block: 'nearest' });
  };
  $('wzAlso').addEventListener('click', onKindClick);
  $('wzKindTabs').addEventListener('click', onKindClick);

  const reqNotes = (id) => { const n = [...intakeNotes(id, 'yobo'), ...((intakeOf(id, 'yobo') || {}).mail ? [] : [`📮 郵送で受け付けるかは、このサイトではまだ確かめられていません（調査中）。郵送するなら、上の案内ページか代表電話で確かめてください。<a href="${esc(window.Common.askUrl(`${municipalityName(id)}の要望の郵送の扱い`, '郵送で受け付けるかが分かる公式の案内ページの URL を教えてください', 'council_procedure'))}" target="_blank" rel="noopener">分かる方は、ご意見で教えてください</a>`]), ...kaitoNotes(id)]; return n.length ? `<ul class="wz-notes">${n.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''; };
  // 「今やること」の1つ目：議会ごとに、分かっている扱いか、電話で聞くことを出す
  function renderNowAsk() {
    const list = real();
    let html;
    if (state.kind === 'request') {
      // 要望書は議会の手続ではなく、受け付け方（窓口・郵送・メール・フォーム）は自治体ごとに違う。
      // このサイトでは調べていないので、扱いは出さず、その自治体の出し方のページへ直接案内する
      html = list.length
        ? list.map((id) => {
          const { page, title, results } = requestLinks(id);
          return page
            ? `<li><b>${esc(municipalityName(id))}</b>：<a href="${esc(page)}" target="_blank" rel="noopener" class="btn btn-small">要望・意見の出し方のページを開く</a><span class="hint-sm">（${esc(title)}。公式サイトで確かめたページです）</span>${reqNotes(id)}</li>`
            : `<li><b>${esc(municipalityName(id))}</b>：<span class="wz-notfound">⚠ このサイトでは、${esc(municipalityName(id))}の要望書の出し方のページを見つけられていません。</span>下のボタンで公式サイトの中を検索して、ご自身で探してください。<br><a href="${esc(results)}" target="_blank" rel="noopener" class="btn btn-small">公式サイトで出し方のページを探す</a><span class="hint-sm">（「${esc(headOf(municipalityName(id)))}への手紙」「市民の声」「ご意見・ご提案」などの名前のページです。見つからなければ、代表電話で要望書の受付窓口を聞きます）</span>${reqNotes(id)}</li>`;
        }).join('')
        : '<li>出す先を決めたら、その自治体の公式サイトで、要望・意見の受け付け方（窓口・郵送・メール・フォーム）を確かめます。</li>';
    } else if (!list.length) {
      html = '<li>出す先を決めたら、住んでいる議会に持参するのがいちばん確実です。郵送するときや審査まで確実にしたいときは、下の「電話で聞くこと」をその議会事務局に聞きます。</li>';
    } else {
      // 1行目に結論（どう出すか）だけを書き、理由や確かめ方は「くわしく」を開いて読む（スマホで長い文のかたまりにしない）
      const more = (t) => `<details class="wz-more"><summary>くわしく</summary>${t}</details>`;
      html = list.map((id) => {
        const info = infoOf(id);
        const r = mailRule(info);
        const name = `<b>${esc(municipalityName(id))}</b>`;
        if (r && r.c !== 'unknown') {
          // 公式案内で確かめた扱いだけを「電話は要らない」とする。自動で読み取っただけの扱いは確かめてもらう
          const sure = /公式案内で確認/.test(checkedOn(info)) && (!info.policy || info.policy.confidence === 'confirmed');
          const what = { none: '審査を求めるときは、紹介議員のいる請願にする方法があります。', jisan: '審査してもらうなら持参で出します。', outside: '住民でなければ、審査してもらうには持参で出します。' }[r.c] || '';
          const denshiNote = info.denshi ? '<b>電子申請でも出せるようです。それなら紙・封筒・切手は要りません。</b>' : '';
          return `<li>${name}：<b>${esc(r.label)}</b>${info.denshi ? '（電子申請でも出せるようです）' : ''}${more(`${checkedTag(info)}${what}${denshiNote}${sure ? '議会の公式の案内で確かめてあります。そのあと変わることもあるので、締切を公式サイトで確かめるときに、あわせて見ておくと安心です。' : (/自動で読み取り/.test(checkedOn(info)) ? '公式ページから自動で読み取ったもので、人の目では確かめていません。このまま出してかまいません。審査まで確実にしたいときだけ、下の「電話で聞くこと」で確かめます。' : 'まだ確定していない情報です。このまま出してかまいません。審査まで確実にしたいときだけ、下の「電話で聞くこと」で確かめます。')}`)}</li>`;
        }
        const [pref, key] = officeKeys[id] || [];
        const denshi = info && info.denshi ? '<b>電子申請でも出せるようなので、それがいちばん手軽です。紙・封筒・切手は要りません</b>（出し方は下の「くわしい手順」の②）。' : '';
        const head = info && info.denshi ? '<b>電子申請で出すのがいちばん手軽です</b>（紙・封筒・切手は要りません）' : '<b>住んでいる議会なら、持参がいちばん確実です。</b>郵送でも届きます';
        return `<li>${name}：${head}${more(`郵送の扱いはまだ分かっていません。電話しなくても出せます。${denshi}住んでいる議会なら持参すると、審査される見込みがいちばん高くなります。郵送でも届きますが、議会によっては審査されず議員に配るだけになります。審査まで確実にしたいときは、下の「電話で聞くこと」を議会事務局に聞きます（数分）。`)}${telHtml(pref, key, false)}</li>`;
      }).join('');
    }
    $('wzNowAsk').innerHTML = html;
    renderKindParts();
  }
  // ---------- 印刷用のPDF（陳情書・送付状・宛名・出し方メモ） ----------
  // 要望書は議会に出さないので、送付状と宛名の用紙は入れない
  const pick = (id) => $(id).checked && !$(id).closest('label').hidden;
  const PICKS = ['wzBody', 'wzIkensho', 'wzQrLink', 'wzCover', 'wzWithLabels', 'wzWithMemo'];
  // 説明のページ（/<テーマ>/easy/<項目>）のアドレス。PDF では URL の行に QR コードが付く
  const easyUrl = (k) => `https://chinjo-action.vercel.app/${window.THEME.id}/easy/${k}`;
  const withQrLinks = (text, keys) => {
    const items = keys.map((k) => window.Petition.ITEMS[k]).filter(Boolean);
    if (!items.length) return text;
    const add = ['【この陳情の説明】', '　内容の説明・数字・資料をまとめたページです（スマホで読み取れます）。',
      ...items.flatMap((it) => [`　${it.title}`, `　　${easyUrl(it.id)}`]), ''];
    const lines = text.split('\n');
    const end = lines.lastIndexOf('以上');
    if (end < 0) return [text, '', ...add].join('\n');
    lines.splice(end, 0, ...add);
    return lines.join('\n');
  };
  $('wzQrPreview').addEventListener('toggle', () => {
    if (!$('wzQrPreview').open) return;
    const ids = [...new Set(cur().flatMap(keysOf))].filter((k) => window.Petition.ITEMS[k]);
    $('wzQrList').innerHTML = ids.map((k) => `<li><a href="${esc(easyUrl(k).replace('https://chinjo-action.vercel.app', ''))}" target="_blank" rel="noopener">${esc(window.Petition.ITEMS[k].label)}</a></li>`).join('') || '<li>内容を選ぶと、ここにリンク先が出ます</li>';
  });
  const pickBoxes = () => PICKS.map($).filter((el) => !el.closest('label').hidden);
  function renderPickAll() {
    const all = pickBoxes().every((el) => el.checked);
    $('wzPickAll').textContent = all ? 'すべて外す' : 'すべて選ぶ';
  }
  $('wzPickAll').addEventListener('click', () => {
    const all = pickBoxes().every((el) => el.checked);
    pickBoxes().forEach((el) => { el.checked = !all; });
    $('wzWithFigs').disabled = !$('wzWithMemo').checked;
    renderPickAll();
  });
  PICKS.forEach((id) => $(id).addEventListener('change', renderPickAll));
  // 送り方の図は出し方メモの中に入るので、メモを外したら選べないようにする
  $('wzWithMemo').addEventListener('change', () => { $('wzWithFigs').disabled = !$('wzWithMemo').checked; });

  // 議会ごとに、封筒に入れる文書（送付状と陳情書）をまとめる。keys は参考図表の別紙を選ぶのに使う
  const envelopes = () => targets().map((c) => {
    const docs = areas().map((ta) => (pick('wzQrLink') ? withQrLinks(docFor(ta, c), keysOf(ta.dataset.key)) : docFor(ta, c)));
    const cover = pick('wzCover') && !isNone(c) ? [window.Petition.cover(nameOf(c), docs, sender)] : [];
    // 国に意見書を求める陳情には、意見書の案を別紙で添えられる（その陳情書のすぐ後ろに入れる）
    const iken = areas().map((ta) => (pick('wzIkensho') && !isNone(c) ? window.Petition.ikensho(nameOf(c), keysOf(ta.dataset.key)) : ''));
    return { c, cover, docs: pick('wzBody') ? docs : [], iken, keys: areas().map((ta) => ta.dataset.key) };
  });

  // 送り方の図（send-figs.js）は、画面の SVG を3枚横に並べた PNG にしてメモに入れる
  async function figsPng() {
    const svgs = [...document.querySelectorAll('[data-send-figs] svg')].slice(0, 3);
    if (!svgs.length) return null;
    const W = 600;
    const H = 750;
    const canvas = document.createElement('canvas');
    canvas.width = W * svgs.length;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await Promise.all(svgs.map((svg, i) => new Promise((ok, ng) => {
      const c = svg.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      c.setAttribute('width', W);
      c.setAttribute('height', H);
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, i * W, 0, W, H); ok(); };
      img.onerror = () => ng(new Error('送り方の図を描けませんでした'));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(c))}`;
    })));
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  // 出し方メモの、議会ごとの欄に入れること（文は send-memo.js で組み立てる）
  const plain = (t) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?\s*/gu, '');
  function memoCouncil(c, sheets) {
    const [pref, key] = officeKeys[c] || [];
    const info = infoOf(c);
    const o = window.Places.office(pref, key);
    const t = ((window.TEL || {})[pref] || {})[key];
    const a = accessOf(pref, key);
    const rule = mailRule(info);
    const p = sheets && window.Postage.estimate(sheets);
    return {
      name: `${label(c)}事務局`,
      page: ((window.SITES[pref] || {})[key] || [])[1] || '',
      mail: rule ? plain(rule.label) : '',
      denshi: !!info.denshi,
      tel: t ? `${t[1]}（${t[0] === 'gikai' ? '議会事務局' : '役所。「議会事務局につないでください」と伝える'}）` : '',
      address: o.address ? `〒${o.zip}　${o.address}${o.main ? '（役所の本庁舎。議会事務局が別の建物のこともある）' : ''}` : '',
      access: a ? `${a[2]}駅（${a[3]}）から${a[4] <= 2500 ? `徒歩約${Math.ceil((a[4] * 1.3) / 80)}分` : `約${km(a[4])}。バスかタクシーが便利`}` : '',
      deadline: info.deadline ? clip(info.deadline) : '',
      sessions: ((((window.SESSIONS || {})[pref] || {})[key]) || [])[0] || '',
      refCopies: ((intakeOf(c, 'chinjo') || {}).ref_copies && state.kind !== 'request') ? `参考資料を添える（議員に配ってもらう）ときは${intakeOf(c, 'chinjo').ref_copies}部（コピー）を求める議会です（${refCopiesCost(intakeOf(c, 'chinjo').ref_copies)}）。公式案内：「${clip(intakeOf(c, 'chinjo').copies || '')}」` : '',
      stamp: p ? (p.yen ? `${sheets}枚・約${p.g}g → ${p.safe ? `${p.safe}円（${p.yen}円の境目に近いので1つ上の料金）` : `${p.yen}円`}` : `${sheets}枚・約${p.g}g → 郵便局の窓口で出す`) : '',
    };
  }

  // labelsOnly：宛名・差出人の用紙だけの PDF（書類とは別に印刷したいとき）
  async function makePdf({ labelsOnly = false } = {}) {
    const doc = await window.PdfDoc.create();
    const envs = labelsOnly ? [] : envelopes();
    const sheets = new Map();
    for (const { c, cover, docs, iken, keys } of envs) {
      let n = 0;
      for (const t of cover) n += doc.addDocument(t);
      for (let i = 0; i < keys.length; i += 1) {
        if (docs[i]) {
          n += doc.addDocument(docs[i]);
          if (window.Figs) await window.Figs.addTo(doc, keysOf(keys[i]));
        }
        if (iken[i]) n += doc.addDocument(iken[i]);
      }
      sheets.set(c, n);
    }
    if ((labelsOnly || pick('wzWithLabels')) && real().length) {
      const request = state.kind === 'request';
      const rows = real().filter((c) => !reqBlocked(c)).map((c) => {
        const [pref, key] = officeKeys[c] || [];
        if (!request) return { council: nameOf(c), ...window.Places.office(pref, key) };
        // 要望書は首長あて。送り先が分かっていればそれを、なければ役所の本庁舎（data/offices.js）にする
        const y = intakeOf(c, 'yobo') || {};
        const o = ((window.OFFICES || {})[pref] || {})[key] || [];
        return { head: window.Petition.requestTo(municipalityName(c)), zip: y.mail_address ? y.mail_zip || '' : o[0] || '', address: `${y.mail_address || o[1] || ''}${y.mail_to ? `　${y.mail_to}` : ''}` };
      });
      doc.addLabels(window.PdfDoc.SHEETS.plain, window.PdfDoc.labelItems(rows, sender, { to: request ? 'head' : 'chair', zaichu: true, from: true, back: true }));
    }
    if (!labelsOnly && pick('wzWithMemo')) {
      // 送りなれている人は、送り方の図を外せる（wzWithFigs）
      const png = pick('wzWithFigs') ? await figsPng().catch(() => null) : null;
      const text = window.SendMemo.build({
        kind: state.kind,
        count: docKeys().length,
        titles: docKeys().map(docLabel),
        councils: real().filter((c) => !reqBlocked(c)).map((c) => memoCouncil(c, sheets.get(c))),
        figs: !!png,
        recordUrl: window.Report.enabled && state.kind !== 'request' ? `${linkOf()}&s=send` : '',
      });
      doc.addDocument(text, png ? { send: await doc.embedImage(png) } : {});
    }
    return doc.bytes();
  }
  ['wzNowPdf', 'wzNowPdfSave', 'wzNowCopy'].forEach((id) => $(id).addEventListener('click', markPrinted));
  $('wzNowPdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!PICKS.some(pick)) { flash('PDFに入れるものを選んでください'); return; }
    // 開くのを待つとポップアップとして止められるので、タブは先に開いておく
    const win = window.open('', '_blank');
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      const url = URL.createObjectURL(new Blob([await makePdf()], { type: 'application/pdf' }));
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (err) {
      if (win) win.close();
      flash(`PDFを作れませんでした（${err.message}）。通信のよい所でもう一度試してください。`, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = text;
    }
  });
  // 保存：開かずに、そのまま端末に保存する（コンビニのネットプリントに登録する・USBに入れるとき）
  $('wzNowPdfSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!PICKS.some(pick)) { flash('PDFに入れるものを選んでください'); return; }
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      const url = URL.createObjectURL(new Blob([await makePdf()], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNameOf(state.kind)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      flash(`PDFを作れませんでした（${err.message}）。通信のよい所でもう一度試してください。`, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = text;
    }
  });
  // 宛名・差出人の用紙だけを別の PDF で保存する
  $('wzNowLabelsSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!real().length) { flash('宛先の議会を選んでください'); return; }
    const text = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      window.PdfDoc.download(await makePdf({ labelsOnly: true }), '宛名と差出人.pdf');
    } catch (err) {
      flash(`PDFを作れませんでした（${err.message}）。通信のよい所でもう一度試してください。`, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = text;
    }
  });
  $('wzNowCopy').addEventListener('click', () => $('wzCopy').click());

  // 「今やること」の手順ごとに、済んだら印を付けられるようにする（読み飛ばしを防ぎ、どこまで済んだか分かるように）
  document.querySelectorAll('.wz-now-steps > li').forEach((li) => {
    li.insertAdjacentHTML('beforeend', '<label class="wz-step-done"><input type="checkbox"> できた</label>');
    li.querySelector('.wz-step-done input').addEventListener('change', (e) => li.classList.toggle('is-done', e.target.checked));
  });

  // 確かめた項目の数を出す。進むのは止めないが、残りがあれば知らせる
  const checks = () => [...document.querySelectorAll('.wz-checklist > ul > li > label > input')].filter((c) => !c.closest('li').hidden);
  function renderCheckLeft() {
    const left = checks().filter((c) => !c.checked).length;
    $('wzCheckLeft').textContent = left ? `⚠ まだ確かめていない項目が ${left}つ あります。チェックがないまま出すと、${state.kind === 'request' ? '受け付けられなかったり、思わぬ形で公開されたりすることがあります' : '受け付けられなかったり審査されなかったりすることがあります'}。` : '✓ すべて確かめました。印刷して出せます。';
    $('wzCheckLeft').classList.toggle('done', !left);
    $('wzNowLeft').hidden = !left;
    $('wzNowLeft').textContent = `下の「出す前に確かめること」を開くと、出す前に見ておくと安心な項目が${left}つあります（印刷はこのままできます）。`;
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
  // 読みがな（data/kana.js、全国分）は、名前で探す欄を使うときに初めて読み込む。届いたら、入っている言葉で探し直す
  let kanaLoading = null;
  function needKana(el) {
    if (window.KANA || kanaLoading) return;
    kanaLoading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = '/data/kana.js';
      s.onload = s.onerror = resolve;
      document.head.append(s);
    }).then(() => {
      allCouncils = null;
      if (el.value.trim()) el.dispatchEvent(new Event('input'));
    });
  }
  ['wzGlobal', 'wzFilter'].forEach((id) => ['focus', 'input'].forEach((ev) => $(id).addEventListener(ev, () => needKana($(id)))));
  // 郵便番号（7けた）から自治体を引く。表は data/zip/<上3けた>.json（scripts/zip.js で日本郵便のデータから作る）
  const zipCache = {};
  const chip = (id) => `<button type="button" class="wz-chip" data-global="${esc(id)}">${esc(municipalityName(id))}<small class="wz-n">${esc(prefOf(id))}</small>${state.kind === 'petition' ? chipMail(id) : ''}</button>`;
  // 郵便番号の先頭（3〜7けた）に当てはまる自治体をすべて引く
  async function zipHits(zip) {
    const head = zip.slice(0, 3);
    zipCache[head] ||= fetch(`/data/zip/${head}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const table = await zipCache[head];
    const rest = zip.slice(3);
    const pks = [...new Set(Object.keys(table).filter((k) => k.startsWith(rest)).flatMap((k) => table[k].split('|')))];
    if (!pks.length) return null;
    return pks.flatMap((pk) => {
      const pref = prefOf(pk);
      councilsOf(pref);
      const pl = window.Places.of(pref).find((p) => p.key === nameOf(pk));
      return pl ? [idOf(pref, pl.council)] : [];
    });
  }
  $('wzGlobal').addEventListener('input', async () => {
    const q = $('wzGlobal').value.trim();
    const setZipPrefs = (prefs) => {
      const next = prefs && prefs.length ? prefs : null;
      if (String(next) === String(zipPrefs)) return;
      zipPrefs = next;
      renderMailAll();
    };
    if (!q) { setZipPrefs(null); $('wzGlobalHits').innerHTML = ''; return; }
    const zip = q.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).replace(/^〒|[-－ー‐\s]/g, '');
    if (/^\d{1,7}$/.test(zip)) {
      if (zip.length < 2) { setZipPrefs(null); $('wzGlobalHits').innerHTML = '<p class="wz-wide hint-sm">郵便番号は2けた以上入れると郵送の扱いの一覧が、3けた以上で当てはまる自治体が絞られます（例：100-0001）。</p>'; return; }
      if (zip.length === 2) {
        // 2けたでは都道府県だけを引き、郵送の扱いの一覧を絞る（表は data/zip/p2.json、scripts/zip.js で作る）
        zipCache.p2 ||= fetch('/data/zip/p2.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
        const prefs = (await zipCache.p2)[zip];
        if ($('wzGlobal').value.trim() !== q) return;
        setZipPrefs(prefs);
        $('wzGlobalHits').innerHTML = prefs
          ? `<p class="wz-wide hint-sm">〒${zip}で始まる地域は${esc(prefs.join('・'))}です。下の郵送の扱いの一覧を絞りました。あと1けた入れると自治体が出ます。</p>`
          : `<p class="wz-wide hint-sm">〒${zip}で始まる郵便番号は見つかりません。</p>`;
        return;
      }
      const ids = await zipHits(zip);
      if ($('wzGlobal').value.trim() !== q) return;
      const shown = zip.length > 3 ? `${zip.slice(0, 3)}-${zip.slice(3)}` : zip;
      const part = zip.length < 7 ? 'で始まる地域' : '';
      setZipPrefs(ids && [...new Set(ids.map(prefOf))]);
      if (ids && ids.length) {
        const uniq = [...new Set(ids)];
        const list = [...new Set(uniq.flatMap((id) => [id, idOf(prefOf(id), `${prefOf(id)}議会`)]))];
        const more = list.length > 40 ? `<p class="wz-wide hint-sm">ほかにも${list.length - 40}あります。続けて入れると絞れます。</p>` : '';
        $('wzGlobalHits').innerHTML = `<p class="wz-wide hint-sm">〒${shown}${part} の自治体と、その都道府県の議会です。</p>${list.slice(0, 40).map(chip).join('')}${more}`;
      } else {
        $('wzGlobalHits').innerHTML = `<div class="wz-wide wz-nohit"><p>〒${shown}${part} に当てはまる自治体が見つかりません。</p><p class="hint-sm">郵便番号をお確かめのうえ、自治体名で探すか、<button type="button" class="btn btn-small" data-to-prefs>都道府県から選ぶ</button>を使ってください。</p></div>`;
      }
      return;
    }
    setZipPrefs(null);
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
    const { step, pref, councils, items, role, kind, mode, merge, reply } = state;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, pref, councils, items, role, kind, mode, merge, reply })); } catch { /* 残せなくても作れる */ }
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
      return { items, councils, role, step, pref: window.PREFS.includes(d.pref) ? d.pref : '', kind: d.kind === 'request' ? 'request' : 'petition', mode: ['petition', 'request', 'both'].includes(d.mode) ? d.mode : (d.kind === 'request' ? 'request' : 'petition'), merge: !!d.merge, reply: !!d.reply };
    } catch { return null; }
  }

  if (restore()) {
    if (fromMemo) printed = true;
    show();
    $('wizard').scrollIntoView();
  } else {
    const draft = loadDraft();
    // ?item= で内容を選んで来たときは、内容を選ぶ画面を飛ばして議会を選ぶ画面から始める（戻るで内容の画面に戻れる）
    if (state.items.length) {
      history.replaceState({ step: 0 }, '', location.pathname + location.search);
      state.step = STEPS.indexOf('council');
      history.pushState({ step: state.step }, '', location.pathname + location.search);
    }
    show();
    if (state.items.length) $('wizard').scrollIntoView();
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
