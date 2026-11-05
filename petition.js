// 陳情書の文面と、生成AIへの指示文を組み立てる。詳しい版（app.js）とかんたん作成（wizard.js）の両方が使う。
// data には FormData（type・items・story・address・name・tel）を渡す。
window.Petition = (() => {
  const { BLANK_TEXT, reiwaToday } = window.Common;

  // 求める事項は data/asks-*.js、決まった文章は data/template.js にある
  const T = window.TEMPLATE;
  const fill = window.fillTemplate;
  const ITEMS = Object.fromEntries(window.ASKS.map((a) => [a.id, a]));

  // 1つの議会に一度に多くの陳情を出すと、どれも重みが薄れるので、優先する項目に絞るよう促す
  const MANY = 3;
  const SEP = '━━━━━━━━━━ 次の陳情 ━━━━━━━━━━';
  const KANSUJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

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
    lines.push(reiwaToday(), '');
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
      ? `議会から国（${window.THEME.ai.ikenshoTo}）へ意見書を提出するよう求める陳情。`
      : 'その自治体が自ら実施できる施策を求める陳情（国の法改正は求めない）。');
    L.push('', '## 求める事項');
    sel.forEach((it, i) => L.push(`${i + 1}. ${it.title}`, `   要望の例：${it.text.replaceAll('{宛先}', 'その自治体')}`, `   背景：${it.reason}`));
    if (sel.length > 1) L.push('', `※求める事項ごとに、別々の陳情書を${sel.length}通作成してください。1通には1つの事項だけを書き、それぞれ件名・趣旨・理由をその事項に合わせてください。`);
    if (story) L.push('', '## 陳情者としての一言（陳情の理由の最後に、1〜2文で一般的な表現にして添えてください。日付・地名・相手方・裁判や調停の経過など、個人や事件を特定できる内容は書かないでください）', story);
    L.push('', '## 書き方のルール（採択されやすくするため、必ず守ってください）');
    [
      '求める事項は上記の項目だけに絞り、勝手に増やさない。',
      ...window.THEME.ai.rules,
      isIkensho
        ? window.THEME.ai.nationalRule
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

  // 文面の住所の行を、差出人（Common.sender の形）で書き換える。手で直した文面にも使えるよう、行ごと置き換える
  // 氏名は本人が手書きで署名するので、いつも下線のままにする（入力した氏名は鏡文と封筒にだけ使う）
  // 電話番号は陳情書には入れない（陳情書は公開されることがあるため）。議会事務局だけが読む鏡文に入れる
  function withSender(text, s) {
    const addr = [s.zip && `〒${s.zip}`, s.address].filter(Boolean).join('　') || BLANK_TEXT;
    const t = text
      // 入力に「$」があっても置き換えの記号として読まれないよう、関数で返す
      .replace(/^住所　.*$/m, () => `住所　${addr}`)
      .replace(/^氏名　.*?(　+印)$/m, (_, seal) => `氏名　${BLANK_TEXT}${seal}`)
      .replace(/^電話　.*\n/m, '');
    return t;
  }

  // ある議会あての文面を、別の議会あてに書き換える（宛名の「○○市議会」と、本文の「○○市」を差し替える）
  function swapCouncil(text, from, to) {
    if (from === to) return text;
    const place = (c) => c.replace(/議会$/, '');
    return text.split(from).join(to).split(place(from)).join(place(to));
  }

  // 郵送で陳情書の上に重ねる鏡文（送付状）。docs はその議会に送る陳情書の文面（件名を一覧にする）
  function cover(council, docs, s) {
    const addr = [s.zip && `〒${s.zip}`, s.address].filter(Boolean).join('　') || BLANK_TEXT;
    const from = [`住所　${addr}`, `氏名　${s.name || BLANK_TEXT}`, `電話　${s.tel || BLANK_TEXT}`];
    const subjects = docs.map((d) => (d.match(/^件名　(.+)$/m) || [])[1]).filter(Boolean);
    const list = subjects.length
      ? subjects.map((t, i) => `${KANSUJI[i] || i + 1}　陳情書「${t}」　1通`).join('\n')
      : `一　陳情書　${docs.length}通`;
    return fill(T.cover, { 日付: reiwaToday(), 宛先: council, 差出人: from.join('\n'), 書類: list, 通数: String(docs.length) });
  }

  return { build, buildPrompt, withSender, swapCouncil, cover, selectedKeys, ITEMS, MANY, SEP };
})();
