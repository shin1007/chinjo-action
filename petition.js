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

  return { build, buildPrompt, selectedKeys, ITEMS, MANY, SEP };
})();
