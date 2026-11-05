// 「関連する本・グッズ」の欄を、themes/<テーマ>/shop.js の window.SHOP から作ります。
// AMAZON_TAG にアソシエイトのトラッキングID（例：xxxx-22）を入れると、全てのリンクに付きます。
// 本は ASIN を作らず、Amazon の検索リンク（q の言葉で検索）にしているので、品切れや版の違いでリンク切れになりません。
// 画像は、商品に asin（Amazon の商品ページの URL の /dp/ の後ろの10文字）を書いたときだけ、Amazon の画像を出します。
// COMMON は、陳情書を作って出すのに使う文房具で、提出・郵送の案内のそば（[data-stationery]）に並べます。
// 文房具はおすすめを1つずつ選んでいるので、検索ではなく商品のページ（/dp/ASIN）にリンクします。
(() => {
  const COMMON = [
    { title: '透けない封筒 角形2号 100枚', by: 'ハート KR4290（テープ付き）', asin: 'B0F53W8816',
      note: 'A4 を折らずに入れられ、中身が透けません。テープ付きで、のりなしで封ができます。' },
    { title: 'コピー用紙 A4 500枚', by: '伊藤忠紙パルプ ブランコ（高白色）', asin: 'B00HLTXQ0Y',
      note: '白くて読みやすい用紙。500枚あれば、陳情書と宛名を何度も刷り直せます。' },
    { title: 'ゲルインクボールペン 黒 10本', by: 'ゼブラ サラサクリップ 0.5', asin: 'B00P0PT7BS',
      note: '署名や宛名に。にじまず、くっきり書けます。署名を集めるときに配れる本数です。' },
    { title: 'クリアホルダー A4 10枚', by: 'コクヨ K2フ-C750TX10', asin: 'B00RJKA824',
      note: '議会事務局に持参するとき、陳情書を折らずに運べます。' },
    { title: 'ラベル用紙 A4 8面 余白なし 22シート', by: 'エレコム EDT-ECNL8S22（105×74.25mm）', asin: 'B0DM18K2W7',
      note: '宛名ラベルのページの「A4 8面（余白なし）」にそのまま合う大きさです。' },
    { title: 'ホッチキス', by: 'マックス バイモ11 HD-11SFLK（40枚とじ）', asin: 'B01AOZSI7M',
      note: '陳情書を1件ずつ左上で留めるときに。軽い力で留められ、ページの多い陳情書もとじられます。' },
    { title: 'テープのり', by: 'コクヨ ドットライナー（本体と詰め替え）', asin: 'B0FR88W4TR',
      note: '普通紙に印刷した宛名を封筒に貼るときに。乾かす手間がなく、紙が波打ちません。' },
    { title: 'はさみ', by: 'プラス フィットカットカーブ', asin: 'B0079WLDLW',
      note: '宛名を切り取り線に沿って切るときに。刃にのりが付きにくく、軽い力で切れます。' },
    { title: '小型カッター', by: 'オルファ リミテッドSA', asin: 'B001ADUMO0',
      note: '宛名を定規に当ててまっすぐ切るときに。刃が勝手に出ないオートロック付きです。' },
    { title: 'カッターマット A4', by: 'オルファ 134B', asin: 'B000CEF5R2',
      note: 'カッターを使うときの下敷きに。A4 の用紙がちょうど乗る大きさです。' },
  ];
  const AMAZON_TAG = '7nrr25mb-22';
  const { esc } = window.Common;
  const link = (q) => 'https://www.amazon.co.jp/s?k=' + encodeURIComponent(q) + (AMAZON_TAG ? '&tag=' + encodeURIComponent(AMAZON_TAG) : '');
  const img = (asin) => 'https://images-na.ssl-images-amazon.com/images/P/' + encodeURIComponent(asin) + '.09.MZZZZZZZ.jpg';
  const dp = (asin) => 'https://www.amazon.co.jp/dp/' + encodeURIComponent(asin) + (AMAZON_TAG ? '?tag=' + encodeURIComponent(AMAZON_TAG) : '');
  const NOTE = '※ このサイトは Amazon アソシエイト・プログラムに参加しています。リンクから購入されると、サイトの運営者に紹介料が入ります（広告）。';

  const box = document.querySelector('[data-shop]');
  if (box && window.SHOP) {
    box.innerHTML = `<div class="cards">${window.SHOP.map((it) => `
    <article class="card">
      ${it.asin ? `<a class="shop-img" href="${it.direct ? dp(it.asin) : link(it.q)}" target="_blank" rel="noopener sponsored"><img src="${it.image || img(it.asin)}" alt="${esc(it.title)}" loading="lazy"></a>` : ''}
      <p class="shop-kind">${esc(it.kind)}</p>
      <h3>${esc(it.title)}</h3>
      ${it.by ? `<p class="hint-sm">${esc(it.by)}</p>` : ''}
      <p>${esc(it.note)}</p>
      <a class="btn btn-small" href="${it.direct ? dp(it.asin) : link(it.q)}" target="_blank" rel="noopener sponsored">Amazonで見る</a>
    </article>`).join('')}</div>
    <p class="hint-sm">${NOTE}紹介した本の主張が、このサイトの陳情の内容と全て同じとは限りません。</p>`;
  }

  // 提出・郵送の案内のそばに、文房具を短い一覧で出す
  document.querySelectorAll('[data-stationery]').forEach((el) => {
    el.innerHTML = `<p class="stationery-head">おすすめ文具</p>
    <ul class="stationery">${COMMON.map((it) => `
      <li><a href="${dp(it.asin)}" target="_blank" rel="noopener sponsored">${esc(it.title)}</a><span class="hint-sm">（${esc(it.by)}）${esc(it.note)}</span></li>`).join('')}
    </ul>
    <p class="hint-sm">${NOTE}</p>`;
  });
})();
