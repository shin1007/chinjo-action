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
      window.PDFLib ? null : loadScript('/vendor/pdf-lib.min.js'),
      window.fontkit ? null : loadScript('/vendor/fontkit.umd.min.js'),
      window.qrcode ? null : loadScript('/vendor/qrcode.js'),
      loadFont('/fonts/BIZUDMincho-Regular.subset.ttf'),
      loadFont('/fonts/BIZUDMincho-Bold.subset.ttf'),
    ]).then(([, , , regular, bold]) => ({ regular, bold }))
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
    const ITEM = /^([一二三四五六七八九十]+　|\d+[．　]|[・①-⑳])/;
    // 文面の URL には、スマホで読み取れる QR コードを添える
    const URL_RE = /https?:\/\/[^\s」）、。]+/g;
    const QR = 22 * MM;
    function drawQr(page, url, x, top) {
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const n = qr.getModuleCount();
      const c = QR / n;
      for (let r = 0; r < n; r += 1) {
        for (let k = 0; k < n; k += 1) {
          if (qr.isDark(r, k)) page.drawRectangle({ x: x + k * c, y: top - (r + 1) * c, width: c, height: c, color: black });
        }
      }
    }
    const SENDER = /^(住所|氏名|電話)　/;

    // 1つの文書（改行区切りの文面）を、新しいページから書く。ページ番号は文書ごとに振る
    // 行の間を少し詰めれば1枚に収まるときは詰める。2枚以上になるときは、見出しを次の文と離さず、
    // 段落を1行だけ残して分けず、「以上」だけが次の紙に行かないように区切る
    // images：「[[図:名前]]」の行に置く絵（embedImage で埋め込んだもの）。文の幅いっぱいに置く
    function addDocument(text, images = {}) {
      const lines = text.replace(/\r/g, '').split('\n');

      // 文面を、ページをまたいでよいかの決まりを持った塊（行の並び）に分ける。k は行の間の詰め具合
      function layout(k) {
        const lh = LH * k;
        const blocks = [];
        const block = (o = {}) => { const b = { rows: [], ...o }; blocks.push(b); return b; };
        // side：右に置いた QR コードの横に、まだ残っている高さ。そのあいだの文は QR の幅だけ狭くして折り返す
        let side = 0;
        // QR コードを前の行（題名）に置いた URL の行
        const qrDone = new Set();
        const gap = (b, h) => { b.rows.push({ h }); side -= h; };
        const row = (b, h, draw) => { b.rows.push({ h, draw }); side -= h; };
        // 幅いっぱいに書くもの（見出し・題・絵）の前では、QR コードの下まで空ける
        const clear = (b) => { if (side > 0) gap(b, side); };

        lines.forEach((raw, i) => {
          const s = raw.replace(/\s+$/, '');
          if (!s) { gap(block({ spacer: true }), lh * 0.55); return; }

          // 日付：右に寄せる
          if (/^令和.+日$/.test(s) && i < 3) {
            const [l] = wrap(s, BODY, textW);
            row(block(), lh, (p, y) => drawLine(p, l, A4.w - M.right - l.w, y, BODY));
            return;
          }
          // 宛名（○○議会議長 様／○○事務局 御中）：少し大きく
          if (/(様|御中)$/.test(s) && i < 6) {
            const size = 12.5;
            const b = block();
            wrap(s, size, textW).forEach((l) => row(b, size * 1.8 * k, (p, y) => drawLine(p, l, M.left, y, size)));
            return;
          }
          // 差出人の住所・氏名：右寄りに、項目名をそろえて書く（続く欄は1つの塊にして分けない）
          const sm = s.match(SENDER);
          if (sm) {
            const last = blocks[blocks.length - 1];
            const b = last && last.sender ? last : block({ sender: true });
            const x = M.left + textW * 0.3;
            const labelW = BODY * 3.5;
            const label = sm[1];
            const value = s.slice(sm[0].length);
            // 空欄なら、手書きで書けるよう右端まで下線を引き、行の間も広げる（氏名は右端に「印」を残す）
            if (value.startsWith(BLANK)) {
              const seal = value.slice(BLANK.length).trim();
              const end = A4.w - M.right - (seal ? BODY * 2 : 0);
              gap(b, lh * 0.4);
              row(b, lh * 1.2, (p, y) => {
                p.drawText(label, { x, y, size: BODY, font: R, color: gray });
                p.drawLine({ start: { x: x + labelW, y: y - 3 }, end: { x: end, y: y - 3 }, thickness: 0.5, color: black });
                if (seal) p.drawText(safe(seal), { x: end + BODY * 0.6, y, size: BODY, font: R, color: black });
              });
              return;
            }
            wrap(value, BODY, A4.w - M.right - x - labelW).forEach((l, j) => row(b, lh, (p, y) => {
              if (!j) p.drawText(label, { x, y, size: BODY, font: R, color: gray });
              drawLine(p, l, x + labelW, y, BODY);
            }));
            return;
          }
          // 件名・鏡文の題：中央に太字で
          const title = s.match(/^件名　(.+)$/) || (/^　{4,}\S/.test(s) && !/(敬具|以上)$/.test(s) ? [s, s.trim()] : null);
          if (title) {
            const size = 13.5;
            const font = fontFor(title[1], true);
            const b = block({ keepNext: true });
            clear(b);
            gap(b, lh * 0.4);
            wrap(title[1], size, textW * 0.86, font).forEach((l) => row(b, size * 1.7 * k, (p, y) => drawLine(p, l, (A4.w - l.w) / 2, y, size, font)));
            gap(b, lh * 0.3);
            return;
          }
          // 敬具・以上：右に寄せる。前の段落の終わりと同じ紙に置く
          if (/^　*(敬具|以上)$/.test(s)) {
            const t = s.trim();
            const draw = (p, y) => p.drawText(t, { x: A4.w - M.right - width(t, BODY), y, size: BODY, font: R, color: black });
            let j = blocks.length - 1;
            while (j >= 0 && blocks[j].spacer) j -= 1;
            const prev = blocks[j];
            if (prev && prev.split) {
              const gaps = blocks.splice(j + 1).flatMap((b) => b.rows);
              prev.rows.push(...gaps, { h: lh, draw });
              prev.tail = gaps.length + 1;
            } else row(block(), lh, draw);
            return;
          }
          // 記：中央に
          if (s === '記') {
            row(block({ keepNext: true }), lh, (p, y) => p.drawText('記', { x: (A4.w - BODY) / 2, y, size: BODY, font: R, color: black }));
            return;
          }
          // 【陳情の趣旨】などの見出し：太字にして、下に細い線を引く
          const h = s.match(/^【(.+)】$/);
          if (h) {
            const size = 11.5;
            const font = fontFor(h[1], true);
            const b = block({ keepNext: true });
            clear(b);
            gap(b, lh * 0.35);
            row(b, lh * 1.1, (p, y) => {
              p.drawText(safe(h[1]), { x: M.left, y, size, font, color: black });
              p.drawLine({ start: { x: M.left, y: y - 4 }, end: { x: A4.w - M.right, y: y - 4 }, thickness: 0.4, color: gray });
            });
            return;
          }
          // 絵：文の幅に合わせて縮める
          const fig = s.match(/^\[\[図:(.+)\]\]$/);
          if (fig && images[fig[1]]) {
            const img = images[fig[1]];
            const h = (img.height * textW) / img.width;
            const b = block();
            clear(b);
            gap(b, lh * 0.3);
            row(b, h + lh * 0.3, (p, y) => p.drawImage(img, { x: M.left, y: y + BODY - h, width: textW, height: h }));
            return;
          }
          // 一　…／1．…／・… の箇条：2行目からは番号のぶん下げる
          const im = s.match(ITEM);
          const indent = im ? width(im[1], BODY) : 0;
          // URL があれば、その行の右端に QR コードを置き、続く行は QR の横に回り込ませる
          // QR コードが紙の下にはみ出さないよう、その高さが残っていなければ次の紙から書く
          // 参考資料のように、題名の次の行に URL だけがあるときは、QR コードを題名の行の右に置く（URL の行には置かない）
          const nextUrl = (lines[i + 1] || '').trim();
          const urlOnly = (t) => /^https?:\/\/\S+$/.test(t);
          const urls = qrDone.has(i) ? [] : !URL_RE.test(s) && urlOnly(nextUrl) ? [nextUrl] : s.match(URL_RE) || [];
          URL_RE.lastIndex = 0;
          if (!s.match(URL_RE) && urls.length) qrDone.add(i + 1);
          const sideW = (n) => n * (QR + BODY);
          if (urls.length) clear(blocks[blocks.length - 1] || block());
          const narrow = urls.length ? sideW(urls.length) : side > 0 ? sideW(1) : 0;
          const b = block(urls.length ? { room: QR + BODY } : { split: true });
          wrap(s.slice(im ? im[1].length : 0), BODY, textW - indent - narrow - (narrow ? BODY : 0)).forEach((l, j) => row(b, lh, (p, y) => {
            if (im && !j) p.drawText(safe(im[1]), { x: M.left, y, size: BODY, font: R, color: black });
            drawLine(p, l, M.left + indent, y, BODY);
            if (!j) urls.forEach((u, k) => drawQr(p, u, A4.w - M.right - QR - k * (QR + BODY), y + BODY * 0.8));
          }));
          if (urls.length) side = QR + BODY * 0.5 - lh * b.rows.length;
        });
        return blocks;
      }

      // 塊をページに割り付ける。返すのは、行ごとの { page：何枚目か, y, draw } と枚数
      function paginate(blocks) {
        const top = A4.h - M.top;
        const out = [];
        let pg = 0;
        let y = top;
        const newPage = () => { pg += 1; y = top; };
        const sum = (rows) => rows.reduce((a, r) => a + r.h, 0);
        const put = (r) => {
          if (y - r.h < M.bottom && y !== top) newPage();
          if (!r.draw && y === top) return; // 紙の頭の空きは捨てる
          if (r.draw) out.push({ page: pg, y, draw: r.draw });
          y -= r.h;
        };
        // 見出しのあとに同じ紙へ続けて置く高さ（次の段落の2行目まで）
        const lead = (i) => {
          let h = 0;
          for (let j = i; j < blocks.length; j += 1) {
            const b = blocks[j];
            if (!b.spacer && !b.keepNext) return h + sum(b.split ? b.rows.slice(0, 2) : b.rows);
            h += sum(b.rows);
          }
          return h;
        };
        blocks.forEach((b, i) => {
          const avail = y - M.bottom;
          const H = sum(b.rows);
          if (b.spacer) { if (H > avail) newPage(); else b.rows.forEach(put); return; }
          if (b.room && b.room > avail && y !== top) newPage();
          if (b.keepNext) { if (H + lead(i + 1) > avail && y !== top) newPage(); b.rows.forEach(put); return; }
          if (H <= avail || y === top) { b.rows.forEach(put); return; }
          if (b.split) {
            // 前に2行以上・後ろに2行以上（＋「以上」）が残るときだけ、段落の途中で分ける
            let n = 0;
            let used = 0;
            while (n < b.rows.length && used + b.rows[n].h <= avail) { used += b.rows[n].h; n += 1; }
            if (n >= 2 && b.rows.length - n >= 2 + (b.tail || 0)) {
              b.rows.slice(0, n).forEach(put);
              newPage();
              b.rows.slice(n).forEach(put);
              return;
            }
          }
          newPage();
          b.rows.forEach(put);
        });
        return { out, count: pg + 1 };
      }

      // 2枚になるとき、行の間を最大15%まで詰めて1枚に収まるなら、そうする
      let plan = paginate(layout(1));
      if (plan.count === 2) plan = [0.95, 0.9, 0.85].map((k) => paginate(layout(k))).find((p) => p.count === 1) || plan;

      const pages = Array.from({ length: plan.count }, () => pdf.addPage([A4.w, A4.h]));
      plan.out.forEach(({ page, y, draw }) => draw(pages[page], y));

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
      embedImage: (png) => pdf.embedPng(png),
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
      to: opts.to === 'chair' ? `${r.council}議長　　　　　様` : `${r.council}事務局　御中`,
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
    const { y, m, d } = window.Common.jstToday();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  return { SHEETS, labelItems, create, preload, download, shareFile, canShareFiles, today };
})();
