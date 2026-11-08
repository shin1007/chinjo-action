// トップページとテーマページで共通する「陳情以外の手段」。
(() => {
  const root = document.querySelector('[data-common-actions]');
  if (!root) return;

  root.outerHTML = `
<section id="actions" class="section alt">
  <div class="wrap">
    <div class="section-title-row">
      <h2>陳情以外の手段</h2>
      <a href="/about" class="btn btn-small">手段による効果の違い</a>
    </div>
    <div class="cards">
      <article class="card">
        <h3>議員への手紙を書く</h3>
        <p>陳情書には書きにくい個人的な事情を、公開されない手紙で議員に伝えます。</p>
        <a class="btn" href="/letter">議員への手紙をつくる</a>
      </article>
      <article class="card">
        <h3>自治体に要望書を出す</h3>
        <p>知事・市区町村長や担当課に、行政の施策について検討や対応状況の説明を求めます。</p>
        <a class="btn" href="/kodomo/guide#youbou">要望書の書き方を見る</a>
      </article>
      <article class="card">
        <h3>情報公開請求をする</h3>
        <p>予算・実施件数など、行政が持っている文書を確認する手続と注意点を確認します。</p>
        <a class="btn" href="/kodomo/guide#kaiji">開示請求の説明を見る</a>
      </article>
      <article class="card">
        <h3>パブリックコメントを出す</h3>
        <p>国や自治体の制度案に、募集期間内に意見を提出します。</p>
        <a class="btn" href="https://public-comment.e-gov.go.jp/" target="_blank" rel="noopener">募集中の案件を見る</a>
      </article>
      <article class="card card-featured">
        <h3>困ったときの相談・救済窓口</h3>
        <p>人権侵害、DV、虐待、行政の対応などで困っているときは、陳情の前に専門窓口へ相談できます。</p>
        <ul>
          <li><a href="https://www.moj.go.jp/JINKEN/jinken20.html" target="_blank" rel="noopener">法務省・みんなの人権110番</a></li>
          <li><a href="https://www.gender.go.jp/policy/no_violence/dv_navi/" target="_blank" rel="noopener">DV相談ナビ</a>（#8008）</li>
          <li><a href="https://www.cfa.go.jp/" target="_blank" rel="noopener">こども家庭庁</a> 児童相談所全国共通ダイヤル（189）</li>
          <li><a href="https://www.soumu.go.jp/main_sosiki/hyouka/" target="_blank" rel="noopener">総務省・行政苦情110番</a></li>
        </ul>
      </article>
    </div>
    <p class="hint-sm center">要望書・開示請求は自治体ごとに書式や窓口が違います。提出前に必ず公式サイトで確認してください。</p>
  </div>
</section>`;
})();
