(() => {
  const form = document.getElementById('genForm');
  const output = document.getElementById('output');
  const { BLANK_TEXT, copy, printTexts } = window.Common;

  // 求める事項は data/asks-*.js、決まった文章は data/template.js にある
  const T = window.TEMPLATE;
  const fill = window.fillTemplate;
  const ITEMS = Object.fromEntries(window.ASKS.map((a) => [a.id, a]));

  // 1つの議会に一度に多くの陳情を出すと、どれも重みが薄れるので、優先する項目に絞るよう促す
  const MANY = 3;

  // ---------- 提出先の議会（複数） ----------
  const SEP = '━━━━━━━━━━ 次の陳情 ━━━━━━━━━━';
  const rows = document.getElementById('councilRows');

  // 町村は「○○郡」を外して議会名にする（小郡市のような市名は対象外）
  const COUNCIL_NAMES = window.PREFS.flatMap((p) => [
    { value: p + '議会', label: p },
    ...(window.MUNICIPALITIES[p] || []).map((m) => {
      const g = m.match(/^(.+?郡)(.+[町村])$/);
      return { value: (g ? g[2] : m) + '議会', label: p + (g ? g[1] : '') };
    }),
  ]);
  document.getElementById('councilList').innerHTML = COUNCIL_NAMES
    .map((c) => `<option value="${c.value}">${c.label}</option>`).join('');

  function addRow() {
    const li = document.createElement('li');
    li.innerHTML = '<input list="councilList" placeholder="自治体名を入力して候補から選ぶ（例：横浜）"><button type="button" aria-label="この提出先を外す">×</button>';
    rows.appendChild(li);
    return li.querySelector('input');
  }

  // 最初から2つの入力欄を用意する
  addRow();
  addRow();
  document.getElementById('councilAdd').addEventListener('click', () => addRow().focus());
  rows.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const li = e.target.closest('li');
    // 最後の1つは消さずに空にする
    if (rows.children.length > 1) li.remove();
    else li.querySelector('input').value = '';
  });

  function councilNames() {
    const names = [...rows.querySelectorAll('input')]
      .map((i) => i.value.trim()).filter(Boolean)
      .map((v) => (/議会$/.test(v) ? v : v + '議会'));
    return [...new Set(names)];
  }

  const itemList = document.getElementById('itemList');
  const itemHint = document.getElementById('itemHint');
  const currentType = () => form.querySelector('[name=type]:checked').value;

  function renderItems() {
    const local = currentType() === 'local';
    document.getElementById('itemsLegend').textContent = local
      ? '求める施策（選んだ数だけ陳情書ができます）'
      : '国に求める事項（選んだ数だけ陳情書ができます）';
    itemList.innerHTML = Object.entries(ITEMS)
      .filter(([, it]) => it.scope === (local ? 'local' : 'national'))
      .map(([k, it]) => `<label class="check"><input type="checkbox" name="items" value="${k}" ${it.defaultOn ? 'checked' : ''}> ${it.label}</label>`)
      .join('');
    updateItemHint();
  }

  function updateItemHint() {
    const n = itemList.querySelectorAll('input:checked').length;
    document.getElementById('splitNote').hidden = n < 2;
    const local = currentType() === 'local';
    itemHint.classList.toggle('warn', n > MANY);
    itemHint.textContent = n > MANY
      ? `⚠ ${n}項目を選んでいます。1つの議会に一度に多くの陳情を出すと、1件ごとの重みが薄れます。優先したい項目から、定例会ごとに分けて出すことも考えましょう。`
      : local
        ? '自治体あての陳情は、その自治体が自分でできることに絞るのがコツです。法律の改正は「国に意見書を出してもらう」で求めましょう。'
        : '法律の改正など、自治体だけでは決められないことは、議会から国へ意見書を出してもらう形で求めます。';
  }

  form.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', renderItems));
  itemList.addEventListener('change', updateItemHint);
  renderItems();

  const selectedKeys = (data) => data.getAll('items').filter((k) => ITEMS[k]);

  function build(data, council, keys) {
    const isIkensho = data.get('type') === 'ikensho';
    const story = data.get('story').trim();
    const sel = keys.map((k) => ITEMS[k]);
    const kansuji = ['一', '二', '三', '四', '五'];

    const place = council.replace(/議会$/, '');
    const vars = { 内容: sel.map((it) => it.title).join('および'), 種類: '陳情', 宛先: place };
    const subject = fill(isIkensho ? T.subjectNational : T.subjectLocal, vars);

    const lines = [];
    lines.push(window.Common.reiwaToday(), '');
    lines.push(`${council}議長　${BLANK_TEXT}　様`, '');
    lines.push(`住所　${data.get('address').trim() || BLANK_TEXT}`);
    lines.push(`氏名　${data.get('name').trim() || BLANK_TEXT}　　　　印`);
    if (data.get('tel').trim()) lines.push(`電話　${data.get('tel').trim()}`);
    lines.push('', `件名　${subject}`, '');
    lines.push('【陳情の趣旨】');
    lines.push(`　${fill(isIkensho ? T.purposeNational : T.purposeLocal, vars)}`);
    lines.push('', '記', '');
    sel.forEach((it, i) => lines.push(`${kansuji[i]}　${fill(it.text, vars)}`));
    lines.push('', '【陳情の理由】');
    sel.forEach((it, i) => lines.push(`${i + 1}．${it.title}`, `　${it.reason}`, ''));
    if (story) lines.push('（陳情者として）', `　${story.replace(/\n/g, '\n　')}`, '');
    lines.push(`　${T.closing}`);
    if (isIkensho) lines.push('', '【意見書の提出先（案）】', T.ikenshoTo);
    lines.push('', '以上');
    return lines.join('\n');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const councils = councilNames();
    const data = new FormData(form);
    if (!councils.length) output.value = '提出先の議会を1つ以上追加してください。';
    else if (!data.getAll('items').length) output.value = '求める項目を1つ以上選択してください。';
    else output.value = councils.flatMap((c) => selectedKeys(data).map((k) => build(data, c, [k]))).join(`\n\n${SEP}\n\n`);
    const box = document.getElementById('genOutput');
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });


  // ---------- 生成AIへの指示文 ----------
  // 採択されやすい陳情の方針（docs/陳情の基本方針.md）を指示文に織り込む。個人情報は入れない。
  function buildPrompt(data, councils) {
    const isIkensho = data.get('type') === 'ikensho';
    const sel = selectedKeys(data).map((k) => ITEMS[k]);
    const story = data.get('story').trim();
    const L = [];
    L.push('あなたは地方議会への陳情書の作成に詳しい行政文書の専門家です。以下の条件で、議会に提出する陳情書の文案を作成してください。', '');
    L.push('## 提出先');
    L.push(councils.length ? councils.map((c) => `- ${c}（議長あて）`).join('\n') : '- （議会名は後で入れます。「○○議会」としてください）');
    if (councils.length > 1) L.push('※文面は1通だけ作り、宛名と自治体名の部分を「○○議会」「○○市」のように差し替えやすくしてください。');
    L.push('', '## 陳情の種類');
    L.push(isIkensho
      ? '議会から国（衆議院議長・参議院議長・内閣総理大臣・法務大臣・こども政策担当大臣など）へ意見書を提出するよう求める陳情。'
      : 'その自治体が自ら実施できる施策を求める陳情（国の法改正は求めない）。');
    L.push('', '## 求める事項');
    sel.forEach((it, i) => L.push(`${i + 1}. ${it.title}`, `   要望の例：${it.text.replaceAll('{宛先}', 'その自治体')}`, `   背景：${it.reason}`));
    if (sel.length > 1) L.push('', `※求める事項ごとに、別々の陳情書を${sel.length}通作成してください。1通には1つの事項だけを書き、それぞれ件名・趣旨・理由をその事項に合わせてください。`);
    if (story) L.push('', '## 陳情者としての一言（陳情の理由の最後に、1〜2文で一般的な表現にして添えてください。日付・地名・相手方・裁判や調停の経過など、個人や事件を特定できる内容は書かないでください）', story);
    L.push('', '## 書き方のルール（採択されやすくするため、必ず守ってください）');
    [
      '求める事項は上記の項目だけに絞り、勝手に増やさない。',
      '題名は穏やかにし、「子どもの権利」「子どもの最善の利益」を主語にする。',
      'DV・虐待からの避難など、真に保護が必要な場合を除くことを明記する。',
      '特定の個人・事件・法律事務所・団体を非難したり、特定できる書き方をしない。',
      '「実子誘拐」「ピンハネ」などの強い言葉は使わず、「正当な理由のない子の連れ去り」「子のための給付の一部を報酬に充てる報酬体系」のように事実として書く。',
      '父母の性別による対立にしない（子と引き離される母親もいる）。',
      '陳情者個人の事情や紛争の経過は書かない。個人の問題や係争中の事件と受け取られると、審査の対象から外されるため。制度の問題として、どの子ども・親にも関わる話として書く。',
      isIkensho
        ? '2026年4月に改正民法が施行され、離婚後の共同親権が選べるようになったことを前提に、施行後の運用の改善と見直しを求める内容にする。'
        : 'その自治体が自分の判断で、少ない予算で実施できる内容にする。',
      '統計・判例・国会答弁などの事実は、上記の背景に書いたもの以外は書かない。どうしても必要な場合は「【要確認：○○の出典】」と書き、数字や引用を作らない。',
      'A4で2枚程度に収め、1枚目に趣旨と求める事項が収まるようにする。',
    ].forEach((r) => L.push(`- ${r}`));
    L.push('', '## 出力の形式');
    L.push('次の順に、そのまま印刷できる文面で出力してください。陳情者の住所・氏名の欄は空欄（＿＿＿＿）にしてください。');
    L.push('1. 日付（令和　年　月　日）', '2. 宛名（○○議会議長　様）', '3. 陳情者の住所・氏名の欄', '4. 件名', '5. 陳情の趣旨', '6. 記（求める事項を漢数字の箇条書きで）', '7. 陳情の理由', isIkensho ? '8. 意見書の提出先' : '8. 以上');
    L.push('', '最後に、文面とは別に「提出前に確認すべき点」を3つ以内で箇条書きにしてください。');
    return L.join('\n');
  }

  document.getElementById('aiBtn').addEventListener('click', () => {
    const data = new FormData(form);
    const box = document.getElementById('aiOutput');
    document.getElementById('aiPrompt').value = data.getAll('items').length
      ? buildPrompt(data, councilNames())
      : '求める項目を1つ以上選択してください。';
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('aiCopyBtn').addEventListener('click', () => {
    const v = document.getElementById('aiPrompt').value;
    if (v) copy(v, '指示文をコピーしました');
  });

  document.getElementById('copyBtn').addEventListener('click', () => output.value && copy(output.value));

  document.getElementById('dlBtn').addEventListener('click', () => {
    if (!output.value) return;
    const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '陳情書.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('printBtn').addEventListener('click', () => {
    // 宛先・項目ごとに改ページする
    if (output.value) printTexts(output.value.split(SEP));
  });

  const MP_TEMPLATE = `○○先生

突然のご連絡失礼いたします。○○在住の○○と申します。

離婚・別居に伴う子の連れ去りや、親子が会えなくなる問題について、先生のお考えをお聞かせいただきたくご連絡しました。

2026年4月に改正民法が施行され共同親権が選択できるようになりましたが、
・正当な理由のない子の連れ去りへの対応
・共同親権・共同養育が子どもの利益にかなう形で運用されること
・紛争を不必要に激化させる弁護活動への対策
はなお課題として残っていると考えています。

子どもが父母双方と関わり続けられる社会の実現に向け、ぜひお力添えをお願いいたします。

（氏名・住所・連絡先）`;

  document.querySelectorAll('[data-template="mp"]').forEach((b) =>
    b.addEventListener('click', () => copy(MP_TEMPLATE, '文例をコピーしました'))
  );

  const url = encodeURIComponent(location.href.split('#')[0]);
  const text = encodeURIComponent('子どもには両方の親と関わり続ける権利がある。3分で陳情書をつくれます。 #共同親権 #実子誘拐');
  document.getElementById('shareX').href = `https://x.com/intent/post?text=${text}&url=${url}`;
  document.getElementById('shareLine').href = `https://social-plugins.line.me/lineit/share?url=${url}`;
  document.getElementById('wzShareX').href = document.getElementById('shareX').href;
  document.getElementById('wzShareLine').href = document.getElementById('shareLine').href;
  // かんたん作成（wizard.js）からも同じ文面で作れるようにする
  window.Petition = { build, buildPrompt, SEP };
})();
