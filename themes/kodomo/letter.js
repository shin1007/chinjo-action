// 議員への手紙（公開されない前提）。陳情書には書けない個人の事情を、制度の問題に結びつけて伝える。
(() => {
  const form = document.getElementById('letterForm');
  // 手紙は折りたたんであるので、ページ内リンクから来たときは開く
  const openFold = () => location.hash === '#letter' && (document.getElementById('letterFold').open = true);
  window.addEventListener('hashchange', openFold);
  openFold();
  const out = document.getElementById('letterText');
  const { BLANK_TEXT, copy, printTexts } = window.Common;

  const TROUBLES = [
    ['police', '警察に相談したが「民事の問題」として対応してもらえなかった'],
    ['court', '家庭裁判所の手続きに長い時間がかかり、その間会えなかった'],
    ['indirect', '調停・審判で「間接交流」とされ、子どもに親の存在を示せない'],
    ['dvmeasure', '住民票の閲覧制限で、子どもの居所や学校が分からない'],
    ['school', '学校・保育所から子どもの様子を教えてもらえない、行事への参加を断られた'],
    ['window', '自治体の相談窓口に、別居親が相談できる支援がなかった'],
    ['nosupport', '親子交流の支援事業がない、または相手の同意がないと使えない'],
    ['fees', '婚姻費用・養育費を払っているのに、子どもに会えない'],
  ];
  const WORRIES = [
    ['presence', '子どもが親の存在を知らないまま育つこと'],
    ['gifts', '手紙やプレゼントが子どもに届いていない、捨てられているかもしれないこと'],
    ['poverty', '子どもの暮らしが経済的に苦しくなること'],
    ['relatives', '祖父母・いとこなど親族との関係が絶たれていること'],
    ['loyalty', '子どもが一方の親の悪口を聞かされて育つこと'],
    ['health', '子どもの心身の健康や発達'],
  ];

  const checks = (list, name) => list
    .map(([v, l]) => `<label class="check"><input type="checkbox" name="${name}" value="${v}"> ${l}</label>`).join('');
  document.getElementById('troubleList').innerHTML = checks(TROUBLES, 'trouble');
  document.getElementById('worryList').innerHTML = checks(WORRIES, 'worry');

  const PURPOSES = {
    intro: '陳情（請願）の紹介議員をお引き受けいただけないでしょうか',
    question: '議会の一般質問などで、この問題を取り上げていただけないでしょうか',
    meet: '一度、直接お話をお聞きいただける機会をいただけないでしょうか',
    know: '私が提出した陳情の背景として、こうした実情があることを知っておいていただければ幸いです',
  };
  const CONTACT = {
    none: '子どもとはまったく会えていません',
    indirect: '直接会うことはできず、手紙などの間接的な交流のみとなっています',
    rare: '子どもと会えるのは年に数回以下です',
    regular: '現在は定期的に会えていますが、そこに至るまでに長い時間がかかりました',
  };
  const DV = {
    none: '私たち夫婦の間に、暴力やモラルハラスメントはありませんでした。',
    victim: '私自身、相手から精神的・身体的な暴力を受けていました。',
    accused: '相手からはDVがあったと主張されていますが、私は事実ではないと考えています。',
    both: '夫婦の間では言い争いが絶えませんでしたが、子どもに危険が及ぶようなことはありませんでした。',
  };
  const ABUSE = {
    consulted: '子どもへの虐待やネグレクトのおそれを感じ、関係機関に相談しました。',
    worried: '子どもへの虐待やネグレクトのおそれを感じていますが、確かめる手段がありません。',
  };
  const label = (list, v) => (list.find(([k]) => k === v) || [])[1];

  function elapsed(month) {
    if (!month) return '';
    const [y, m] = month.split('-').map(Number);
    const now = new Date();
    const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    if (months < 1) return '';
    const yy = Math.floor(months / 12);
    const mm = months % 12;
    return `${y}年${m}月から、${yy ? yy + '年' : ''}${mm ? mm + 'か月' : ''}が経ちました`;
  }

  const val = (d, k) => (d.get(k) || '').trim();
  const indent = (t) => '　' + t.replace(/\n/g, '\n　');

  function buildLetter(d) {
    const L = [];
    const council = val(d, 'council');
    const member = val(d, 'member') || BLANK_TEXT;
    L.push(`　　　　　　　　　　　　　　　　　　　　　　　　${window.Common.reiwaToday()}`, '', `${council ? council + '議員　' : ''}${member}　先生`, '');
    L.push('拝啓　日頃より地域のためにご尽力いただき、心より感謝申し上げます。');
    L.push(`　${val(d, 'role') ? val(d, 'role') + 'の立場から、' : ''}父母の別居・離婚に伴い、子どもが一方の親との関係を失ってしまう問題について、私自身の経験をお伝えしたく、お手紙を差し上げました。`, '');

    const kids = val(d, 'children');
    const since = elapsed(val(d, 'since'));
    const contact = CONTACT[d.get('contact')];
    if (kids || since || contact || val(d, 'contactDetail')) {
      L.push('■ 子どもと私の今');
      const s = [];
      if (kids) s.push(`子どもは${kids}です。`);
      if (since) s.push(`子どもと離れて暮らすようになって、${since}。`);
      if (contact) s.push(`${contact}。`);
      L.push(indent(s.join('')));
      if (val(d, 'contactDetail')) L.push(indent(val(d, 'contactDetail')));
      L.push('');
    }
    if (val(d, 'history')) L.push('■ これまでの経緯', indent(val(d, 'history')), '');
    if (val(d, 'efforts')) L.push('■ 私がしてきたこと', indent(val(d, 'efforts')), '');

    const troubles = d.getAll('trouble').map((v) => label(TROUBLES, v));
    if (troubles.length || val(d, 'troubleDetail')) {
      L.push('■ 制度や行政の窓口で直面したこと');
      troubles.forEach((t) => L.push(`・${t}`));
      if (val(d, 'troubleDetail')) L.push(indent(val(d, 'troubleDetail')));
      L.push('');
    }

    const worries = d.getAll('worry').map((v) => label(WORRIES, v));
    const abuse = ABUSE[d.get('abuse')];
    if (worries.length || val(d, 'worryDetail') || abuse) {
      L.push('■ 子どもについて心配していること');
      worries.forEach((t) => L.push(`・${t}`));
      if (val(d, 'worryDetail')) L.push(indent(val(d, 'worryDetail')));
      if (abuse) L.push(indent(abuse));
      L.push('');
    }

    if (val(d, 'economy') || val(d, 'mylife')) {
      L.push('■ 暮らしのこと');
      if (val(d, 'economy')) L.push(indent(val(d, 'economy')));
      if (val(d, 'mylife')) L.push(indent(val(d, 'mylife')));
      L.push('');
    }

    const dv = DV[d.get('dv')];
    if (dv || val(d, 'partner')) {
      L.push('■ 家庭の状況について');
      if (dv) L.push(indent(dv));
      if (val(d, 'partner')) L.push(indent(val(d, 'partner')));
      L.push('');
    }

    L.push('■ お願い');
    L.push('　議員の先生に個別の家庭の問題へ介入していただくことはできないと承知しております。そのうえで、私の経験は決して特別なものではなく、同じ制度や運用のもとで、多くの子どもと親が同じ状況に置かれていると考えています。');
    const purposes = d.getAll('purpose').map((p) => PURPOSES[p]);
    purposes.forEach((p) => L.push(`　${p}。`));
    if (val(d, 'message')) L.push('', indent(val(d, 'message')));
    L.push('', '　ご多忙のところ、長い手紙をお読みいただき、ありがとうございました。', '　　　　　　　　　　　　　　　　　　　　　　　　　　　　　敬具', '');
    L.push(`　　　　　　　　　　　　氏名　${val(d, 'name') || BLANK_TEXT}`);
    L.push(`　　　　　　　　　　　　連絡先　${val(d, 'contact_info') || BLANK_TEXT}`);
    L.push('', '※この手紙には私的な事情が含まれています。取り扱いにご配慮いただけますと幸いです。');
    return L.join('\n');
  }

  // 生成AIへの指示文。氏名・連絡先は入れない
  function buildPrompt(d) {
    const L = ['あなたは、市民が地方議員に送る手紙の作成を手伝う専門家です。以下のメモをもとに、議員に送る丁寧な手紙を作成してください。', ''];
    L.push('## 手紙の目的');
    L.push(d.getAll('purpose').map((p) => `- ${PURPOSES[p]}`).join('\n') || '- 問題の実情を知ってもらう');
    L.push('', '## メモ（書き手の事情）');
    const add = (title, text) => { if (text) L.push(`### ${title}`, text); };
    add('立場', val(d, 'role'));
    add('子ども', val(d, 'children'));
    add('離れて暮らしている期間', elapsed(val(d, 'since')));
    add('いまの交流', CONTACT[d.get('contact')]);
    add('交流の様子', val(d, 'contactDetail'));
    add('経緯', val(d, 'history'));
    add('してきたこと', val(d, 'efforts'));
    add('制度や窓口で困ったこと', [...d.getAll('trouble').map((v) => '- ' + label(TROUBLES, v)), val(d, 'troubleDetail')].filter(Boolean).join('\n'));
    add('子どもについて心配なこと', [...d.getAll('worry').map((v) => '- ' + label(WORRIES, v)), val(d, 'worryDetail'), ABUSE[d.get('abuse')]].filter(Boolean).join('\n'));
    add('暮らし', [val(d, 'economy'), val(d, 'mylife')].filter(Boolean).join('\n'));
    add('家庭の状況', [DV[d.get('dv')], val(d, 'partner')].filter(Boolean).join('\n'));
    add('伝えたい思い', val(d, 'message'));
    L.push('', '## 書き方のルール');
    [
      '議員は個別の家庭の紛争には介入できない。手紙の中心は「制度や行政の運用のどこに問題があるか」に置き、書き手の経験はその具体例として示す。',
      'メモにない事実を足さない。事実（いつ・何があったか）と、書き手の気持ちや推測をはっきり分けて書く。',
      '相手方の性格の評価、病名の推測、人格を否定する表現は書かない。相手方の言動は、メモにある具体的な事実だけを穏やかな言葉で書く。',
      '相手方・子ども・地名など、個人を特定できる固有名詞は書かない。',
      '感情的になりすぎず、しかし子どもを思う気持ちが伝わる、誠実な文体にする。',
      'A4で2枚程度。最初の段落で、何をお願いしたい手紙なのかが分かるようにする。',
      '宛名は「○○議会議員　○○　先生」、差出人の氏名・連絡先は空欄（＿＿＿＿）にする。',
    ].forEach((r) => L.push(`- ${r}`));
    L.push('', '最後に、手紙とは別に、送る前に見直したほうがよい点を3つ以内で挙げてください。');
    return L.join('\n');
  }

  const show = (id) => {
    const box = document.getElementById(id);
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    out.value = buildLetter(new FormData(form));
    show('letterOutput');
  });
  document.getElementById('letterAiBtn').addEventListener('click', () => {
    document.getElementById('letterAiPrompt').value = buildPrompt(new FormData(form));
    show('letterAiOutput');
  });
  document.getElementById('letterCopy').addEventListener('click', () => out.value && copy(out.value, 'コピーしました'));
  document.getElementById('letterAiCopy').addEventListener('click', () =>
    copy(document.getElementById('letterAiPrompt').value, '指示文をコピーしました'));

  // 手紙は個人的な内容なのでサイトには残さない。残したい人は自分のメールに送る
  document.getElementById('letterMail').addEventListener('click', () => {
    if (out.value) location.href = `mailto:?subject=${encodeURIComponent('議員への手紙（下書き）')}&body=${encodeURIComponent(out.value)}`;
  });

  document.getElementById('letterPrint').addEventListener('click', () => {
    if (out.value) printTexts([out.value]);
  });
})();
