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
        <h3>国に規制の見直しを提案する</h3>
        <p>国の法律・省令などの規制や制度の見直しを、内閣府のフォームから個人でも直接提案できます。所管の省庁が検討し、回答が内閣府のサイトで公開されます。</p>
        <a class="btn" href="https://form.cao.go.jp/kokumin_koe/opinion-0016.html" target="_blank" rel="noopener">規制改革・行政改革ホットライン</a>
      </article>
      <article class="card">
        <h3>パブリックコメントを出す</h3>
        <p>国や自治体の制度案に、募集期間内に意見を提出します。</p>
        <a class="btn" href="https://public-comment.e-gov.go.jp/" target="_blank" rel="noopener">募集中の案件を見る</a>
      </article>
      <article class="card">
        <h3>情報公開請求をする</h3>
        <p>予算・実施件数など、行政が持っている文書を確認する手続と注意点を確認します。</p>
        <a class="btn" href="/kodomo/guide#kaiji">開示請求の説明を見る</a>
      </article>
      <article class="card card-featured">
        <h3>困ったときの相談・救済窓口</h3>
        <p>人権侵害やDV、虐待、報道被害、行政の対応などで今困っているときは、陳情の前に専門の窓口へ相談できます。受付時間は各窓口のページで確かめてください。</p>
        <ul>
          <li><b><a href="https://www.moj.go.jp/JINKEN/jinken20.html" target="_blank" rel="noopener">みんなの人権110番</a>（法務省）</b> <a href="tel:0570003110">0570-003-110</a>：差別・虐待・ハラスメントなど、さまざまな人権問題。最寄りの法務局につながります。女性の人権の相談は、ここで1番を選びます（前の「女性の人権ホットライン」は統合されました）。ネットからは<a href="https://www.moj.go.jp/JINKEN/jinken113.html" target="_blank" rel="noopener">インターネット人権相談</a>も使えます。</li>
          <li><b><a href="https://www.moj.go.jp/JINKEN/jinken112.html" target="_blank" rel="noopener">こどもの人権110番</a>（法務省）</b> <a href="tel:0120007110">0120-007-110</a>（無料）：いじめ・家庭で嫌なことをされるなど、子どもの悩み。子ども本人のほか、子どものことで悩む大人も相談できます。</li>
          <li><b>児童相談所 虐待対応ダイヤル</b> <a href="tel:189">189</a>：子どもへの虐待の通告・相談。近くの児童相談所につながります（<a href="https://www.cfa.go.jp/" target="_blank" rel="noopener">こども家庭庁</a>）。</li>
          <li><b><a href="https://www.toben.or.jp/bengoshi/center/tel/children.html" target="_blank" rel="noopener">子どもの人権110番</a>（東京弁護士会）</b> <a href="tel:0335030110">03-3503-0110</a>：いじめ・不登校・体罰・虐待など、子どもの人権に関わることすべて。弁護士が無料で相談に乗ります。</li>
          <li><b><a href="https://www.gender.go.jp/policy/no_violence/dv_navi/" target="_blank" rel="noopener">DV相談ナビ</a></b> <a href="tel:%238008">#8008</a>：配偶者からの暴力。お近くの配偶者暴力相談支援センターにつながります。24時間の電話やチャットは同じページの「DV相談＋」から。</li>
          <li><b><a href="https://www.soumu.go.jp/main_sosiki/hyouka/soudan_n/" target="_blank" rel="noopener">行政相談</a>（総務省）</b> <a href="tel:0570090110">0570-090110</a>：国の行政への苦情・意見・要望。規制の見直しの提案は、上の内閣府のホットラインへ。</li>
          <li><b><a href="https://www.sotsui.go.jp/claim/index.html" target="_blank" rel="noopener">裁判官の罷免の訴追請求</a>（裁判官訴追委員会・国会）</b>：裁判官に、職務上の義務への著しい違反や、裁判官の威信を著しく失わせる非行があったとき、日本国民ならだれでも、罷免の訴追を求められます。書面を郵送し、手数料はいりません。判決が間違っている・主張を採用してくれないといった不満は、原則として対象にならず、控訴などの裁判の手続で争います。</li>
          <li><b><a href="https://www.nichibenren.or.jp/activity/human.html" target="_blank" rel="noopener">人権救済申立て</a>（日本弁護士連合会・各地の弁護士会）</b>：人権侵害を受けた人からの申立てを受けて調査します。子ども・高齢者・障がい者・外国人・女性・性的少数者などの人権問題。</li>
          <li><b><a href="https://www.bpo.gr.jp/?page_id=1126" target="_blank" rel="noopener">放送人権委員会</a>（BPO）</b>：あなたや家族が、個別の番組で名誉やプライバシーなどの人権を侵害されたときの申立て。</li>
          <li><b><a href="https://www.houterasu.or.jp/" target="_blank" rel="noopener">法テラス</a></b> <a href="tel:0570078374">0570-078374</a>：法的なトラブル全般で、どこに相談すればよいかの案内。犯罪被害者支援ダイヤル <a href="tel:0120079714">0120-079714</a> もあります。</li>
        </ul>
      </article>
    </div>
    <p class="hint-sm center">要望書・開示請求は自治体ごとに書式や窓口が違います。提出前に必ず公式サイトで確認してください。</p>
  </div>
</section>`;
})();
