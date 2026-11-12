// 郵送・持参の扱いを、後から data/mail-policy.js に移せる回答データとして書き出す。
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      $('toast').textContent = '確認内容をコピーしました';
      $('toast').hidden = false;
    } catch {
      $('output').focus();
      $('output').select();
    }
  };
  $('verifiedAt').value = new Date().toISOString().slice(0, 10);

  const allCouncils = Object.entries(window.MUNICIPALITIES)
    .flatMap(([pref, names]) => [
      [pref, '都道府県議会'],
      ...names.map((name) => [pref, name]),
    ]);
  let populations = new Map();
  const renderCouncils = () => {
    const query = $('councilSearch').value.trim();
    const councils = allCouncils
      .filter(([pref, name]) => !query || `${pref}${name}`.includes(query))
      .sort(([prefA, nameA], [prefB, nameB]) => {
        const populationA = populations.get(`${prefA}|${nameA}`);
        const populationB = populations.get(`${prefB}|${nameB}`);
        if (populationA == null && populationB == null) return 0;
        if (populationA == null) return 1;
        if (populationB == null) return -1;
        return populationB - populationA;
      });
    $('council').innerHTML = `<option value="">選んでください</option>${councils.map(([pref, name]) =>
      `<option value="${esc(`${pref}|${name}`)}">${esc(`${pref}${name}`)}${populations.has(`${pref}|${name}`) ? `（人口 約${populations.get(`${pref}|${name}`).toLocaleString()}人）` : '（人口データ未登録）'}</option>`,
    ).join('')}`;
  };
  renderCouncils();
  $('councilSearch').addEventListener('input', renderCouncils);
  fetch('/data/municipality-populations.json?v=20261111')
    .then((response) => {
      if (!response.ok) throw new Error(`人口データの取得に失敗しました: ${response.status}`);
      return response.json();
    })
    .then((items) => {
      if (!items || typeof items.populations !== 'object') throw new Error('人口データの形式が不正です');
      populations = new Map(Object.entries(items.populations));
      renderCouncils();
    })
    .catch((error) => console.error('人口データを読み込めませんでした', error));

  $('council').addEventListener('change', () => {
    const [pref, council] = $('council').value.split('|');
    const record = window.TEL?.[pref]?.[council]
      || (council === '都道府県議会' ? window.TEL?.[pref]?.['@'] : null);
    const phone = $('councilPhone');
    if (record) {
      phone.innerHTML = `確認先：<a href="tel:${esc(record[1])}">${esc(record[1])}</a>（${record[0] === 'gikai' ? '議会事務局' : '代表番号'}）`;
    } else {
      phone.textContent = '電話番号は未登録です。自治体の代表番号から議会事務局をお尋ねください。';
    }
    phone.hidden = false;
  });

  const value = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
  const reportText = (r) => [
    `## ${r.pref}/${r.council}`,
    '',
    `- mail_resident: ${r.mail_resident}`,
    `- mail_nonresident: ${r.mail_nonresident}`,
    `- hand_nonresident: ${r.hand_nonresident}`,
    `- reference_materials: ${r.reference_materials}`,
    `- verified_at: ${r.verified_at}`,
    '',
    '### 注意事項',
    r.note || '(なし)',
    '',
    '### 詳細データ',
    '```json',
    JSON.stringify(r, null, 2),
    '```',
  ].join('\n');

  $('contributionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const [pref, council] = $('council').value.split('|');
    const result = {
      pref,
      council,
      mail_resident: value('mailResident'),
      mail_nonresident: value('mailNonresident'),
      hand_nonresident: value('handNonresident'),
      reference_materials: value('referenceMaterials'),
      note: $('note').value.trim(),
      verified_at: $('verifiedAt').value,
    };
    $('output').value = reportText(result);
    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('copyReport').onclick = () => copy($('output').value);
    $('downloadJson').onclick = () => {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${result.pref}-${result.council}-mail-policy.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
  });
})();
