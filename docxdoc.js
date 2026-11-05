// 陳情書・鏡文を、Word で直せる .docx にする（A4・明朝）。文書ごとに新しいページから始める
// .docx は XML を ZIP にまとめたものなので、ライブラリを使わずにここで組み立てる（圧縮はしない）。サーバーには何も送らない
window.DocxDoc = (() => {
  const BLANK = window.Common.BLANK_TEXT;
  const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- 本文の XML ----------
  // 1行ぶんの文字。空欄（BLANK）は、手書きで書けるよう下線つきの空白にする
  const runs = (t, { bold = false, size = 21 } = {}) => t.split(BLANK).flatMap((part, i) => [
    ...(i ? [`<w:r><w:rPr><w:sz w:val="${size}"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">　　　　　　</w:t></w:r>`] : []),
    ...(part ? [`<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(part)}</w:t></w:r>`] : []),
  ]).join('');
  const para = (t, { align, bold, size, indent, pageBreak, border } = {}) => `<w:p><w:pPr>${pageBreak ? '<w:pageBreakBefore/>' : ''}`
    + `${border ? '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="777777"/></w:pBdr>' : ''}`
    + `${indent ? `<w:ind w:left="${indent}" w:hanging="${indent}"/>` : ''}${align ? `<w:jc w:val="${align}"/>` : ''}</w:pPr>${runs(t, { bold, size })}</w:p>`;

  // 文面の1行を、PDF（pdfdoc.js）と同じ見た目の決まりで段落にする
  const ITEM = /^([一二三四五六七八九十]+　|\d+．)/;
  function line(raw, i, first) {
    const s = raw.replace(/\s+$/, '');
    const o = { pageBreak: first };
    if (/^令和.+日$/.test(s.trim()) && i < 3) return para(s.trim(), { ...o, align: 'right' });
    if (/(様|御中)$/.test(s) && i < 6) return para(s, { ...o, size: 25 });
    const title = s.match(/^件名　(.+)$/) || (/^　{4,}\S/.test(s) && !/(敬具|以上)$/.test(s) ? [s, s.trim()] : null);
    if (title) return para(title[1], { ...o, align: 'center', bold: true, size: 27 });
    if (/^　*(敬具|以上)$/.test(s)) return para(s.trim(), { ...o, align: 'right' });
    if (s === '記') return para(s, { ...o, align: 'center' });
    const h = s.match(/^【(.+)】$/);
    if (h) return para(h[1], { ...o, bold: true, size: 23, border: true });
    const im = s.match(ITEM);
    return para(s, { ...o, indent: im ? 210 * im[1].length : 0 });
  }

  function documentXml(texts) {
    const body = texts.map((t, d) => t.replace(/\r/g, '').split('\n').map((l, i) => line(l, i, i === 0 && d > 0)).join('')).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
      + `${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1247" w:bottom="1247" w:left="1417" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`
      + '</w:body></w:document>';
  }

  // 明朝・10.5ポイント・行の間を少し広めに
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults>'
    + '<w:rPrDefault><w:rPr><w:rFonts w:ascii="游明朝" w:eastAsia="游明朝" w:hAnsi="游明朝" w:cs="游明朝"/><w:sz w:val="21"/><w:lang w:val="en-US" w:eastAsia="ja-JP"/></w:rPr></w:rPrDefault>'
    + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="400" w:lineRule="auto"/></w:pPr></w:pPrDefault>'
    + '</w:docDefaults></w:styles>';
  const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '</Types>';
  const RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';
  const DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';

  // ---------- ZIP（圧縮なし） ----------
  const CRC = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (b) => { let c = 0xffffffff; b.forEach((x) => { c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); }); return (c ^ 0xffffffff) >>> 0; };

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach(({ name, data }) => {
      const n = enc.encode(name);
      const d = enc.encode(data);
      const crc = crc32(d);
      // 名前を UTF-8 と示す（0x0800）。日付は 1980-01-01
      const head = (sig, extra) => {
        const h = new DataView(new ArrayBuffer(extra));
        h.setUint32(0, sig, true);
        return h;
      };
      const local = head(0x04034b50, 30);
      [[4, 20], [6, 0x0800], [8, 0], [10, 0], [12, 0x21]].forEach(([p, v]) => local.setUint16(p, v, true));
      local.setUint32(14, crc, true);
      local.setUint32(18, d.length, true);
      local.setUint32(22, d.length, true);
      local.setUint16(26, n.length, true);
      const cen = head(0x02014b50, 46);
      [[4, 20], [6, 20], [8, 0x0800], [10, 0], [12, 0], [14, 0x21]].forEach(([p, v]) => cen.setUint16(p, v, true));
      cen.setUint32(16, crc, true);
      cen.setUint32(20, d.length, true);
      cen.setUint32(24, d.length, true);
      cen.setUint16(28, n.length, true);
      cen.setUint32(42, offset, true);
      parts.push(new Uint8Array(local.buffer), n, d);
      central.push(new Uint8Array(cen.buffer), n);
      offset += 30 + n.length + d.length;
    });
    const size = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
    let p = 0;
    all.forEach((b) => { out.set(b, p); p += b.length; });
    return out;
  }

  // texts：文書（改行区切りの文面）の並び。.docx のバイト列を返す
  function build(texts) {
    return zip([
      { name: '[Content_Types].xml', data: CONTENT_TYPES },
      { name: '_rels/.rels', data: RELS },
      { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
      { name: 'word/document.xml', data: documentXml(texts) },
      { name: 'word/styles.xml', data: STYLES },
    ]);
  }

  const TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  function download(bytes, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: TYPE }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  return { build, download };
})();
