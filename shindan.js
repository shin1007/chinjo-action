// トップの届け方の診断：質問2つで、陳情書・要望書・請願・手紙・国への提案のどれが合うかを示す
(() => {
  const box = document.getElementById('shindan');
  if (!box) return;
  const result = document.getElementById('shindanResult');
  const intro = box.querySelector('[data-q="intro"]');
  const RESULTS = {
    petition: ['陳情書', '紹介議員がいなくても、だれでも議会（議長あて）に出せます。下のテーマを選ぶと、陳情書をつくる画面に進みます。', 'petition'],
    seigan: ['請願（陳情書の文面を土台に）', '請願は紹介議員が要るため、このサイトでは請願書そのものは作れません。下のテーマで陳情書をつくり、その文面を持って議員に紹介をお願いしてください。', 'petition'],
    request: ['要望書', '市区町村長・知事に、取り組みの検討や説明を直接求めます。下のテーマを選ぶと、要望書をつくる画面に進みます。', 'request'],
    letter: ['議員への手紙', '地元の議員に読んでもらい、議会で取り上げてもらうきっかけにします。', null, '/letter', '議員への手紙をつくる'],
    nation: ['国への提案（規制改革・行政改革ホットライン）', '国の法律・省令などの規制や制度の見直しは、内閣府のフォームから個人で直接提案できます。所管の省庁が検討し、回答は内閣府のサイトで公開されます。規制や制度の見直し以外の苦情や要望は、総務省の行政相談が窓口です。あわせて、地元の議会に「国へ意見書を出してほしい」という陳情を出すこともできます。', null, 'https://form.cao.go.jp/kokumin_koe/opinion-0016.html', '内閣府のフォームを開く'],
    learn: ['まず、しくみを知る', '陳情・請願・要望書の違いと、出したあとのことを短くまとめています。読んでから、この質問に戻ってきてください。', null, '/about', '陳情のしくみを読む'],
  };
  const themeLinks = [...document.querySelectorAll('#themes .theme-list a')];
  const base = themeLinks.map((a) => a.getAttribute('href'));

  function show(key) {
    const [name, text, kind, href, label] = RESULTS[key];
    // テーマへのリンクを、診断で選んだ届け方の作成画面に向ける
    themeLinks.forEach((a, i) => a.setAttribute('href', kind ? `${base[i]}/make${kind === 'request' ? '?kind=request' : ''}` : base[i]));
    result.innerHTML = `<p class="shindan-name">あなたには <b>${name}</b> が合います</p><p>${text}</p>
      <p>${href ? `<a class="btn btn-primary" href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${label}</a>` : '<a class="btn btn-primary" href="#themes">テーマを選ぶ ↓</a>'}
      <button type="button" class="btn btn-small" data-reset>選び直す</button></p>`;
    result.hidden = false;
  }
  const mark = (fs, b) => fs.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });

  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-reset')) {
      box.querySelectorAll('.shindan-q button').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
      intro.hidden = true;
      result.hidden = true;
      themeLinks.forEach((a, i) => a.setAttribute('href', base[i]));
      return;
    }
    const fs = b.closest('fieldset');
    if (!fs) return;
    mark(fs, b);
    const a = b.dataset.a;
    if (fs.dataset.q === 'who') {
      intro.hidden = a !== 'council';
      if (a === 'council') { result.hidden = true; mark(intro, null); intro.querySelector('button').focus(); return; }
      show({ exec: 'request', member: 'letter', nation: 'nation', unknown: 'learn' }[a]);
    } else show(a === 'yes' ? 'seigan' : 'petition');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
})();
