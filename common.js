// トップページの各機能で共通に使う小さな道具（通知・コピー・印刷・日付）。
window.Common = (() => {
  // 未入力の名前・住所などを表す空欄。印刷時は下線になる
  const BLANK_TEXT = '＿＿＿＿＿＿';

  let timer;
  function flash(msg, ms = 1800) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (t.hidden = true), ms);
  }

  // コピーできたかを返す（失敗時は利用者に手動でのコピーを案内する）
  async function copy(text, msg = 'コピーしました') {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
      return true;
    } catch {
      flash('コピーできませんでした。文章を長押し（またはCtrl+A）で選んでコピーしてください。', 4000);
      return false;
    }
  }

  // 本文にも属性の値にも使えるよう、引用符もエスケープする
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 1つの文書を1ページ以上として印刷する
  function printTexts(texts) {
    let area = document.getElementById('printArea');
    if (!area) {
      area = document.createElement('div');
      area.id = 'printArea';
      document.body.appendChild(area);
    }
    area.innerHTML = texts.map((t) => `<section class="print-doc">${esc(t.trim())
      .replaceAll(BLANK_TEXT, '<span class="blank"></span>')}</section>`).join('');
    window.print();
  }

  // 議会に出す文書は令和で書く
  function reiwaToday() {
    const d = new Date();
    const y = d.getFullYear() - 2018;
    return `令和${y === 1 ? '元' : y}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  // data/ のファイルを手で直して書き間違えると、そのファイルが読み込めず画面が空になる。どこが悪いかを画面に出す
  const DATA = { PREFS: 'prefs.js', ASKS: 'asks-national.js または asks-local.js', TEMPLATE: 'template.js', MUNICIPALITIES: 'municipalities.js' };
  const broken = Object.keys(DATA).filter((k) => !window[k] || (k === 'ASKS' && !window.ASKS.length));
  if (broken.length && typeof document !== 'undefined') {
    const p = document.createElement('p');
    p.className = 'data-error';
    p.textContent = `文面のデータを読み込めませんでした（data/${broken.map((k) => DATA[k]).join('、data/')}）。直したところに「,」や「'」の抜けがないか見直してください。`;
    document.body.prepend(p);
  }

  return { BLANK_TEXT, esc, flash, copy, printTexts, reiwaToday };
})();
