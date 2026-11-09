// 議員への手紙を、入力内容を送信せずブラウザ内だけで組み立てる。
(() => {
  const { BLANK_TEXT, copy, printTexts, reiwaToday } = window.Common;
  const SITE_URL = 'https://chinjo-action.vercel.app/letter';

  const THEMES = [
    {
      id: 'kodomo', name: '子どもの権利',
      intro: '父母の別居・離婚後も、子どもが両方の親と関わり続けられる社会について、お考えをお伝えしたくご連絡しました。',
      issues: [
        ['school', '学校から両方の親への情報提供', '別居後、学校からのお知らせや行事案内が一方の親に届かない状況について、子どもの利益を中心にした情報提供の運用を望んでいます。'],
        ['abduction', '正当な理由のない子の連れ去りへの対応', '一方の親の同意なく子を連れて別居した場合でも、子どもと両方の親との関係が不必要に断たれないための対応が必要だと考えています。'],
        ['joint-custody', '改正民法（共同親権）の運用改善', '2026年4月施行の改正民法について、子どもの利益を最優先に、地域の相談窓口や関係機関が適切に運用できるよう周知と点検を望みます。'],
        ['support', '親子交流の支援', '親子交流の支援事業がない、または利用しにくい地域があります。安全に配慮しながら利用できる支援体制の整備を望みます。'],
        ['dv-measures', 'DV等支援措置の運用の点検', '住民票の閲覧制限は被害者保護に不可欠ですが、保護の必要性を確認しながら、子どもの教育や医療に必要な情報提供も両立できる運用を望みます。'],
      ],
    },
    {
      id: 'dansei', name: '男女平等',
      intro: '性別にかかわらず相談や支援を受けられる仕組みについて、お考えをお伝えしたくご連絡しました。',
      issues: [
        ['consultation', '男性も使える相談窓口', '性別にかかわらず、困りごとを安心して相談でき、必要な支援につながれる窓口の整備を望みます。'],
        ['shelter', '男性のDV被害者の避難先', '男性のDV被害者も安全を確保できる一時避難先や相談支援につながれる体制の整備を望みます。'],
        ['review', '性別で対象を限った施策の見直し', '施策の目的を保ちながら、必要な人が性別によって支援から取り残されないか、対象や運用の点検を望みます。'],
      ],
    },
    {
      id: 'nihonjin', name: '日本人の権利',
      intro: '生活保障や安全保障、地域の文化に関わる制度のあり方について、お考えをお伝えしたくご連絡しました。',
      issues: [
        ['welfare', '外国人への生活保護の運用', '生活保障制度について、法令と運用の根拠が分かりやすく示され、適正な審査と支給が行われることを望みます。'],
        ['insurance', '社会保険料の未納対策', '社会保険制度を持続させるため、保険料の負担と納付の公平性を確保する対策を望みます。'],
        ['security-land', '安全保障上重要な土地の取得規制', '安全保障上重要な土地について、地域の安心と土地取引の透明性を両立する制度の運用を望みます。'],
        ['culture', '学校の食文化・伝統行事', '学校で地域の食文化や伝統行事を学び、次の世代へ伝えられる機会を大切にすることを望みます。'],
      ],
    },
    {
      id: 'shiho', name: '司法',
      intro: '裁判手続の透明性や国民の司法参加について、お考えをお伝えしたくご連絡しました。',
      issues: [
        ['family-court', '家庭裁判所の手続の透明化', '家庭裁判所の手続について、当事者が見通しや判断の理由を理解できるよう、説明と情報公開の充実を望みます。'],
        ['supreme-court', '最高裁裁判官の選任・国民審査', '最高裁判所裁判官の選任や国民審査について、判断材料となる情報が分かりやすく公開されることを望みます。'],
        ['citizen-participation', '裁判への国民参加の拡大', '司法を身近で開かれたものにするため、国民が裁判や司法制度について学び、参加できる機会の拡大を望みます。'],
      ],
    },
    {
      id: 'kenko', name: '国民の健康',
      intro: '国民の健康を守る施策について、お考えをお伝えしたくご連絡しました。',
      issues: [
        ['health-tax', '酒・たばこ課税と砂糖税など', '健康や社会的費用との関係を踏まえ、酒・たばこ・糖分を含む食品への課税のあり方を検討することを望みます。'],
        ['screening', 'がん検診・特定健診の受診率の向上', '病気を早く見つけられるよう、がん検診と特定健診を受けやすくし、受診を勧める取組の充実を望みます。'],
      ],
    },
    {
      id: 'sonota', name: 'その他',
      intro: '税・教育など、地域と国の制度のあり方について、お考えをお伝えしたくご連絡しました。',
      issues: [
        ['corporate-tax', '学校法人・宗教法人への課税の見直し', '公益性のある活動を支えつつ、法人の活動実態に応じた税負担と説明責任が確保される制度の点検を望みます。'],
        ['high-school', '私立高校無償化と公立高校の維持', '教育機会を守るため、私立高校への支援と公立高校の役割・基盤の維持を両立する施策を望みます。'],
        ['npo-accounting', 'NPO法人の会計報告の厳格化', 'NPO法人の活動への信頼を保つため、会計報告の分かりやすさと確認体制の充実を望みます。'],
      ],
    },
  ];

  const PURPOSES = {
    intro: '陳情・請願の紹介議員になっていただけないでしょうか',
    question: '議会の一般質問で、この問題を取り上げていただけないでしょうか',
    meet: '直接お会いして、話を聞いていただけないでしょうか',
    know: '提出した陳情の背景を知っておいていただければ幸いです',
  };
  const form = document.getElementById('letterForm');
  const themeSelect = document.getElementById('letterTheme');
  const issueBox = document.getElementById('letterIssues');
  const purposeBox = document.getElementById('letterPurposes');
  const output = document.getElementById('letterText');
  const params = new URLSearchParams(location.search);
  const requestedTheme = params.get('theme');
  const requestedAsks = new Set((params.get('asks') || '').split(',').map((v) => v.trim()).filter(Boolean));

  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.name;
    themeSelect.append(option);
  });
  themeSelect.value = THEMES.some((theme) => theme.id === requestedTheme) ? requestedTheme : THEMES[0].id;

  function checks(items, name) {
    return items.map(([id, label]) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = name;
      input.value = id;
      input.dataset.label = label;
      wrapper.append(input, document.createTextNode(` ${label}`));
      return wrapper;
    });
  }

  function renderIssues() {
    const theme = THEMES.find((item) => item.id === themeSelect.value) || THEMES[0];
    issueBox.replaceChildren(...checks(theme.issues, 'issue'));
    issueBox.querySelectorAll('input').forEach((input) => {
      if (requestedAsks.has(input.value)) input.checked = true;
      input.addEventListener('change', update);
    });
    update();
  }

  purposeBox.replaceChildren(...checks(Object.entries(PURPOSES).map(([id, text]) => [id, text]), 'purpose'));
  themeSelect.addEventListener('change', renderIssues);
  form.querySelectorAll('input:not([type="checkbox"])').forEach((input) => input.addEventListener('input', update));
  purposeBox.querySelectorAll('input').forEach((input) => input.addEventListener('change', update));

  const value = (name) => (new FormData(form).get(name) || '').toString().trim();
  const indent = (text) => `　${text.replace(/\n/g, '\n　')}`;

  function buildLetter() {
    const theme = THEMES.find((item) => item.id === themeSelect.value) || THEMES[0];
    const selected = new Set(new FormData(form).getAll('issue'));
    const purposes = new FormData(form).getAll('purpose');
    const council = value('council');
    const member = value('member') || BLANK_TEXT;
    const name = value('name') || BLANK_TEXT;
    const contact = value('contact') || BLANK_TEXT;
    const lines = [
      `　　　　　　　　　　　　　　　　　　　　　　　　${reiwaToday()}`,
      '',
      `${council ? `${council}議会　` : ''}${member}　先生`,
      '',
      '拝啓　日頃より地域のためにご尽力いただき、心より感謝申し上げます。',
      '',
      indent(theme.intro),
      '',
    ];
    const issueBodies = theme.issues.filter(([id]) => selected.has(id)).map(([, , body]) => body);
    if (issueBodies.length) {
      lines.push('■ 伝えたいこと', ...issueBodies.map(indent), '');
    }
    lines.push('■ お願い');
    lines.push('　個別の事案への介入をお願いするものではありません。制度や運用の課題として、多くの方に関わる問題だと考えています。');
    purposes.forEach((id) => lines.push(`　${PURPOSES[id]}。`));
    lines.push('', '　ご多忙のところ恐縮ですが、ご検討いただけますと幸いです。', '', '敬具', '', `　　　　　　　　　　　　${name}`, `　　　　　　　　　　　　${contact}`);
    return lines.join('\n');
  }

  function update() {
    output.value = buildLetter();
  }

  document.getElementById('letterCopy').addEventListener('click', () => copy(output.value));
  document.getElementById('letterPrint').addEventListener('click', () => printTexts([output.value]));
  document.getElementById('letterMail').addEventListener('click', () => {
    location.href = `mailto:?subject=${encodeURIComponent('議員への手紙')}&body=${encodeURIComponent(output.value)}`;
  });
  document.getElementById('letterX').addEventListener('click', () => {
    const theme = THEMES.find((item) => item.id === themeSelect.value) || THEMES[0];
    const labels = [...form.querySelectorAll('input[name="issue"]:checked')].map((input) => input.dataset.label).slice(0, 3);
    const short = labels.length ? labels.join('、') : '制度や運用の課題';
    const text = `地方議員の先生へ、${theme.name}について手紙を書きました。${short}。同じ思いの方は ${SITE_URL} から作れます。`;
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  });

  renderIssues();
})();
