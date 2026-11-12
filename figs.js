// 陳情書・要望書に添える「参考図表」（別紙）のグラフ。項目（asks-*.js）の figs から横棒グラフの PNG を描き、PDF（pdfdoc.js）に埋め込む。
// figs の形：{ t：題名, unit：単位, rows：[[ラベル, 値, 'alt'（2つ目の系列）|'hl'（強調）]], src：出典, dec：小数の桁 }
// 値に負の数があるときは、0 を真ん中にした左右のグラフにする。白黒で印刷しても見分けられる濃さにしている
window.Figs = (() => {
  const W = 1600;
  const ROW = 64;
  const PAD = 24;
  const FONT = '"Yu Gothic", "YuGothic", "Hiragino Sans", "Noto Sans JP", "Meiryo", sans-serif';
  const COLOR = { '': '#2b4a6f', alt: '#a9bcd2', hl: '#b3261e' };

  const fmt = (v, dec, signed) => {
    const s = Math.abs(v).toLocaleString('ja-JP', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return `${v < 0 ? '−' : signed && v > 0 ? '+' : ''}${s}`;
  };

  // 選んだ項目（id の配列）の図を、重なりを除いて並べる
  function of(keys) {
    const seen = new Set();
    return keys.flatMap((k) => (window.Petition.ITEMS[k] || {}).figs || []).filter((f) => !seen.has(f.t) && seen.add(f.t));
  }

  function png(fig) {
    const rows = fig.rows;
    const dec = fig.dec ?? 0;
    const signed = rows.some((r) => r[1] < 0);
    const max = Math.max(...rows.map((r) => Math.abs(r[1]))) || 1;
    const H = PAD * 2 + rows.length * ROW;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.font = `30px ${FONT}`;
    g.textBaseline = 'middle';
    const labelW = Math.min(520, Math.max(...rows.map((r) => g.measureText(r[0]).width)) + 24);
    const valueW = Math.max(...rows.map((r) => g.measureText(`${fmt(r[1], dec, signed)}${fig.unit || ''}`).width)) + 24;
    const x0 = PAD + labelW;
    const bw = W - PAD - valueW - x0;
    const zero = signed ? x0 + bw / 2 : x0;
    const scale = (signed ? bw / 2 : bw) / max;
    rows.forEach(([label, v, cls = ''], i) => {
      const y = PAD + i * ROW;
      const mid = y + ROW / 2;
      g.fillStyle = '#222';
      g.textAlign = 'left';
      g.fillText(label, PAD, mid);
      g.fillStyle = '#eee';
      g.fillRect(x0, y + 12, bw, ROW - 24);
      g.fillStyle = COLOR[cls] || COLOR[''];
      const w = Math.abs(v) * scale;
      g.fillRect(v < 0 ? zero - w : zero, y + 12, Math.max(w, 2), ROW - 24);
      g.fillStyle = '#222';
      g.fillText(`${fmt(v, dec, signed)}${fig.unit || ''}`, x0 + bw + 16, mid);
    });
    if (signed) {
      g.strokeStyle = '#222';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(zero, PAD);
      g.lineTo(zero, H - PAD);
      g.stroke();
    }
    return new Promise((ok, ng) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a))) : ng(new Error('図を作れませんでした'))), 'image/png'));
  }

  // 別紙の文面。「[[図:fN]]」の行に PDF が絵を置く
  const sheet = (figs) => ['【別紙　参考図表】', '', ...figs.flatMap((f, i) => [`図${i + 1}　${f.t}`, `[[図:f${i}]]`, `出典：${f.src}`, ''])].join('\n');

  // PDF（PdfDoc.create() で作ったもの）に、選んだ項目の図の別紙を足す
  async function addTo(doc, keys) {
    const figs = of(keys);
    if (!figs.length) return;
    const images = {};
    for (let i = 0; i < figs.length; i += 1) images[`f${i}`] = await doc.embedImage(await png(figs[i]));
    doc.addDocument(sheet(figs), images);
  }

  return { of, png, sheet, addTo };
})();
