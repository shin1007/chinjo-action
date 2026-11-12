// 陳情書の文面と、生成AIへの指示文を組み立てる。詳しい版（app.js）とかんたん作成（wizard.js）の両方が使う。
// data には FormData（items・story・address・name・tel）を渡す。国あてか自治体あてかは、項目の scope で決まる。
window.Petition = (() => {
  const { BLANK_TEXT, reiwaToday } = window.Common;

  // 求める事項は data/asks-*.js、決まった文章は data/template.js にある
  const TEMPLATE = window.TEMPLATE;
  const fill = window.fillTemplate;
  const ITEMS = Object.fromEntries(window.ASKS.map((a) => [a.id, a]));

  // 1つの議会に一度に多くの陳情を出すと、どれも重みが薄れるので、優先する項目に絞るよう促す
  const MANY = 3;
  const SEP = '━━━━━━━━━━ 次の陳情 ━━━━━━━━━━';
  const KANSUJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  const selectedKeys = (data) => data.getAll('items').filter((k) => ITEMS[k]);
  // 国に意見書を出してもらう項目か（自治体が自分でできる項目は scope: 'local'）
  const isNational = (it) => it.scope !== 'local';
  // 選ぶ画面に並べる順。採択されやすい自治体あての項目を先にする
  const ordered = () => [...window.ASKS].sort((a, b) => isNational(a) - isNational(b));

  // 要望書の宛先になる首長の呼び方（宮城県→知事、仙台市→市長、世田谷区→区長）。名前を空けた宛先は「市区町村長」
  const headOf = (place) => (/[都道府県]$/.test(place) ? '知事' : /区$/.test(place) ? '区長' : /町$/.test(place) ? '町長' : /村$/.test(place) ? '村長' : /市$/.test(place) ? '市長' : '市区町村長');
  // 要望書の宛名（宮城県知事、仙台市長、世田谷区長）
  const requestTo = (place) => (/[都道府県]$/.test(place) ? `${place}知事` : /[市区町村]$/.test(place) ? `${place}長` : `${place}${headOf(place)}`);

  function build(data, council, keys, requestedKind = data.get('kind') || 'petition') {
    const story = data.get('story').trim();
    const sel = keys.map((k) => ITEMS[k]);
    const isIkensho = isNational(sel[0]);
    // テーマの決まった文章が合わない項目は、項目の template で件名・趣旨・結び・提出先を差し替える
    const T = { ...TEMPLATE, ...(sel[0].template || {}) };
    const kansuji = ['一', '二', '三', '四', '五'];

    const place = council.replace(/議会$/, '');
    const isRequest = requestedKind === 'request' && !isIkensho;
    const destination = isRequest ? requestTo(place) :`${council}議長`;
    const vars = { 内容: sel.map((it) => it.title).join('および'), 種類: isRequest ? '要望' : '陳情', 宛先: place };
    const subject = fill(isIkensho ? T.subjectNational : T.subjectLocal, vars);

    const lines = [];
    lines.push(reiwaToday(), '');
    lines.push(`${destination}　${BLANK_TEXT}　様`, '');
    lines.push(`住所　${data.get('address').trim() || BLANK_TEXT}`);
    lines.push(`氏名　${data.get('name').trim() || BLANK_TEXT}　　　　印`);
    if (data.get('tel').trim()) lines.push(`電話　${data.get('tel').trim()}`);
    lines.push('', `件名　${subject}`, '');
    lines.push(`【${isRequest ? '要望' : '陳情'}の趣旨】`);
    lines.push(`　${fill(isIkensho ? T.purposeNational : T.purposeLocal, vars)}`);
    lines.push('', '記', '');
    sel.forEach((it, i) => lines.push(`${kansuji[i]}　${fill(it.text, vars)}`));
    lines.push('', `【${isRequest ? '要望' : '陳情'}の理由】`);
    // 要望書は役所の職員が読むので、実施のイメージ（forStaff）があれば理由のあとに足す
    sel.forEach((it, i) => lines.push(`${i + 1}．${it.title}`, `　${it.reason}`, ...(isRequest && it.forStaff ? [`　${it.forStaff}`] : []), ''));
    if (story) lines.push(`（${isRequest ? '要望者' : '陳情者'}として）`, `　${story.replace(/\n/g, '\n　')}`, '');
    lines.push(`　${T.closing}`);
    // 選んだ項目の一次資料。添付できる議会では、この一覧の資料を印刷して添える
    const refs = sel.flatMap((it) => it.refs || []);
    if (refs.length) {
      lines.push('', '【参考資料】');
      refs.forEach((r, i) => lines.push(`${i + 1}　${r.t}${r.url ? `\n　　${r.url}` : ''}`));
    }
    // 項目に図（figs）があれば、PDF では別紙のグラフにする（figs.js）。ここには一覧だけを書く
    const seen = new Set();
    const figs = sel.flatMap((it) => it.figs || []).filter((f) => !seen.has(f.t) && seen.add(f.t));
    if (figs.length) {
      lines.push('', '【参考図表】（別紙）');
      figs.forEach((f, i) => lines.push(`図${i + 1}　${f.t}`));
    }
    if (isIkensho) lines.push('', '【意見書の提出先（案）】', T.ikenshoTo);
    lines.push('', '以上');
    return lines.join('\n');
  }

  // ---------- 生成AIへの指示文 ----------
  // 採択されやすい陳情の方針（docs/作業メモ/陳情の基本方針.md）を指示文に織り込む。個人情報は入れない。
  function buildPrompt(data, councils) {
    const sel = selectedKeys(data).map((k) => ITEMS[k]);
    // 国あてと自治体あての項目が混ざっていたら、項目ごとに種類を書き分けてもらう
    const nat = sel.some(isNational);
    const loc = sel.some((it) => !isNational(it));
    const mixed = nat && loc;
    const request = data.get('kind') === 'request' && !nat;
    const story = data.get('story').trim();
    const L = [];
    L.push(`あなたは${request ? '自治体への要望書' : '地方議会への陳情書'}の作成に詳しい行政文書の専門家です。以下の条件で、${request ? '役所' : '議会'}に提出する文案を作成してください。`, '');
    L.push('## 提出先');
    L.push(councils.length ? councils.map((c) => request ? `- ${c.replace(/議会$/, '')}役所あて` : `- ${c}（議長あて）`).join('\n') : request ? '- （自治体名は後で入れます。「○○市役所」などとしてください）' : '- （議会名は後で入れます。「○○議会」としてください）');
    if (councils.length > 1) L.push('※文面は1通だけ作り、宛名と自治体名の部分を「○○議会」「○○市」のように差し替えやすくしてください。');
    L.push('', '## 陳情の種類');
    const KIND_NAT = `議会から国（${window.THEME.ai.ikenshoTo}）へ意見書を提出するよう求める陳情。`;
    const KIND_LOC = 'その自治体が自ら実施できる施策を求める陳情（国の法改正は求めない）。';
    if (mixed) L.push('求める事項ごとに、次のどちらかです（下の「求める事項」に書いてあります）。', `- 国：${KIND_NAT}`, `- 自治体：${KIND_LOC}`);
    else L.push(nat ? KIND_NAT : request ? 'その自治体が自ら実施できる施策を求める要望書。' : KIND_LOC);
    L.push('', '## 求める事項');
    sel.forEach((it, i) => L.push(`${i + 1}. ${it.title}${mixed ? `（種類：${isNational(it) ? '国' : '自治体'}）` : ''}`, `   要望の例：${it.text.replaceAll('{宛先}', 'その自治体')}`, `   背景：${it.reason}`, ...(request && it.forStaff ? [`   実施のイメージ（役所の職員向けに、理由の最後に添える）：${it.forStaff}`] : [])));
    if (sel.length > 1) L.push('', `※求める事項ごとに、別々の陳情書を${sel.length}通作成してください。1通には1つの事項だけを書き、それぞれ件名・趣旨・理由をその事項に合わせてください。`);
    if (story) L.push('', '## 陳情者としての一言（陳情の理由の最後に、1〜2文で一般的な表現にして添えてください。日付・地名・相手方・裁判や調停の経過など、個人や事件を特定できる内容は書かないでください）', story);
    L.push('', '## 書き方のルール（採択されやすくするため、必ず守ってください）');
    [
      '求める事項は上記の項目だけに絞り、勝手に増やさない。',
      ...window.THEME.ai.rules,
      ...(nat ? [`${mixed ? '国の事項は、' : ''}${window.THEME.ai.nationalRule}`] : []),
      ...(loc ? [`${mixed ? '自治体の事項は、' : ''}その自治体が自分の判断で、少ない予算で実施できる内容にする。`] : []),
      '統計・判例・国会答弁などの事実は、上記の背景に書いたもの以外は書かない。どうしても必要な場合は「【要確認：○○の出典】」と書き、数字や引用を作らない。',
      'A4で2枚程度に収め、1枚目に趣旨と求める事項が収まるようにする。',
    ].forEach((r) => L.push(`- ${r}`));
    L.push('', '## 出力の形式');
    L.push(`次の順に、そのまま印刷できる文面で出力してください。${request ? '要望者' : '陳情者'}の住所・氏名の欄は空欄（＿＿＿＿）にしてください。`);
    const heading = request ? '要望' : '陳情';
    L.push('1. 日付（令和　年　月　日）', `2. 宛名（${request ? '○○市長（都道府県あてなら○○県知事）' : '○○議会議長'}　様）`, `3. ${request ? '要望者' : '陳情者'}の住所・氏名の欄`, '4. 件名', `5. ${heading}の趣旨`, '6. 記（求める事項を漢数字の箇条書きで）', `7. ${heading}の理由`, nat ? `8. 意見書の提出先${mixed ? '（国の事項のみ）' : ''}` : '8. 以上');
    L.push('', '最後に、文面とは別に「提出前に確認すべき点」を3つ以内で箇条書きにしてください。');
    return L.join('\n');
  }

  // ---------- 生成AIで中身だけ書き直す ----------
  // AI には【陳情の趣旨】と【陳情の理由】の本文だけを渡し、同じ目印をつけて返してもらう
  // 日付・宛名・住所氏名・件名・記・以上はこちらで持ったままにするので、書式は崩れず、個人の情報も渡らない
  // 要望書は【要望の趣旨】【要望の理由】。文面にある方の目印を使う
  const marks = (text) => {
    const w = /^【要望の趣旨】$/m.test(text.replace(/\r/g, '')) ? '要望' : '陳情';
    return { w, PURPOSE: `【${w}の趣旨】`, REASONS: `【${w}の理由】` };
  };
  // 理由のあとに、AI が参照した計画（名前・URL・引いた所）を書いてもらう。文面には入れず、確かめてもらうために出す
  const PLANS = '【参照した計画】';
  // 文面から、目印の行の次から終わりの行の手前までを取り出す（{ from, to }：行の番号）
  function span(lines, mark, isEnd) {
    const from = lines.findIndex((l) => l.trim() === mark);
    if (from < 0) return null;
    let to = lines.findIndex((l, i) => i > from && isEnd(l.trim()));
    if (to < 0) to = lines.length;
    while (to > from + 1 && !lines[to - 1].trim()) to -= 1;
    return { from: from + 1, to };
  }
  const isPurposeEnd = (s) => s === '記' || s.startsWith('【');
  const isReasonsEnd = (s) => s === '以上' || s.startsWith('【');
  function sections(text) {
    const { PURPOSE, REASONS } = marks(text);
    const lines = text.replace(/\r/g, '').split('\n');
    const p = span(lines, PURPOSE, isPurposeEnd);
    const r = span(lines, REASONS, isReasonsEnd);
    if (!p || !r) return null;
    return { purpose: lines.slice(p.from, p.to).join('\n'), reasons: lines.slice(r.from, r.to).join('\n') };
  }

  // text：いまの文面、info：{ local：地域で知っていること, story：自分が見聞きしたこと }
  function buildRewritePrompt(text, council, info = {}) {
    const s = sections(text);
    if (!s) return '';
    // 要望書のときは、議会ではなく知事・市区町村長あての文として書き直してもらう
    const { w, PURPOSE, REASONS } = marks(text);
    const req = w === '要望';
    const person = `${w}者`;
    const place = council.replace(/議会$/, '');
    const asks = (text.replace(/\r/g, '').split('\n記\n')[1] || '').split(`\n${REASONS}`)[0].trim();
    const L = [];
    L.push(`あなたは${req ? '自治体への要望書' : '地方議会への陳情書'}の作成に詳しい行政文書の専門家です。${req ? requestTo(place) : council}に出す${w}書の「${w}の趣旨」と「${w}の理由」を、${req ? 'この自治体' : 'この議会'}あての文として書き直してください。`);
    L.push(req ? '同じ文面がたくさん届くと、ひとまとめに扱われ、一人ひとりの声として読まれにくくなります。地元の住民が自分の言葉で書いた要望として読まれるようにするのが目的です。'
      : '同じ文面がたくさんの議会に届くと、議会によっては審査されないことがあります。地元の住民が自分の言葉で書いた陳情として読まれるようにするのが目的です。', '');
    L.push('## 求める事項（参考。ここは書き直さないでください）', asks || '（なし）', '');
    L.push(`## いまの${w}の趣旨`, s.purpose, '', `## いまの${w}の理由`, s.reasons, '');
    if (info.local && info.local.trim()) L.push(`## この地域について${person}が知っていること`, info.local.trim(), '');
    if (info.story && info.story.trim()) L.push(`## ${person}が見聞きしたこと`, info.story.trim(), '');
    // 地域の計画と結びつけると、議会や担当課に「本市の方針に沿った陳情（要望）」として読んでもらいやすい
    L.push(`## ${place}の計画と結びつける`);
    L.push(`ウェブを検索できる場合は、${place}の公式サイトで、次のような計画の最新版を探してください（名前は自治体によって違うので、近いものでかまいません）。`);
    window.THEME.ai.plans.forEach((pl) => L.push(`- ${pl}`));
    L.push(`見つかったら、${w}の理由の中で1〜2か所、「${place}の○○計画（令和○年度〜令和○年度）は『……』を掲げています」のように、計画の名前・期間と、求める事項につながる目標や施策を短く原文のまま引き、求める事項がその計画を進めるものだと示してください。`);
    L.push('公式サイトで確かめられなかった計画・引用・期間は書かないでください。検索できない場合や見つからない場合は、作らずに「【要確認：○○計画の該当箇所】」と書いてください。', '');
    L.push('## 書き直しのルール');
    [
      '言い回しと段落の組み立てを、いまの文から十分に変える。ただし、言っている中身と求める事項は変えない。',
      '地域の事情は、上の「この地域について」に書かれたことだけを使う。それ以外で地域に触れたいときは「【要確認：○○】」と書き、数字・制度・出来事を作らない。',
      '統計・判例・国会答弁などの事実は、いまの文にあるもの以外は書かない。',
      `日付・地名・相手方・裁判や調停の経過など、個人や事件を特定できる内容は書かない。${person}が見聞きしたことは、一般的な言葉で1〜2文にする。`,
      `${w}の理由は、いまと同じく「1．○○」の見出しで分け、全体の長さもいまと同じくらいにする。`,
      '丁寧な文体（です・ます、または である）は、いまの文に合わせる。',
    ].forEach((r) => L.push(`- ${r}`));
    L.push('', '## 出力の形式', `次の形だけで出力してください。目印の行（${PURPOSE}${REASONS}${PLANS}）はそのまま書き、前後に説明や見出しを足さないでください。`, '');
    L.push(PURPOSE, '（書き直した趣旨）', REASONS, '（書き直した理由）', PLANS, '（引いた計画ごとに「計画の名前／URL／引いた所」を1行ずつ。引いていなければ「なし」）');
    return L.join('\n');
  }

  // AI の答えから趣旨と理由を取り出し、文面の同じ所と入れ替える。目印が見つからなければ null
  function applyRewrite(text, answer) {
    const { PURPOSE, REASONS } = marks(text);
    // AI が陳情と要望の目印を取り違えても受け取れるよう、文面の目印にそろえる
    const a = answer.replace(/\r/g, '').replace(/^```.*$/gm, '').split('\n')
      .map((l) => (/^【(陳情|要望)の趣旨】$/.test(l.trim()) ? PURPOSE : /^【(陳情|要望)の理由】$/.test(l.trim()) ? REASONS : l));
    const p = span(a, PURPOSE, (s) => s === REASONS);
    const r = span(a, REASONS, (s) => s === PLANS);
    if (!p || !r) return null;
    const purpose = a.slice(p.from, p.to);
    const reasons = a.slice(r.from, r.to);
    if (!purpose.some((l) => l.trim()) || !reasons.some((l) => l.trim())) return null;
    const lines = text.replace(/\r/g, '').split('\n');
    const tp = span(lines, PURPOSE, isPurposeEnd);
    const tr = span(lines, REASONS, isReasonsEnd);
    if (!tp || !tr) return null;
    // 後ろの理由から入れ替えると、前の趣旨の行の番号がずれない
    lines.splice(tr.from, tr.to - tr.from, ...reasons);
    lines.splice(tp.from, tp.to - tp.from, ...purpose);
    return lines.join('\n');
  }

  // AI の答えの【参照した計画】から、確かめてもらう計画を取り出す（{ text, url }。URL は http(s) のものだけ）
  function rewritePlans(answer) {
    const a = answer.replace(/\r/g, '').replace(/^```.*$/gm, '').split('\n');
    const r = span(a, PLANS, () => false);
    if (!r) return [];
    return a.slice(r.from, r.to).map((l) => l.replace(/^[-・*\s]+/, '').trim())
      .filter((l) => l && l !== 'なし')
      .map((l) => ({ text: l, url: (l.match(/https?:\/\/[^\s／）)」]+/) || [''])[0] }));
  }

  // 文面の住所の行を、差出人（Common.sender の形）で書き換える。手で直した文面にも使えるよう、行ごと置き換える
  // 氏名は本人が手書きで署名するので、いつも下線のままにする（入力した氏名は送付状と封筒にだけ使う）
  // 電話番号は陳情書には入れない（陳情書は公開されることがあるため）。議会事務局だけが読む送付状に入れる
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
    // 要望書の宛名（宮城県知事 → 仙台市長）は、呼び方ごと置き換えてから、残りの地名を置き換える
    return text.split(from).join(to).split(requestTo(place(from))).join(requestTo(place(to))).split(place(from)).join(place(to));
  }

  // 郵送で陳情書の上に重ねる送付状。docs はその議会に送る陳情書の文面（件名を一覧にする）
  function cover(council, docs, s) {
    const addr = [s.zip && `〒${s.zip}`, s.address].filter(Boolean).join('　') || BLANK_TEXT;
    const from = [`住所　${addr}`, `氏名　${s.name || BLANK_TEXT}`, `電話　${s.tel || BLANK_TEXT}`];
    const subjects = docs.map((d) => (d.match(/^件名　(.+)$/m) || [])[1]).filter(Boolean);
    const documentLabel = docs.some((d) => /^件名　.*要望/.test(d)) ? '要望書' : '陳情書';
    const list = subjects.length
      ? subjects.map((t, i) => `${KANSUJI[i] || i + 1}　${documentLabel}「${t}」　1通`).join('\n')
      : `一　${documentLabel}　${docs.length}通`;
    return fill(TEMPLATE.cover, { 日付: reiwaToday(), 宛先: council, 差出人: from.join('\n'), 書類: list, 通数: String(docs.length) }).replaceAll('陳情書', documentLabel);
  }

  return { headOf, build, buildPrompt, sections, buildRewritePrompt, applyRewrite, rewritePlans, withSender, swapCouncil, cover, selectedKeys, isNational, ordered, ITEMS, MANY, SEP };
})();
