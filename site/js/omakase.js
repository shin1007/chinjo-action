// おまかせ：3つのテーマから3つずつ陳情を引き、郵送でも審査される人口の多い議会3つに出す分を、1つのPDFにまとめる。
// テーマごとに文面のデータ（asks・template）が違い、項目の id もテーマをまたぐと重なるので、
// 引いたテーマのデータを順に読み込み、テーマごとに makePetition（petition.js）で文面の道具を作る。
// サーバーには何も送らない（住所・氏名はブラウザの中だけで使う）
(() => {
  const { esc, flash } = window.Common;
  const $ = (id) => document.getElementById(id);

  const THEMES = [
    ['kodomo', '子どもの権利'], ['dansei', '男女平等'], ['nihonjin', '日本人の権利'],
    ['shiho', '司法への参加'], ['kenko', '国民の健康'], ['sonota', 'その他（税・教育）'],
  ];
  const SETS = 3; // 議会の数＝テーマの数
  const PER_SET = 5; // 1つの議会に出す陳情の数（1つの議会に一度に出すのは5件までがおすすめ。送付状と合わせて100gの切手で送れる）
  const TOP = 20; // 人口の多い議会のうち、上位いくつから選ぶか
  const STALE_DAYS = 90;

  // ---------- 読み込み ----------
  const loadScript = (src) => new Promise((ok, ng) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { s.remove(); ok(); };
    s.onerror = () => ng(new Error(`${src} を読み込めませんでした`));
    document.head.appendChild(s);
  });
  // テーマの文面データを読み込む。asks-*.js は window.ASKS に足していく作りなので、空にしてから1テーマずつ読む
  const themes = {};
  async function ensureTheme(id) {
    if (themes[id]) return themes[id];
    window.ASKS = [];
    await loadScript(`/themes/${id}/asks-national.js`);
    await loadScript(`/themes/${id}/asks-local.js`);
    await loadScript(`/themes/${id}/template.js`);
    const asks = window.ASKS.slice();
    const template = window.TEMPLATE;
    const P = window.makePetition(asks, template);
    // 陳情として出せる項目（要望書向けは入れない）
    const pool = asks.filter((a) => P.usableFor(a, 'petition'));
    themes[id] = { id, name: THEMES.find(([k]) => k === id)[1], P, pool };
    return themes[id];
  }

  let pops = null;
  async function ensurePops() {
    if (pops) return pops;
    const r = await fetch('/data/municipality-populations.json');
    if (!r.ok) throw new Error('人口のデータを読み込めませんでした');
    pops = await r.json();
    return pops;
  }

  // ---------- くじ ----------
  // 重みをつけて、重ならないように n 個選ぶ
  function sample(list, n, weight = () => 1) {
    const left = [...list];
    const out = [];
    while (out.length < n && left.length) {
      const ws = left.map(weight);
      let r = Math.random() * ws.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < left.length - 1 && (r -= ws[i]) >= 0) i += 1;
      out.push(left.splice(i, 1)[0]);
    }
    return out;
  }

  // 郵送でも審査される（住民も住民以外も）と、議会の公式案内で確かめた議会だけが候補。人口の多い順に上位 TOP
  function candidates() {
    const rows = [];
    for (const pref of window.PREFS) {
      for (const pl of window.Places.of(pref)) {
        const policy = window.MailPolicy.get(pref, pl.key);
        if (!policy || policy.mail_resident !== 'ok' || policy.mail_nonresident !== 'ok' || policy.confidence !== 'confirmed') continue;
        const pop = pops.populations[`${pref}|${pl.isPref ? '都道府県議会' : pl.key}`];
        const office = window.Places.office(pref, pl.key);
        if (!pop || !office.address) continue;
        rows.push({ pref, key: pl.key, council: pl.council, name: pl.name, pop, office, policy });
      }
    }
    return rows.sort((a, b) => b.pop - a.pop).slice(0, TOP);
  }
  // 人口の平方根に比例する確率で選ぶ（人口の多い議会が出やすいが、上位の議会に偏りすぎない）。同じ都道府県は重ならない
  function drawCouncils() {
    const left = candidates();
    const out = [];
    while (out.length < SETS && left.length) {
      const [c] = sample(left, 1, (x) => Math.sqrt(x.pop));
      out.push(c);
      for (let i = left.length - 1; i >= 0; i -= 1) if (left[i].pref === c.pref) left.splice(i, 1);
    }
    return out;
  }

  // 陳情の内容。札（研究の裏づけ・実施例・費用が少ない）の多い項目ほど出やすくする
  const drawItems = (t, n, avoid = []) => sample(t.pool.filter((a) => !avoid.includes(a.id)), n, (a) => 1 + window.Common.tagsOf(a).length).map((a) => a.id);

  const state = { councils: [], sets: [] }; // sets：{ theme：テーマの id, items：項目の id の並び }

  async function drawSets(themeIds) {
    const sets = [];
    for (const id of themeIds) {
      const t = await ensureTheme(id);
      sets.push({ theme: id, items: drawItems(t, PER_SET) });
    }
    return sets;
  }
  const drawThemeIds = (except = []) => sample(THEMES.map(([k]) => k).filter((k) => !except.includes(k)), SETS).slice(0, SETS);

  // ---------- 文面 ----------
  const sender = window.Common.bindSender($('omSender'), () => { if (state.sets.length) renderTexts(); });
  const formFor = (key) => {
    const fd = new FormData();
    fd.append('items', key);
    fd.append('kind', 'petition');
    fd.append('story', '');
    ['address', 'name', 'tel'].forEach((k) => fd.append(k, ''));
    return fd;
  };
  const textOf = (i, key) => {
    const { P } = themes[state.sets[i].theme];
    return P.withSender(P.build(formFor(key), state.councils[i].council, [key]), sender);
  };
  const docsOf = (i) => state.sets[i].items.map((k) => textOf(i, k));

  // ---------- 画面 ----------
  const ymd = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${m[1]}年${+m[2]}月${+m[3]}日` : ''; };
  const isStale = (d) => { const t = Date.parse(d || ''); return !Number.isNaN(t) && Date.now() - t > STALE_DAYS * 86400000; };

  function renderSets() {
    $('omSets').innerHTML = state.sets.map((set, i) => {
      const c = state.councils[i];
      const t = themes[set.theme];
      const p = c.policy;
      const stale = isStale(p.verified_at);
      return `<li class="om-set">
        <h3>${esc(c.council)}<small>　人口 ${c.pop.toLocaleString('ja-JP')}人</small></h3>
        <p class="hint-sm">📮 郵送でも審査されます（${esc(ymd(p.verified_at))}に公式の案内で確認）${stale ? '。<b>3か月以上前なので、出す前に案内ページで確かめてください</b>' : ''}。
          ${p.source_quote ? `公式案内：「${esc(p.source_quote)}」` : ''} ${p.source_url ? `<a href="${esc(p.source_url)}" target="_blank" rel="noopener">公式案内のページを開く</a>` : ''}</p>
        <p>テーマ：<b>${esc(t.name)}</b>　<button type="button" class="btn btn-small" data-redraw-set="${i}">このセットを引き直す</button></p>
        <ol class="om-items">${set.items.map((k, j) => {
          const a = t.P.ITEMS[k];
          return `<li><b>${esc(a.label)}</b>${window.Common.scopeTag(a)}${window.Common.askTags(a)} <button type="button" class="btn btn-small" data-swap="${i},${j}">別の内容に</button></li>`;
        }).join('')}</ol>
        <details class="om-texts"><summary>文面を見る（3通）</summary><div data-texts="${i}"></div></details>
      </li>`;
    }).join('');
    $('omSource').textContent = `議会の人口は、${pops.source}（${pops.asOf}時点）による。郵送の扱いは、各議会の公式案内で確かめたもの（このサイトの /kakunin と同じデータ）。`;
    renderTexts();
  }
  // 文面を見る欄だけ作り直す（住所・氏名を直したときは、開いている欄を閉じずに中身だけ替える）
  function renderTexts() {
    document.querySelectorAll('[data-texts]').forEach((el) => {
      const i = Number(el.dataset.texts);
      el.innerHTML = docsOf(i).map((d) => `<pre class="om-pre">${esc(d)}</pre>`).join('');
    });
  }

  function setBusy(on, msg = '') {
    ['omDraw', 'omRedrawAll', 'omRedrawCouncils', 'omRedrawSets', 'omPdf', 'omPrint'].forEach((id) => { $(id).disabled = on; });
    $('omStatus').textContent = msg;
  }
  async function run(fn) {
    setBusy(true, '読み込んでいます…');
    try {
      await ensurePops();
      await fn();
      $('omResult').hidden = false;
      $('omDraw').textContent = '全部引き直す';
      renderSets();
      setBusy(false, '');
    } catch (e) {
      setBusy(false, `うまくいきませんでした：${e.message}`);
    }
  }

  const drawAll = async () => { state.councils = drawCouncils(); state.sets = await drawSets(drawThemeIds()); };
  $('omDraw').addEventListener('click', () => run(drawAll));
  $('omRedrawAll').addEventListener('click', () => run(drawAll));
  $('omRedrawCouncils').addEventListener('click', () => run(async () => { state.councils = drawCouncils(); }));
  $('omRedrawSets').addEventListener('click', () => run(async () => { state.sets = await drawSets(drawThemeIds()); }));
  $('omSets').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.swap) {
      const [i, j] = b.dataset.swap.split(',').map(Number);
      const set = state.sets[i];
      const t = themes[set.theme];
      const [k] = drawItems(t, 1, set.items);
      if (!k) { flash('入れ替えられる内容がありません'); return; }
      set.items[j] = k;
      renderSets();
    } else if (b.dataset.redrawSet) {
      const i = Number(b.dataset.redrawSet);
      run(async () => {
        const used = state.sets.map((s) => s.theme);
        const [id] = drawThemeIds(used.filter((_, n) => n !== i));
        const t = await ensureTheme(id);
        state.sets[i] = { theme: id, items: drawItems(t, PER_SET) };
      });
    }
  });

  // ---------- PDF・印刷 ----------
  const checked = (id) => $(id).checked;
  const plain = (t) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?\s*/gu, '');

  function memoFor(c, pagesN) {
    const t = ((window.TEL || {})[c.pref] || {})[c.key];
    const site = ((window.SITES || {})[c.pref] || {})[c.key] || [];
    const p = window.Postage.estimate(pagesN);
    return {
      name: `${c.council}事務局`,
      page: site[1] || '',
      mail: plain('📮 郵送でも審査されます'),
      denshi: false,
      tel: t ? `${t[1]}（${t[0] === 'gikai' ? '議会事務局' : '役所。「議会事務局につないでください」と伝える'}）` : '',
      address: c.office.address ? `〒${c.office.zip}　${c.office.address}${c.office.main ? '（役所の本庁舎。議会事務局が別の建物のこともある）' : ''}` : '',
      access: '',
      deadline: '',
      sessions: ((((window.SESSIONS || {})[c.pref] || {})[c.key]) || [])[0] || '',
      stamp: p.yen ? `${pagesN}枚・約${p.g}g → ${p.safe ? `${p.safe}円（${p.yen}円の境目に近いので1つ上の料金）` : `${p.yen}円`}` : `${pagesN}枚・約${p.g}g → 郵便局の窓口で出す`,
    };
  }

  async function makePdf() {
    const doc = await window.PdfDoc.create();
    const pages = [];
    for (let i = 0; i < state.sets.length; i += 1) {
      const c = state.councils[i];
      const { P } = themes[state.sets[i].theme];
      // 参考図表（figs.js）は、いま使っているテーマの項目を引く
      window.Petition = P;
      const docs = docsOf(i);
      let n = 0;
      if (checked('omCover')) n += doc.addDocument(P.cover(c.council, docs, sender));
      for (let j = 0; j < docs.length; j += 1) {
        const key = state.sets[i].items[j];
        n += doc.addDocument(docs[j]);
        if (window.Figs) await window.Figs.addTo(doc, [key]);
        if (checked('omIken') && P.isNational(P.ITEMS[key])) {
          const ik = P.ikensho(c.council, [key]);
          if (ik) n += doc.addDocument(ik);
        }
      }
      pages.push(n);
    }
    if (checked('omLabels')) {
      const rows = state.councils.map((c) => ({ council: c.council, ...c.office }));
      doc.addLabels(window.PdfDoc.SHEETS.plain, window.PdfDoc.labelItems(rows, sender, { to: 'chair', zaichu: true, from: true, back: true }));
    }
    if (checked('omMemo')) {
      for (let i = 0; i < state.sets.length; i += 1) {
        const { P } = themes[state.sets[i].theme];
        const text = window.SendMemo.build({
          kind: 'petition',
          count: PER_SET,
          titles: state.sets[i].items.map((k) => P.ITEMS[k].label),
          councils: [memoFor(state.councils[i], pages[i])],
          figs: false,
        });
        doc.addDocument(text);
      }
    }
    return doc.bytes();
  }

  $('omPdf').addEventListener('click', async (e) => {
    if (!state.sets.length) return;
    const btn = e.currentTarget;
    const label = btn.textContent;
    setBusy(true, 'PDFを作っています…（初めてのときは、フォントの読み込みで少し時間がかかります）');
    try {
      const bytes = await makePdf();
      const name = `omakase-${window.PdfDoc.today()}.pdf`;
      window.PdfDoc.download(bytes, name);
      setBusy(false, '保存しました。印刷して、陳情書に署名してから、議会ごとの封筒に入れてください。');
    } catch (err) {
      setBusy(false, `PDFを作れませんでした：${err.message}`);
    }
    btn.textContent = label;
  });
  $('omPrint').addEventListener('click', () => {
    if (!state.sets.length) return;
    const texts = [];
    for (let i = 0; i < state.sets.length; i += 1) {
      const { P } = themes[state.sets[i].theme];
      const docs = docsOf(i);
      if (checked('omCover')) texts.push(P.cover(state.councils[i].council, docs, sender));
      texts.push(...docs);
    }
    window.Common.printTexts(texts);
  });
})();
