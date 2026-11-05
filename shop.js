// 「関連する本・グッズ」の欄を、themes/<テーマ>/shop.js の window.SHOP から作ります。
// AMAZON_TAG にアソシエイトのトラッキングID（例：xxxx-22）を入れると、全てのリンクに付きます。
// 商品は ASIN を作らず、Amazon の検索リンク（q の言葉で検索）にしているので、品切れや版の違いでリンク切れになりません。
// 画像は、商品に asin（Amazon の商品ページの URL の /dp/ の後ろの10文字）を書いたときだけ、Amazon の画像を出します。
// COMMON は、陳情書を作って出すのに使う文房具で、全てのテーマの商品の後ろに並べます。
(() => {
  const COMMON = [
    { kind: '文房具', title: '透けない封筒 角形2号', by: 'ハート', q: 'ハート 透けない封筒 角2',
      note: 'A4 を折らずに送る封筒。署名や資料を付けて送るときに。' },
    { kind: '文房具', title: '高白色のコピー用紙 A4', by: 'キヤノン', q: 'キヤノン 高白色用紙 A4',
      note: '白くて裏写りしにくい用紙。議員に配られる陳情書が読みやすくなります。' },
    { kind: '文房具', title: 'ゲルインクボールペン 黒', by: 'ゼブラ サラサクリップ 0.5', q: 'ゼブラ サラサクリップ 0.5 黒',
      note: '署名や宛名に。にじまず、くっきり書けます。' },
    { kind: '文房具', title: 'クリアファイル A4', by: 'キングジム', q: 'キングジム クリアーファイル A4',
      note: '議会事務局に持参するとき、陳情書を折らずに運べます。' },
  ];
  const AMAZON_TAG = '7nrr25mb-22';
  const box = document.querySelector('[data-shop]');
  if (!box || !window.SHOP) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const link = (q) => 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(q) + (AMAZON_TAG ? '&tag=' + encodeURIComponent(AMAZON_TAG) : '');
  const img = (asin) => 'https://ws-fe.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=' + encodeURIComponent(asin) + '&Format=_SL250_&ID=AsinImage&MarketPlace=JP&ServiceVersion=20070822&WS=1' + (AMAZON_TAG ? '&tag=' + encodeURIComponent(AMAZON_TAG) : '');
  box.innerHTML = `<div class="cards">${[...window.SHOP, ...COMMON].map((it) => `
    <article class="card">
      ${it.asin ? `<a class="shop-img" href="${link(it.q)}" target="_blank" rel="noopener sponsored"><img src="${img(it.asin)}" alt="${esc(it.title)}" loading="lazy"></a>` : ''}
      <p class="shop-kind">${esc(it.kind)}</p>
      <h3>${esc(it.title)}</h3>
      ${it.by ? `<p class="hint-sm">${esc(it.by)}</p>` : ''}
      <p>${esc(it.note)}</p>
      <a class="btn btn-small" href="${link(it.q)}" target="_blank" rel="noopener sponsored">Amazonで見る</a>
    </article>`).join('')}</div>
    <p class="hint-sm">※ このサイトは Amazon アソシエイト・プログラムに参加しています。リンクから購入されると、サイトの運営者に紹介料が入ります（広告）。紹介した本の主張が、このサイトの陳情の内容と全て同じとは限りません。</p>`;
})();
