// 郵送するときの送り方の図（中身・封筒の表・封筒の裏）。陳情の出し方のページと、PDFで保存するボタンの近くで同じ図を使う
// <div data-send-figs></div> の中に入れる。id が重ならないよう、置く場所ごとに番号をつける
document.querySelectorAll('[data-send-figs]').forEach((box, n) => {
  box.className = 'send-figs';
  box.innerHTML = `
    <figure>
      <svg viewBox="0 0 200 250" role="img" aria-labelledby="fig${n}InTitle">
        <title id="fig${n}InTitle">中身の重ね方：陳情書は1件ごとに左上を留め、鏡文は留めずに上に置き、全部をクリアファイルに入れる</title>
        <rect x="22" y="22" width="118" height="160" rx="3" fill="#fff" stroke="#999"/>
        <path d="M27 31 l9 -5" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>
        <text x="92" y="32" font-size="8.5" text-anchor="middle" fill="#666">陳情書2（これだけで留める）</text>
        <rect x="32" y="36" width="118" height="160" rx="3" fill="#fff" stroke="#999"/>
        <path d="M37 45 l9 -5" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>
        <text x="102" y="46" font-size="8.5" text-anchor="middle" fill="#666">陳情書1（これだけで留める）</text>
        <rect x="42" y="50" width="118" height="160" rx="3" fill="#fff" stroke="#555"/>
        <text x="101" y="72" font-size="10" text-anchor="middle" font-weight="bold">陳情書の送付について</text>
        <g stroke="#bbb"><line x1="54" y1="88" x2="148" y2="88"/><line x1="54" y1="98" x2="148" y2="98"/><line x1="54" y1="108" x2="132" y2="108"/><line x1="54" y1="126" x2="148" y2="126"/><line x1="54" y1="136" x2="122" y2="136"/></g>
        <text x="101" y="170" font-size="9" text-anchor="middle" fill="#666">鏡文（留めずに上に置く）</text>
        <rect x="12" y="12" width="158" height="208" rx="4" fill="#e8743b" fill-opacity="0.08" stroke="#e8743b" stroke-dasharray="4 3"/>
        <text x="91" y="236" font-size="8.5" text-anchor="middle" fill="#c95a24">クリアファイル（全部をまとめて入れる）</text>
      </svg>
      <figcaption><b>① 中身</b><br>ホチキスは<b>陳情書1件ごとに、その陳情書のページだけ</b>を左上で1か所留めます。<b>全部をまとめて留めない</b>でください（件名ごとに別の委員会へ回ることがあります）。鏡文は留めずにいちばん上に置き、全部をクリアファイルに入れます。</figcaption>
    </figure>
    <figure>
      <svg viewBox="0 0 200 250" role="img" aria-labelledby="fig${n}FrontTitle">
        <title id="fig${n}FrontTitle">封筒の表：左上に180円分の切手、真ん中に宛名のラベル、左下に赤い陳情書在中</title>
        <rect x="35" y="10" width="130" height="230" rx="3" fill="#f3e3c3" stroke="#b8a27a"/>
        <rect x="44" y="20" width="26" height="32" fill="#fff" stroke="#c00" stroke-dasharray="3 2"/>
        <text x="57" y="34" font-size="8" text-anchor="middle" fill="#c00">切手</text>
        <text x="57" y="46" font-size="9" text-anchor="middle" fill="#c00" font-weight="bold">180円</text>
        <rect x="48" y="80" width="104" height="74" fill="#fff" stroke="#555"/>
        <text x="56" y="96" font-size="8">〒000-0000</text>
        <text x="56" y="108" font-size="8">○○県○○市△△1-2-3</text>
        <text x="100" y="128" font-size="8.5" text-anchor="middle" font-weight="bold">○○市議会事務局 御中</text>
        <text x="100" y="168" font-size="8" text-anchor="middle" fill="#666">↑ 宛名のラベル</text>
        <rect x="44" y="196" width="50" height="16" fill="none" stroke="#c00"/>
        <text x="69" y="208" font-size="9" text-anchor="middle" fill="#c00">陳情書在中</text>
      </svg>
      <figcaption><b>② 封筒の表（角2・縦長）</b><br>切手は<b>左上に180円分</b>（紙16枚・陳情書6件ほどまでなら、これで足ります。それより多いときは<a href="/guide#stamp">切手の表</a>を見てください）。宛名のラベルは真ん中に。ラベルに「陳情書在中」が入っていなければ、左下に赤で書きます。</figcaption>
    </figure>
    <figure>
      <svg viewBox="0 0 200 250" role="img" aria-labelledby="fig${n}BackTitle">
        <title id="fig${n}BackTitle">封筒の裏：のりでしっかり封をし、下の方に差出人のラベルを貼る</title>
        <rect x="35" y="10" width="130" height="230" rx="3" fill="#f3e3c3" stroke="#b8a27a"/>
        <path d="M35 10 L100 52 L165 10" fill="#ead6ae" stroke="#b8a27a"/>
        <text x="100" y="72" font-size="9" text-anchor="middle" fill="#666">のりで封をする</text>
        <text x="100" y="40" font-size="12" text-anchor="middle" fill="#555">〆</text>
        <rect x="48" y="160" width="104" height="60" fill="#fff" stroke="#555"/>
        <text x="56" y="176" font-size="8">〒000-0000</text>
        <text x="56" y="188" font-size="8">○○県○○市□□4-5-6</text>
        <text x="56" y="206" font-size="10" font-weight="bold">あなたの氏名</text>
        <text x="100" y="152" font-size="8" text-anchor="middle" fill="#666">↓ 差出人のラベル</text>
      </svg>
      <figcaption><b>③ 封筒の裏</b><br>のりで封をし、「〆」を書きます。差出人のラベルは下の方に。届かなかったときに戻ってきます。</figcaption>
    </figure>
`;
});
