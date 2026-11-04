(() => {
  const form = document.getElementById('genForm');
  const output = document.getElementById('output');
  const { copy, printTexts } = window.Common;
  const { build, buildPrompt, selectedKeys, ITEMS, MANY, SEP } = window.Petition;

  // ---------- 提出先の議会（複数） ----------
  const rows = document.getElementById('councilRows');

  document.getElementById('councilList').innerHTML = window.Places.all()
    .map((pl) => `<option value="${pl.council}">${pl.isPref ? pl.pref : pl.pref + pl.gun}</option>`).join('');

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
    b.addEventListener('click', () => copy(window.THEME.mpTemplate, '文例をコピーしました'))
  );

  const url = encodeURIComponent(location.href.split('#')[0]);
  const text = encodeURIComponent(window.THEME.shareText);
  document.getElementById('shareX').href = `https://x.com/intent/post?text=${text}&url=${url}`;
  document.getElementById('shareLine').href = `https://social-plugins.line.me/lineit/share?url=${url}`;
  document.getElementById('wzShareX').href = document.getElementById('shareX').href;
  document.getElementById('wzShareLine').href = document.getElementById('shareLine').href;
})();
