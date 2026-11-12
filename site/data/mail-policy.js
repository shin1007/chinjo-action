// 郵送・持参による陳情の扱いを正規化したデータ。
// 既存の data/mail.js は移行期間の入力として読み、個別の新データはここに追加する。
// キー：都道府県名 → 市区町村名（"@" は都道府県）→
// { mail_resident, mail_nonresident, hand_nonresident, source_quote, source_url,
//   note, verified_at, confidence }
window.MAIL_POLICY = window.MAIL_POLICY || {};

window.MailPolicy = (() => {
  const VALID = new Set(['ok', 'distribute', 'unknown']);
  const legacyMap = {
    ok: ['ok', 'ok'],
    jisan: ['distribute', 'distribute'],
    outside: ['ok', 'distribute'],
    none: ['distribute', 'distribute'],
  };

  function fromLegacy(row) {
    if (!Array.isArray(row) || !legacyMap[row[0]]) return null;
    const [resident, nonresident] = legacyMap[row[0]];
    return {
      mail_resident: resident,
      mail_nonresident: nonresident,
      hand_nonresident: 'unknown',
      source_quote: row[1] || '',
      source_url: row[2] || '',
      note: '旧 mail.js の判定から移行した値。持参時の非住民の扱いは未確認。',
      verified_at: '2026-11-05',
      confidence: 'confirmed',
    };
  }

  function valid(policy) {
    return policy && VALID.has(policy.mail_resident)
      && VALID.has(policy.mail_nonresident)
      && VALID.has(policy.hand_nonresident)
      && typeof policy.source_quote === 'string'
      && typeof policy.source_url === 'string'
      && typeof policy.note === 'string'
      && typeof policy.verified_at === 'string'
      && ['confirmed', 'likely', 'unknown'].includes(policy.confidence);
  }

  function get(pref, key) {
    const explicit = ((window.MAIL_POLICY[pref] || {})[key]);
    if (valid(explicit)) return explicit;
    return fromLegacy((((window.MAIL || {})[pref] || {})[key]));
  }

  return { get, fromLegacy, valid };
})();
