// 郵送用の宛名ラベル。宛先（議会事務局）を A4 のラベル用紙に面づけした PDF にする（pdfdoc.js）。
// 宛先は ?c=都道府県/議会名,… で受け取るか、この画面で追加する。直した内容はこの端末にだけ残す
(() => {
  const { esc, flash } = window.Common;
  const $ = (id) => document.getElementById(id);

  const { SHEETS } = window.PdfDoc;
  // 封筒に合う用紙だけを選べるようにする（前に選んでいた用紙が合わなければ、最初のものにする）
  function renderSheets() {
    const env = $('lbEnv').value;
    const cur = $('lbSheet').value;
    const ok = Object.entries(SHEETS).filter(([, s]) => s.envs.includes(env));
    $('lbSheet').innerHTML = ok.map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('');
    if (ok.some(([k]) => k === cur)) $('lbSheet').value = cur;
  }

  // ---------- 宛先 ----------
  // 1件：{ id：都道府県/議会名, zip, address, main：本庁舎の住所か }
  const STORE = window.THEME.key('chinjo-labels');
  const OPT_STORE = window.THEME.key('chinjo-labels-opt');
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* この画面の間だけ残す */ } };

  const places = new Map(window.Places.all().map((pl) => [`${pl.pref}/${pl.council}`, pl]));
  const prefOf = (id) => id.slice(0, id.indexOf('/'));
  const nameOf = (id) => id.slice(id.indexOf('/') + 1);
  function newRow(id) {
    const pl = places.get(id);
    return { id, ...window.Places.office(pl.pref, pl.key) };
  }

  const rows = load(STORE, []).filter((r) => places.has(r.id));
  // かんたん作成から来たときは、そこで選んだ議会を足す（前に直した住所は残す）
  const fromUrl = (new URLSearchParams(location.search).get('c') || '').split(',').filter((id) => places.has(id));
  fromUrl.forEach((id) => { if (!rows.some((r) => r.id === id)) rows.push(newRow(id)); });
  if (fromUrl.length) history.replaceState(null, '', location.pathname);
  const save = () => store(STORE, rows);
  save();

  // 同じ名前の議会が別の県にもある（府中市・伊達市など）ので、候補には都道府県名を添える
  $('lbList').innerHTML = [...places.values()]
    .map((pl) => `<option value="${esc(pl.council)}（${esc(pl.pref + pl.gun)}）"></option>`).join('');
  function idFromInput(v) {
    const m = v.trim().match(/^(.+?)（(.+?)）$/);
    if (m) {
      const pref = window.PREFS.find((p) => m[2].startsWith(p));
      if (pref && places.has(`${pref}/${m[1]}`)) return `${pref}/${m[1]}`;
    }
    // 候補を選ばずに名前だけ入れたときは、1つに決まる場合だけ受け付ける
    const name = /議会$/.test(v.trim()) ? v.trim() : `${v.trim()}議会`;
    const hits = [...places.keys()].filter((id) => nameOf(id) === name);
    return hits.length === 1 ? hits[0] : null;
  }
  function add() {
    const id = idFromInput($('lbAdd').value);
    if (!id) { flash('候補の中から選んでください（同じ名前の自治体がほかの都道府県にもあります）', 4000); return; }
    if (rows.some((r) => r.id === id)) { flash('すでに入っています'); return; }
    rows.push(newRow(id));
    $('lbAdd').value = '';
    save();
    render();
  }
  $('lbAddBtn').addEventListener('click', add);
  $('lbAdd').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  // 都道府県の議会でなければ、どこの議会かわかるよう都道府県名を添える
  const label = (id) => (nameOf(id).startsWith(prefOf(id)) ? nameOf(id) : `${nameOf(id)}（${prefOf(id)}）`);

  function render() {
    $('lbRows').innerHTML = rows.length ? rows.map((r, i) => `
      <li data-i="${i}">
        <b>${esc(label(r.id))}</b>
        <label>〒<input data-f="zip" value="${esc(r.zip)}" inputmode="numeric" size="9"></label>
        <label class="wide">住所<input data-f="address" value="${esc(r.address)}" placeholder="住所を入れてください"></label>
        ${r.main && r.address ? '<span class="hint-sm">本庁舎の住所です。議会事務局が別の建物にないか確かめてください。</span>' : ''}
        <button type="button" data-del="${i}" aria-label="${esc(label(r.id))}を外す">×</button>
      </li>`).join('') : '<li class="hint-sm">宛先がありません。下で議会を追加してください。</li>';
    summary();
  }
  $('lbRows').addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    rows[e.target.closest('li').dataset.i][f] = e.target.value;
    save();
    summary();
  });
  $('lbRows').addEventListener('click', (e) => {
    const i = e.target.dataset.del;
    if (i === undefined) return;
    rows.splice(Number(i), 1);
    save();
    render();
  });

  // ---------- 差出人 ----------
  const sender = window.Common.bindSender($('lbSender'), () => summary());
  $('lbSenderClear').addEventListener('click', () => {
    window.Common.forgetSender();
    $('lbSender').querySelectorAll('[data-sender]').forEach((el) => { el.value = ''; sender[el.dataset.sender] = ''; });
    summary();
    flash('この端末から住所・氏名を消しました');
  });

  // ---------- 印刷のしかた ----------
  const OPTS = ['lbEnv', 'lbSheet', 'lbTo', 'lbSkip', 'lbZaichu', 'lbFrom', 'lbBack'];
  const opt = load(OPT_STORE, {});
  OPTS.forEach((k) => {
    const el = $(k);
    const prop = el.type === 'checkbox' ? 'checked' : 'value';
    if (k === 'lbSheet') renderSheets();
    if (opt[k] !== undefined) el[prop] = opt[k];
    el.addEventListener('change', () => {
      if (k === 'lbEnv') { renderSheets(); opt.lbSheet = $('lbSheet').value; }
      opt[k] = el[prop];
      store(OPT_STORE, opt);
      summary();
    });
  });
  const sheet = () => SHEETS[$('lbSheet').value] || SHEETS.a4_8;
  const skip = () => Math.max(0, Math.floor(Number($('lbSkip').value) || 0));

  const labelOpts = () => ({ to: $('lbTo').value, zaichu: $('lbZaichu').checked, from: $('lbFrom').checked, back: $('lbBack').checked });

  function summary() {
    const s = sheet();
    const per = s.cols * s.rows;
    const n = rows.length * ($('lbBack').checked ? 2 : 1);
    const pages = n ? Math.ceil((n + (skip() % per)) / per) : 0;
    const noAddr = rows.filter((r) => !r.address.trim()).length;
    $('lbSummary').innerHTML = `ラベル ${n}枚 → A4 ${pages}ページ（1ページ ${per}面）`
      + (noAddr ? `<br>⚠ 住所が空の宛先が${noAddr}件あります。` : '')
      + ($('lbFrom').checked && !sender.address ? '<br>⚠ 差出人の住所が空です。返送してもらえるよう入れておくのがおすすめです。' : '');
  }

  // ボタン1つで PDF を保存する（ラベル用紙にもコンビニの普通紙にも、そのまま印刷できる）
  async function makePdf() {
    const doc = await window.PdfDoc.create();
    const list = rows.map((r) => ({ council: nameOf(r.id), zip: r.zip, address: r.address }));
    doc.addLabels(sheet(), window.PdfDoc.labelItems(list, sender, labelOpts()), skip());
    return doc.bytes();
  }
  const fileName = () => `宛名ラベル_${window.PdfDoc.today()}.pdf`;
  async function run(btn, after) {
    if (!rows.length) { flash('宛先がありません。議会を追加してください。'); return; }
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'PDFを作っています…';
    try {
      await after(await makePdf());
    } catch (e) {
      flash(`PDFを作れませんでした（${e.message}）。通信のよい所でもう一度試してください。`, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
  $('lbPdf').addEventListener('click', (e) => run(e.currentTarget, (bytes) => {
    window.PdfDoc.download(bytes, fileName());
    flash('PDFを保存しました');
  }));
  $('lbShare').hidden = !window.PdfDoc.canShareFiles();
  $('lbShare').addEventListener('click', (e) => run(e.currentTarget, (bytes) => window.PdfDoc.shareFile(bytes, fileName())));
  window.PdfDoc.preload();

  render();
})();
