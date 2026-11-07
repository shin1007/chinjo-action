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
  const prefs = Object.keys(window.MUNICIPALITIES);
  $('pref').insertAdjacentHTML('beforeend', prefs.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));
  $('verifiedAt').value = new Date().toISOString().slice(0, 10);

  $('pref').addEventListener('change', () => {
    const pref = $('pref').value;
    const names = pref ? ['都道府県議会', ...window.MUNICIPALITIES[pref]] : [];
    $('council').innerHTML = names.length
      ? `<option value="">選んでください</option>${names.map((n) => `<option>${esc(n)}</option>`).join('')}`
      : '<option value="">先に都道府県を選んでください</option>';
    $('council').disabled = !names.length;
  });

  const value = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || 'unknown';
  const reportText = (r) => [
    `## ${r.pref}/${r.council}`,
    '',
    `- mail_resident: ${r.mail_resident}`,
    `- mail_nonresident: ${r.mail_nonresident}`,
    `- hand_nonresident: ${r.hand_nonresident}`,
    `- source_url: ${r.source_url}`,
    `- verified_at: ${r.verified_at}`,
    `- confidence: ${r.confidence}`,
    '',
    '### source_quote',
    r.source_quote || '(なし)',
    '',
    '### note',
    r.note || '(なし)',
    '',
    '### 詳細データ',
    '```json',
    JSON.stringify(r, null, 2),
    '```',
  ].join('\n');

  $('contributionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const quote = $('sourceQuote').value.trim();
    const url = $('sourceUrl').value.trim();
    const result = {
      pref: $('pref').value,
      council: $('council').value,
      mail_resident: value('mailResident'),
      mail_nonresident: value('mailNonresident'),
      hand_nonresident: value('handNonresident'),
      source_quote: quote,
      source_url: url,
      note: $('note').value.trim(),
      verified_at: $('verifiedAt').value,
      confidence: quote && url ? 'confirmed' : url ? 'likely' : 'unknown',
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
