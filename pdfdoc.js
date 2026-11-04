// 陳情書・鏡文・宛名を、正式な文書の体裁で1つの PDF にする（A4・明朝）。
// ライブラリとフォント（数MB）は、保存のボタンを押したときに初めて読み込む。サーバーには何も送らない
window.PdfDoc = (() => {
  const MM = 72 / 25.4;
  const A4 = { w: 210 * MM, h: 297 * MM };
  const BLANK = window.Common.BLANK_TEXT;

  // ---------- 読み込み ----------
  let assets = null;
  const loadScript = (src) => new Promise((ok, ng) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => ng(new Error(`${src} を読み込めませんでした`));
    document.head.appendChild(s);
  });
  const loadFont = (url) => fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url} を読み込めませんでした`);
    return r.arrayBuffer();
  });
  function load() {
    assets = assets || Promise.all([
      window.PDFLib ? null : loadScript('vendor/pdf-lib.min.js'),
      window.fontkit ? null : loadScript('vendor/fontkit.umd.min.js'),
      loadFont('fonts/BIZUDMincho-Regular.subset.ttf'),
      loadFont('fonts/BIZUDMincho-Bold.subset.ttf'),
    ]).then(([, , regular, bold]) => ({ regular, bold }))
      .catch((e) => { assets = null; throw e; });
    return assets;
  }
  // ボタンが見えたら先に読み込みを始めておくと、押してからが速い
  const preload = () => load().catch(() => {});

  // ---------- 文書を書く道具 ----------
  async function create() {
    const { regular, bold } = await load();
    const { PDFDocument, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(window.fontkit);
    // フォントはあらかじめ字を絞ってあるので、そのまま埋め込む（pdf-lib で絞り直すと、字が消えることがある）
    const R = await pdf.embedFont(regular, { subset: false });
    const B = await pdf.embedFont(bold, { subset: false });
    const hasR = new Set(R.getCharacterSet());
    const hasB = new Set(B.getCharacterSet());
    const black = rgb(0, 0, 0);
    const gray = rgb(0.45, 0.45, 0.45);
    const red = rgb(0.75, 0.05, 0.05);

    // フォントにない字（外字など）は「〓」にする。見出し用にない字があれば、その行は本文用で書く
    const safe = (t) => [...t].map((c) => (hasR.has(c.codePointAt(0)) ? c : '〓')).join('');
    const fontFor = (t, wantBold) => (wantBold && [...t].every((c) => hasB.has(c.codePointAt(0))) ? B : R);
    const width = (t, size, font = R) => font.widthOfTextAtSize(t, size);

    // 行頭に来てはいけない字（句読点・閉じかっこ・小さいかな）は、前の行の末尾にぶら下げる
    const NO_START = new Set([...'、。，．）」』】〕〉》・ー々ゝゞぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ！？：；']);

    // 文字列を幅に収まるよう折り返す。下線の空欄（BLANK）は1つの塊として扱う
    function wrap(text, size, maxW, font = R) {
      const tokens = text.split(BLANK).flatMap((part, i) => (i ? [BLANK, ...part] : [...part]));
      const tokW = (t) => (t === BLANK ? size * 7 : width(t, size, font));
      const lines = [];
      let cur = [];
      let w = 0;
      tokens.forEach((t) => {
        const tw = tokW(t);
        if (w + tw > maxW && cur.length && !NO_START.has(t)) {
          lines.push(cur);
          cur = [];
          w = 0;
        }
        cur.push(t);
        w += tw;
      });
      if (cur.length || !lines.length) lines.push(cur);
      return lines.map((l) => ({ tokens: l, w: l.reduce((a, t) => a + tokW(t), 0) }));
    }

    // 1行を書く（空欄は下線にする）
    function drawLine(page, line, x, y, size, font = R, color = black) {
      let cx = x;
      let run = '';
      const flush = () => {
        if (!run) return;
        page.drawText(safe(run), { x: cx, y, size, font, color });
        cx += width(safe(run), size, font);
        run = '';
      };
      line.tokens.forEach((t) => {
        if (t !== BLANK) { run += t; return; }
        flush();
        page.drawLine({ start: { x: cx + size * 0.3, y: y - size * 0.2 }, end: { x: cx + size * 6.7, y: y - size * 0.2 }, thickness: 0.5, color });
        cx += size * 7;
      });
      flush();
    }

    // ---------- 陳情書・鏡文 ----------
    const M = { top: 25 * MM, bottom: 22 * MM, left: 25 * MM, right: 22 * MM };
    const BODY = 10.5;
    const LH = BODY * 1.85;
    const textW = A4.w - M.left - M.right;
    const ITEM = /^([一二三四五六七八九十]+　|\d+．)/;
    const SENDER = /^(住所|氏名|電話)　/;

    // 1つの文書（改行区切りの文面）を、新しいページから書く。ページ番号は文書ごとに振る
    function addDocument(text) {
      const pages = [];
      let page;
      let y;
      const newPage = () => {
        page = pdf.addPage([A4.w, A4.h]);
        pages.push(page);
        y = A4.h - M.top;
      };
      const need = (h) => { if (y - h < M.bottom) newPage(); };
      newPage();

      const lines = text.replace(/\r/g, '').split('\n');
      lines.forEach((raw, i) => {
        const s = raw.replace(/\s+$/, '');
        if (!s) { y -= LH * 0.55; return; }

        // 日付：右に寄せる
        if (/^令和.+日$/.test(s) && i < 3) {
          need(LH);
          const [l] = wrap(s, BODY, textW);
          drawLine(page, l, A4.w - M.right - l.w, y, BODY);
          y -= LH;
          return;
        }
        // 宛名（○○議会議長 様／○○事務局 御中）：少し大きく
        if (/(様|御中)$/.test(s) && i < 6) {
          const size = 12.5;
          need(LH * 1.3);
          wrap(s, size, textW).forEach((l) => { drawLine(page, l, M.left, y, size); y -= size * 1.8; });
          return;
        }
        // 差出人の住所・氏名：右寄りに、項目名をそろえて書く
        const sm = s.match(SENDER);
        if (sm) {
          const x = M.left + textW * 0.3;
          const labelW = BODY * 3.5;
          const label = sm[1];
          const value = s.slice(sm[0].length);
          // 空欄なら、手書きで書けるよう右端まで下線を引き、行の間も広げる（氏名は右端に「印」を残す）
          if (value.startsWith(BLANK)) {
            const seal = value.slice(BLANK.length).trim();
            const end = A4.w - M.right - (seal ? BODY * 2 : 0);
            y -= LH * 0.4;
            need(LH);
            page.drawText(label, { x, y, size: BODY, font: R, color: gray });
            page.drawLine({ start: { x: x + labelW, y: y - 3 }, end: { x: end, y: y - 3 }, thickness: 0.5, color: black });
            if (seal) page.drawText(safe(seal), { x: end + BODY * 0.6, y, size: BODY, font: R, color: black });
            y -= LH * 1.2;
            return;
          }
          wrap(value, BODY, A4.w - M.right - x - labelW).forEach((l, j) => {
            need(LH);
            if (!j) page.drawText(label, { x, y, size: BODY, font: R, color: gray });
            drawLine(page, l, x + labelW, y, BODY);
            y -= LH;
          });
          return;
        }
        // 件名・鏡文の題：中央に太字で
        const title = s.match(/^件名　(.+)$/) || (/^　{4,}\S/.test(s) && !/(敬具|以上)$/.test(s) ? [s, s.trim()] : null);
        if (title) {
          const size = 13.5;
          const font = fontFor(title[1], true);
          const ls = wrap(title[1], size, textW * 0.86, font);
          y -= LH * 0.4;
          need(ls.length * size * 1.7);
          ls.forEach((l) => { drawLine(page, l, (A4.w - l.w) / 2, y, size, font); y -= size * 1.7; });
          y -= LH * 0.3;
          return;
        }
        // 敬具・以上：右に寄せる
        if (/^　*(敬具|以上)$/.test(s)) {
          need(LH);
          const t = s.trim();
          page.drawText(t, { x: A4.w - M.right - width(t, BODY), y, size: BODY, font: R, color: black });
          y -= LH;
          return;
        }
        // 記：中央に
        if (s === '記') {
          need(LH);
          page.drawText('記', { x: (A4.w - BODY) / 2, y, size: BODY, font: R, color: black });
          y -= LH;
          return;
        }
        // 【陳情の趣旨】などの見出し：太字にして、下に細い線を引く
        const h = s.match(/^【(.+)】$/);
        if (h) {
          const size = 11.5;
          const font = fontFor(h[1], true);
          need(LH * 2.2);
          y -= LH * 0.35;
          page.drawText(safe(h[1]), { x: M.left, y, size, font, color: black });
          page.drawLine({ start: { x: M.left, y: y - 4 }, end: { x: A4.w - M.right, y: y - 4 }, thickness: 0.4, color: gray });
          y -= LH * 1.1;
          return;
        }
        // 一　…／1．… の箇条：2行目からは番号のぶん下げる
        const im = s.match(ITEM);
        const indent = im ? width(im[1], BODY) : 0;
        const ls = wrap(s.slice(im ? im[1].length : 0), BODY, textW - indent);
        ls.forEach((l, j) => {
          need(LH);
          if (im && !j) page.drawText(safe(im[1]), { x: M.left, y, size: BODY, font: R, color: black });
          drawLine(page, l, M.left + indent, y, BODY);
          y -= LH;
        });
      });

      // ページが2枚以上になった文書には「1 / 2」と入れる（書いたページ数を返す）
      if (pages.length > 1) {
        pages.forEach((p, i) => {
          const t = `${i + 1} / ${pages.length}`;
          p.drawText(t, { x: (A4.w - width(t, 9)) / 2, y: 12 * MM, size: 9, font: R, color: gray });
        });
      }
      return pages.length;
    }

    // ---------- 宛名ラベル ----------
    // sheet：{ cols, rows, w, h, top, left, cut }（mm）、items：{ zip, address, to, zaichu, from, back }
    function addLabels(sheet, items, skip = 0) {
      const per = sheet.cols * sheet.rows;
      const cells = [...Array(skip % per).fill(null), ...items];
      for (let i = 0; i < cells.length; i += per) {
        const page = pdf.addPage([A4.w, A4.h]);
        cells.slice(i, i + per).forEach((it, j) => {
          const x = (sheet.left + (j % sheet.cols) * sheet.w) * MM;
          const top = A4.h - (sheet.top + Math.floor(j / sheet.cols) * sheet.h) * MM;
          const w = sheet.w * MM;
          const h = sheet.h * MM;
          if (sheet.cut) {
            page.drawRectangle({ x, y: top - h, width: w, height: h, borderColor: gray, borderWidth: 0.4, borderDashArray: [3, 3] });
          }
          if (it) drawLabel(page, it, x, top, w, h);
        });
      }
    }
    function drawLabel(page, it, x0, top, w, h) {
      const k = h / (74.25 * MM);
      const pad = 6 * MM * Math.min(1, k + 0.2);
      const x = x0 + pad;
      const innerW = w - pad * 2;
      let y = top - pad - 10 * k;
      if (it.zip) { page.drawText(safe(`〒${it.zip}`), { x, y, size: 10.5 * k, font: R, color: black }); y -= 15 * k; }
      const addrSize = 11.5 * k;
      (it.address ? wrap(it.address, addrSize, innerW) : [{ tokens: [BLANK], w: 0 }]).slice(0, 3).forEach((l) => {
        drawLine(page, l, x, y, addrSize);
        y -= addrSize * 1.45;
      });
      // 宛名：残りの高さの真ん中あたりに、太字で大きく
      const bottomY = top - h + pad;
      const fromH = it.from ? 12 * k : 0;
      const toSize = Math.min(16 * k, (innerW / Math.max(8, it.to.length)) * 0.98);
      const toFont = fontFor(it.to, !it.back);
      const toW = width(safe(it.to), toSize, toFont);
      const toY = (y + bottomY + fromH + (it.zaichu ? 14 * k : 0)) / 2;
      page.drawText(safe(it.to), { x: it.back ? x : x0 + (w - toW) / 2, y: toY, size: toSize, font: toFont, color: black });
      if (it.zaichu) {
        const zs = 10 * k;
        const zw = width('陳情書在中', zs) + 6 * k;
        const zy = bottomY + fromH + 3 * k;
        page.drawRectangle({ x: x0 + w - pad - zw, y: zy - 3 * k, width: zw, height: zs + 6 * k, borderColor: red, borderWidth: 0.8 });
        page.drawText('陳情書在中', { x: x0 + w - pad - zw + 3 * k, y: zy, size: zs, font: R, color: red });
      }
      if (it.from) {
        const fs = 6.5 * k;
        const [l] = wrap(it.from, fs, innerW);
        page.drawLine({ start: { x, y: bottomY + fs * 1.6 }, end: { x: x + innerW, y: bottomY + fs * 1.6 }, thickness: 0.3, color: gray });
        drawLine(page, l, x, bottomY, fs, R, gray);
      }
    }

    return {
      addDocument,
      addLabels,
      bytes: () => pdf.save(),
    };
  }

  // ---------- 宛名ラベルの用紙と中身 ----------
  // よく売られている A4 のラベル用紙。寸法は mm（top・left は用紙の端から最初の面まで）
  // 角2封筒（240×332mm・A4を折らずに入れる）にはどれでも貼れる。長4封筒（90×205mm）は幅 90mm 未満のものだけ
  const SHEETS = {
    a4_8: { label: 'A4 8面（105×74.2mm・余白なし）', cols: 2, rows: 4, w: 105, h: 74.25, top: 0, left: 0, envs: ['kaku2'] },
    a4_10: { label: 'A4 10面（86.4×50.8mm）', cols: 2, rows: 5, w: 86.4, h: 50.8, top: 21.5, left: 18.6, envs: ['kaku2', 'naga4'] },
    a4_12: { label: 'A4 12面（86.4×42.3mm）', cols: 2, rows: 6, w: 86.4, h: 42.3, top: 21.5, left: 18.6, envs: ['kaku2', 'naga4'] },
    plain: { label: '普通紙（切って貼る・1枚に8枚）', cols: 2, rows: 4, w: 105, h: 74.25, top: 0, left: 0, cut: true, envs: ['kaku2'] },
    plain_n: { label: '普通紙（切って貼る・1枚に10枚）', cols: 2, rows: 5, w: 80, h: 55, top: 11, left: 25, cut: true, envs: ['naga4'] },
  };

  // 宛先（{ council：議会名, zip, address }）と差出人（Common.sender の形）から、ラベルの中身を作る
  // opts：{ to：'office'|'chair', zaichu, from：宛名の下に差出人を入れるか, back：裏に貼る差出人のラベルも作るか }
  function labelItems(rows, s, opts) {
    const from = [s.zip && `〒${s.zip}`, s.address, s.name].filter(Boolean).join('　');
    const items = rows.map((r) => ({
      zip: r.zip,
      address: r.address,
      to: opts.to === 'chair' ? `${r.council}議長　様` : `${r.council}事務局　御中`,
      zaichu: opts.zaichu,
      from: opts.from && from ? `差出人：${from}` : '',
    }));
    if (opts.back) items.push(...rows.map(() => ({ zip: s.zip, address: s.address, to: s.name || '', back: true, from: s.tel ? `電話　${s.tel}` : '' })));
    return items;
  }

  // ---------- 保存 ----------
  // ボタン1つで端末に保存する。スマホで「共有」が使えるときは、ネットプリントなどのアプリにも直接送れる
  function download(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  function shareFile(bytes, filename) {
    const file = new File([bytes], filename, { type: 'application/pdf' });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return null;
    return navigator.share({ files: [file], title: filename }).catch(() => {});
  }
  const canShareFiles = () => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.pdf', { type: 'application/pdf' })] })); } catch { return false; }
  };

  // 今日の日付をファイル名に入れる（例：2026-11-05）
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return { SHEETS, labelItems, create, preload, download, shareFile, canShareFiles, today };
})();
