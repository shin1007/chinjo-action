// 角2封筒で送るときの切手の目安。重さは紙の枚数から見積もる（A4のコピー用紙・角2のクラフト封筒・クリアファイル1枚・ラベルとのり）
window.Postage = (() => {
  // 定形外郵便（規格内：34×25×3cm 以内・1kg まで）の料金。2024年10月1日からのもの
  // 料金が変わったら、ここと guide.html の表を直す
  const RATES = [[50, 140], [100, 180], [150, 270], [250, 320], [500, 510], [1000, 750]];
  const SHEET = 4; // A4 のコピー用紙 1枚（g）
  const ENVELOPE = 18; // 角2 のクラフト封筒
  const CLEAR_FILE = 15; // A4 のクリアファイル
  const EXTRA = 3; // 宛名・差出人のラベル2枚（シール用紙でも約1gずつ）と、のり

  // sheets 枚を入れたときの重さと切手代。safe は心配な人向けに1つ上の料金（重さの上限の8割を超えたとき）
  function estimate(sheets) {
    const g = sheets * SHEET + ENVELOPE + CLEAR_FILE + EXTRA;
    const i = RATES.findIndex(([limit]) => g <= limit);
    if (i < 0) return { g, limit: 0, yen: 0, safe: 0 };
    const [limit, yen] = RATES[i];
    const next = RATES[i + 1];
    return { g, limit, yen, safe: g > limit * 0.8 && next ? next[1] : 0 };
  }
  return { RATES, SHEET, ENVELOPE, CLEAR_FILE, EXTRA, estimate };
})();
