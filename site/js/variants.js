// 陳情書の決まった言い回し（趣旨と結びの文末、送付状のあいさつ）に、いくつかの言い方を用意して、乱数で選ぶ。
// 目的：同じ文面がそのまま大量に届かないようにする。事実・数字・条文・求める内容は変えない（変えるのは文末とあいさつだけ）。
// 乱数は、ブラウザのタブごとに1回だけ決めて覚える（作り直しても同じ言い方になる）。覚えられないときは、そのページの間だけ同じ。
// 読み込まないページ（テスト・AI 用の書き出し・見本）では、いつも元の言い方のまま。
(() => {
  const KEY = 'chinjo-variant-seed';
  const rand32 = () => { const a = new Uint32Array(1); (window.crypto || globalThis.crypto).getRandomValues(a); return a[0]; };
  let seed = null;
  try { seed = Number(sessionStorage.getItem(KEY)); } catch { /* 覚えられなくてもよい */ }
  if (!Number.isInteger(seed) || seed <= 0) {
    seed = rand32() || 1;
    try { sessionStorage.setItem(KEY, String(seed)); } catch { /* 同上 */ }
  }
  // 文ごと（name）に、seed から決まった番号を選ぶ
  const index = (name, n) => {
    let h = seed >>> 0;
    for (let i = 0; i < name.length; i += 1) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
    return h % n;
  };
  const pick = (name, list) => list[index(name, list.length)];

  // 先頭が元の言い方。{k} は 陳情・請願・要望
  const PURPOSE_END = [['たく{k}いたします。', 'たく、ここに{k}いたします。', 'たく、{k}いたします。']];
  const CLOSING_END = ['強く要望いたします。', '切に要望いたします。', '強くお願い申し上げます。'];
  const COVER = [
    ['時下ますますご清栄のこととお慶び申し上げます。', '時下ますますご健勝のこととお慶び申し上げます。', '時下ますますご清祥のこととお慶び申し上げます。'],
    ['お取り計らいくださいますようお願い申し上げます。', 'お取り計らいのほどよろしくお願い申し上げます。', '何とぞお取り計らいくださいますようお願い申し上げます。'],
  ];

  const purpose = (text) => text.replace(/たく(陳情|請願|要望)いたします。$/, (m, k) => pick('purpose', PURPOSE_END[0]).replace('{k}', k));
  const closing = (text) => text.replace(/強く要望いたします。$/, () => pick('closing', CLOSING_END));
  const cover = (text) => COVER.reduce((t, list, i) => (t.includes(list[0]) ? t.replace(list[0], pick(`cover${i}`, list)) : t), text);

  window.Variants = { purpose, closing, cover, seed: () => seed };
  if (typeof module !== 'undefined' && module.exports) module.exports = { PURPOSE_END, CLOSING_END, COVER };
})();
