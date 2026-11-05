// 「関連する本・グッズ」の欄を、themes/<テーマ>/shop.js の window.SHOP から作ります。
// AMAZON_TAG にアソシエイトのトラッキングID（例：xxxx-22）を入れると、全てのリンクに付きます。
// 商品は ASIN を作らず、Amazon の検索リンク（q の言葉で検索）にしているので、品切れや版の違いでリンク切れになりません。
(() => {
  const AMAZON_TAG = '';
  const box = document.querySelector('[data-shop]');
  if (!box || !window.SHOP) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const link = (q) => 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(q) + (AMAZON_TAG ? '&tag=' + encodeURIComponent(AMAZON_TAG) : '');
  box.innerHTML = `<div class="cards">${window.SHOP.map((it) => `
    <article class="card">
      <p class="shop-kind">${esc(it.kind)}</p>
      <h3>${esc(it.title)}</h3>
      ${it.by ? `<p class="hint-sm">${esc(it.by)}</p>` : ''}
      <p>${esc(it.note)}</p>
      <a class="btn btn-small" href="${link(it.q)}" target="_blank" rel="noopener sponsored">Amazonで見る</a>
    </article>`).join('')}</div>
    <p class="hint-sm">※ このサイトは Amazon アソシエイト・プログラムに参加しています。リンクから購入されると、サイトの運営者に紹介料が入ります（広告）。紹介した本の主張が、このサイトの陳情の内容と全て同じとは限りません。</p>`;
})();
