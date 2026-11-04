// 読み（カタカナ）で地名を探す。ひらがな・カタカナ・ローマ字（ヘボン式・訓令式のどちらでも）で入れられ、
// ローマ字は少しの打ち間違いも許す。
window.Yomi = (() => {
  const toKata = (t) => t.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

  // カタカナ → ローマ字（訓令式寄り。比べる前に normalize でそろえるので、表記の細かさは問わない）
  const ROW = {
    ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o', カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
    サ: 'sa', シ: 'si', ス: 'su', セ: 'se', ソ: 'so', タ: 'ta', チ: 'ti', ツ: 'tu', テ: 'te', ト: 'to',
    ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no', ハ: 'ha', ヒ: 'hi', フ: 'hu', ヘ: 'he', ホ: 'ho',
    マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo', ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
    ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro', ワ: 'wa', ヰ: 'i', ヱ: 'e', ヲ: 'o', ン: 'n',
    ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go', ザ: 'za', ジ: 'zi', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
    ダ: 'da', ヂ: 'zi', ヅ: 'zu', デ: 'de', ド: 'do', バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
    パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po', ヴ: 'bu', ヶ: 'ke', ヵ: 'ka',
    ァ: 'a', ィ: 'i', ゥ: 'u', ェ: 'e', ォ: 'o',
  };
  const SMALL = { ャ: 'a', ュ: 'u', ョ: 'o' };

  function kanaToRoma(kana) {
    let out = '';
    for (let i = 0; i < kana.length; i++) {
      const c = kana[i];
      if (c === 'ッ') { out += 'Q'; continue; } // 次の子音を重ねる
      if (c === 'ー') continue;
      if (SMALL[c] && out) { out = out.replace(/i$/, 'y') + SMALL[c]; continue; }
      out += ROW[c] || '';
    }
    return out.replace(/Q([a-z])/g, '$1$1').replace(/Q/g, '');
  }

  // ヘボン式と訓令式、長音や「ん」の書き方の違いをそろえる
  function normalize(r) {
    return r.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // ō → o
      .replace(/[^a-z]/g, '')
      .replace(/tch/g, 'tt')
      .replace(/shi/g, 'si').replace(/sh/g, 'sy')
      .replace(/chi/g, 'ti').replace(/ch/g, 'ty')
      .replace(/tsu/g, 'tu').replace(/fu/g, 'hu').replace(/f/g, 'h')
      .replace(/jy/g, 'zy').replace(/ji/g, 'zi').replace(/j/g, 'zy')
      .replace(/di/g, 'zi').replace(/du/g, 'zu')
      .replace(/m(?=[bmp])/g, 'n')
      .replace(/nn/g, 'n').replace(/n'/g, 'n')
      .replace(/ou|oo|oh(?![aiueo])/g, 'o').replace(/uu/g, 'u').replace(/ei/g, 'e').replace(/ii/g, 'i').replace(/aa/g, 'a')
      .replace(/wo/g, 'o');
  }

  // 文字列 text の頭の部分が、編集距離 k 以内で pattern に一致するか。
  // 名前は頭から打つことが多いので頭に限る。隣り合う2文字の入れ違い（hachioij）も1つの間違いと数える
  function fuzzyPrefix(text, pattern, k) {
    const m = pattern.length;
    let prev2 = null;
    let prev = Array.from({ length: m + 1 }, (_, i) => i);
    let best = prev[m];
    for (let j = 1; j <= text.length && j <= m + k; j++) {
      const cur = [j];
      for (let i = 1; i <= m; i++) {
        const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
        cur[i] = Math.min(prev[i - 1] + cost, prev[i] + 1, cur[i - 1] + 1);
        if (prev2 && i > 1 && pattern[i - 1] === text[j - 2] && pattern[i - 2] === text[j - 1]) cur[i] = Math.min(cur[i], prev2[i - 2] + 1);
      }
      best = Math.min(best, cur[m]);
      prev2 = prev;
      prev = cur;
    }
    return best <= k;
  }

  // 「町」は マチ／チョウ、「村」は ムラ／ソン と読みが分かれるので、どちらで打っても当たるようにする
  const cache = {};
  function romasOf(kana) {
    if (cache[kana]) return cache[kana];
    const alt = kana.replace(/マチ$/, 'チョウ').replace(/チョウ$/, (x) => (kana.endsWith('マチ') ? x : 'マチ'))
      .replace(/ムラ$/, 'ソン').replace(/ソン$/, (x) => (kana.endsWith('ムラ') ? x : 'ムラ'));
    return (cache[kana] = [...new Set([kana, alt])].map((k) => normalize(kanaToRoma(k))));
  }

  // 入力 q が、名前 name または読み kana にどれだけ当てはまるか：2＝そのまま含む、1＝打ち間違いを許せば当たる、0＝当たらない
  function matcher(q) {
    q = q.trim();
    if (!q) return () => 2;
    if (/[a-zA-Zāīūēōâîûêô]/.test(q)) {
      const rq = normalize(q);
      // 打ち間違いを許すのは、そのまま当たるものがないときだけ（filter）。短い入力は当たりすぎるので、長さに応じて許す数を変える
      const k = rq.length >= 7 ? 2 : rq.length >= 4 ? 1 : 0;
      return (name, kana) => {
        if (!kana) return 0;
        const rs = romasOf(kana);
        if (rs.some((r) => r.includes(rq))) return 2;
        return k > 0 && rs.some((r) => fuzzyPrefix(r, rq, k)) ? 1 : 0;
      };
    }
    const kq = toKata(q);
    // かなだけの入力は、ローマ字に直して比べれば、濁点・小さい字・似た音の書き間違いも打ち間違いと同じに扱える
    const isKana = /^[ァ-ヶー]+$/.test(kq);
    const rq = isKana ? normalize(kanaToRoma(kq)) : '';
    const k = !isKana ? 0 : rq.length >= 7 ? 2 : rq.length >= 4 ? 1 : 0;
    return (name, kana) => {
      if (name.includes(q) || (!!kana && kana.includes(kq))) return 2;
      return k > 0 && !!kana && romasOf(kana).some((r) => fuzzyPrefix(r, rq, k)) ? 1 : 0;
    };
  }

  // 一覧から当てはまるものを選ぶ。そのまま当たるものがあればそれだけを、なければ打ち間違いを許して当たるものを返す
  function filter(list, q, kanaOf) {
    const hit = matcher(q);
    const scored = list.map((x) => [x, hit(x, kanaOf(x))]);
    const top = Math.max(0, ...scored.map(([, s]) => s));
    return top ? scored.filter(([, s]) => s === top).map(([x]) => x) : [];
  }

  return { matcher, filter, toKata, kanaToRoma, normalize };
})();
