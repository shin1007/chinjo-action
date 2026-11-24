// 人口カバー率（/coverage）。site/data/coverage.json（node scripts/intake.js coverage で作る）を読んで表と一覧を出す
(() => {
  const $ = (id) => document.getElementById(id);
  const pct = (x) => (x.total ? (100 * x.pop / x.total) : 0).toFixed(1);
  const fmt = (n) => n.toLocaleString('ja-JP');
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const LABEL = { c: '陳情', y: '要望', p: 'パブコメ' };
  const STATE = { 0: 'まだ', 1: '案内ページだけ', 2: '出し方まで' };

  fetch('/data/coverage.json').then((r) => r.json()).then((d) => {
    const [y, m, dd] = d.asOf.split('-').map(Number);
    $('cov-asof').textContent = `${y}年${m}月${dd}日時点（人口は${d.population_as_of.slice(0, 4)}年1月1日現在）`;
    renderTable(d.kinds);
    setupList(d.rows, d.prefs);
  }).catch(() => { $('cov-asof').textContent = '読み込めませんでした。時間をおいて開き直してください。'; });

  // ほかの調査の進み具合。調べきれていなくても、いまわかっている数をそのまま出す（node scripts/progress.js で作る）
  fetch('/data/progress.json').then((r) => r.json()).then((d) => {
    const box = $('cov-progress');
    if (!box) return;
    const t = el('table', null, 'cost-table');
    const h = el('tr'); ['', '都道府県', '市区町村', '調べ方・メモ'].forEach((s) => h.append(el('th', s)));
    t.append(el('thead')); t.tHead.append(h);
    const b = el('tbody');
    const cell2 = (x) => { const td = el('td'); td.append(`${fmt(x.n)} / ${fmt(x.of)}`); return td; };
    const cellM = (x) => { const td = el('td'); td.append(`${fmt(x.n)} / ${fmt(x.of)}（人口で${pct(x)}%）`); return td; };
    const rows = [
      ['議員名簿の公式ページが見つかった', d.roster.page, '公式サイトのリンクをたどって探し、見つからないものは「調査中」と出しています（/letter）'],
      ['議員の名前を取り込めた', d.roster.names, '名簿から機械で抜き出せた議会。書き方が読めないものは「調査中」です'],
      ['陳情の案内ページが見つかった', d.chinjo.page, '案内ページがなくても、議会事務局に聞く方法を作成画面に出しています'],
      ['陳情の郵送の扱い（住民）がわかった', d.chinjo.mailKnown, '審査される・議員に配るだけ・受け付けない、のどれかを公式の案内で確かめた議会'],
      ['  うち、郵送でも審査される', d.chinjo.mailReviewed, '住民の郵送を審査する、と公式の案内で確かめた議会（住民以外の扱いは別です）'],
      ['要望（首長）を郵送で受け付ける', d.yobo.mailAccepted, '公式の案内で確かめたもの'],
    ];
    const I = d.intake;
    rows.push(
      ['陳情：締切がわかった', I.chinjo.deadline, '公式の案内に締切（定例会ごとの日など）が書いてあった議会'],
      ['陳情：住所・氏名が公開されるかがわかった', I.chinjo.name_published, '会議録・議会のホームページでの公開の扱い'],
      ['陳情：審査の結果を知らせてもらえるかがわかった', I.chinjo.result_notice, ''],
      ['陳情：必要な部数がわかった', I.chinjo.copies, ''],
      ['陳情：Web・電子申請の窓口がわかった', I.chinjo.form, ''],
      ['要望：住民以外も出せるかがわかった', I.yobo.eligible, '住民だけ・関わりのある人だけ、と公式の案内に書いてあった自治体（それ以外の自治体は、まだ確かめられていません）'],
      ['要望：回答がもらえるかがわかった', I.yobo.reply, ''],
      ['要望：Webフォームで出せる', I.yobo.form, ''],
      ['要望：匿名で出せる', I.yobo.anonymous_ok, ''],
      ['寄せられた意見と回答の一覧が見つかった', I.kaito, '市長への手紙などの「寄せられた意見と回答」。要望の文面づくりの参考にしています'],
    );
    for (const [label, x, memo] of rows) {
      const tr = el('tr'); tr.append(el('th', label), cell2(x.pref), cellM(x.muni), el('td', memo, 'small')); b.append(tr);
    }
    t.append(b);
    const names = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への参加', kenko: '国民の健康', sonota: 'その他の陳情' };
    const t2 = el('table', null, 'cost-table');
    const h2 = el('tr'); ['テーマ', '国への項目', '自治体への項目', '陳情が採択された例'].forEach((x) => h2.append(el('th', x)));
    t2.append(el('thead')); t2.tHead.append(h2);
    const b2 = el('tbody');
    for (const [id, v] of Object.entries(d.themes)) {
      const tr = el('tr'); tr.append(el('th', names[id]), el('td', `${v.national}`), el('td', `${v.local}`), el('td', v.adopted ? `${v.adopted}件` : '調査中（まだ確かめられていません）')); b2.append(tr);
    }
    t2.append(b2);
    box.replaceChildren(t, el('p', `人口は総務省「住民基本台帳に基づく人口」（${d.population_as_of.slice(0, 4)}年1月1日現在）。市区町村の割合は、全市区町村の人口の合計に対する割合です。${d.asOf.replace(/-/g, '/')}時点の、わかっている数です。`, 'small'), t2);
  }).catch(() => {});

  fetch('/data/verify-summary.json').then((r) => r.json()).then((v) => {
    const [y, m, dd] = v.checked_at.split('-').map(Number);
    $('cov-verify').textContent = `出典の照合（${y}年${m}月${dd}日）：根拠にした公式サイトのページ ${v.total.toLocaleString('ja-JP')} 件のうち、${v.ok.toLocaleString('ja-JP')} 件で根拠の一文がいまも載っていることを機械で確かめました。一文が見つからなかったもの ${v.missing} 件・ページを開けなかったもの ${v.unreachable} 件は、調べ直しています。毎月と、議員の改選のあとに確かめ直します。`;
  }).catch(() => {});

  function cell(x) {
    const td = el('td');
    const m = el('meter'); m.min = 0; m.max = 100; m.value = Number(pct(x));
    m.setAttribute('aria-label', `${pct(x)}%`);
    td.append(m, el('span', ` ${pct(x)}%`), el('br'), el('span', `${fmt(x.n)} / ${fmt(x.of)}`, 'small'));
    return td;
  }
  function renderTable(k) {
    const t = el('table', null, 'cost-table');
    const h = el('tr'); ['', '都道府県', '市区町村'].forEach((s) => h.append(el('th', s)));
    t.append(el('thead')); t.tHead.append(h);
    const b = el('tbody');
    const rows = [
      ['陳情（議会）：出し方までわかる', 'chinjo', 'known'], ['陳情（議会）：案内ページはある', 'chinjo', 'page'],
      ['要望（首長）：出し方までわかる', 'yobo', 'known'], ['要望（首長）：案内ページはある', 'yobo', 'page'],
      ['パブリックコメントのページ', 'pubcom', 'page'],
    ];
    for (const [label, kind, lv] of rows) {
      const tr = el('tr'); tr.append(el('th', label), cell(k.pref[kind][lv]), cell(k.municipality[kind][lv])); b.append(tr);
    }
    t.append(b);
    $('cov-table').replaceChildren(t);
  }

  // 事務局・担当課に電話やメールで聞くときの文（公式サイトに書かれていないことだけを聞く）
  function askText(kind, name, isPref) {
    if (kind === 'c') {
      const to = `${name}議会事務局`;
      return [`${to}　ご担当者様`, '',
        '陳情の出し方についてお尋ねします。公式サイトの案内を読みましたが、わからなかった点です。',
        `1．${isPref ? '都道府県' : '市（町・村）'}の外に住む人が郵送で出した陳情は、審査されますか。それとも、審査はされず議員に配られるだけですか。`,
        '2．郵送・電子メール・電子申請で受け付けていますか。',
        '3．提出の締切と、必要な部数を教えてください。',
        '4．陳情者の住所・氏名は、会議録や議会のホームページで公開されますか。',
        '5．審査の結果は、陳情者に知らせてもらえますか。',
        '', 'お答えの日付と、わかったことを、「議会への出し方を確かめるページ」（/kakunin）から匿名で知らせます（担当者のお名前は書きません）。'].join('\n');
    }
    if (kind === 'y') {
      const to = isPref ? `${name}の知事あて要望の担当課（広聴・秘書など）` : `${name}の市民の声・要望の担当課（広聴・秘書など）`;
      return [`${to}　ご担当者様`, '',
        '知事・市区町村長あての要望の出し方についてお尋ねします。公式サイトの案内を読みましたが、わからなかった点です。',
        '1．郵送・電子メール・電子申請で受け付けていますか。送り先の部署はどこですか。',
        '2．その自治体に住んでいない人（在勤・在学でない人）の要望も受け付けていますか。',
        '3．回答はもらえますか。氏名は公開されますか。'].join('\n');
    }
    return '';
  }

  function setupList(rows, prefs) {
    const prefSel = $('cov-pref');
    for (const p of prefs) prefSel.append(new Option(p, p));
    const q = new URLSearchParams(location.search);
    if (q.get('pref')) prefSel.value = q.get('pref');
    if (q.get('kind')) $('cov-kind').value = q.get('kind');
    let shown = 50;
    const draw = () => {
      const pref = prefSel.value; const kind = $('cov-kind').value;
      const i = { c: 2, y: 3, p: 4 }[kind]; const need = kind === 'p' ? 1 : 2;
      const list = rows.filter((r) => (!pref || r[0].startsWith(pref + '/')) && r[i] < need);
      $('cov-count').textContent = `${list.length} 件（人口 ${fmt(list.reduce((a, r) => a + r[1], 0))} 人分）。人口の多い順です。`;
      const tb = $('cov-list').tBodies[0]; tb.replaceChildren();
      for (const r of list.slice(0, shown)) {
        const [pf, nm] = r[0].split('/');
        const name = nm === '@' ? pf : `${pf} ${nm}`;
        const tr = el('tr');
        const known = ['c', 'y', 'p'].map((k, j) => `${LABEL[k]}：${k === 'p' ? (r[4] ? 'ある' : 'まだ') : STATE[r[2 + j]]}`).join('／');
        const a = el('a', '知らせる');
        const target = kind === 'c' ? `${nm === '@' ? pf : nm}議会` : kind === 'y' ? `${nm === '@' ? pf + '知事' : nm + '長'}あての要望` : `${nm === '@' ? pf : nm}のパブリックコメント`;
        a.href = `/feedback?quick=1&kind=council_procedure&target=${encodeURIComponent((name + '：' + target).slice(0, 100))}&ask=${encodeURIComponent('出し方の案内ページの URL を教えてください')}#fb-form`;
        tr.append(el('td', name), el('td', fmt(r[1])), el('td', known, 'small'));
        const td = el('td'); td.append(a);
        const ask = askText(kind, nm === '@' ? pf : nm, nm === '@');
        if (ask) {
          const c = el('button', '事務局に聞く文をコピー', 'btn btn-small cov-copy');
          c.type = 'button';
          c.addEventListener('click', () => {
            const done = () => { c.textContent = 'コピーしました'; setTimeout(() => { c.textContent = '事務局に聞く文をコピー'; }, 2500); };
            (navigator.clipboard ? navigator.clipboard.writeText(ask) : Promise.reject()).then(done).catch(() => { window.prompt('コピーして使ってください', ask); });
          });
          td.append(' ', c);
        }
        tr.append(td);
        tb.append(tr);
      }
      $('cov-more').hidden = list.length <= shown;
    };
    prefSel.addEventListener('change', () => { shown = 50; draw(); });
    $('cov-kind').addEventListener('change', () => { shown = 50; draw(); });
    $('cov-more').addEventListener('click', () => { shown += 100; draw(); });
    draw();
  }
})();
