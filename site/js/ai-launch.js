// 生成AIを開くボタン。指示文を必ずクリップボードにコピーし、URLで渡せるサービスには入力済みの状態で開く。
// URLで渡す方法は各サービスの非公式な仕様なので、入らなかったときは貼り付けてもらう。
(() => {
  // エンコード後の長さがこれを超えるとURLが長すぎて開けないことがあるため、貼り付けに切り替える
  const MAX_URL_PARAM = 30000;

  // 2026年11月に確かめた動き：ChatGPT・Perplexity は開くとすぐ送る。Claude は入力欄に入るだけ。Grok は「送信しますか」と聞く
  // Gemini と Copilot は URL で渡しても入力欄に入らない（Copilot はサインインしたあとも入らない）ので、貼り付けてもらう
  const SERVICES = {
    chatgpt: { name: 'ChatGPT', base: 'https://chatgpt.com/', url: (q, temp) => `https://chatgpt.com/?q=${q}${temp ? '&temporary-chat=true' : ''}` },
    claude: { name: 'Claude', base: 'https://claude.ai/new', url: (q) => `https://claude.ai/new?q=${q}` },
    gemini: { name: 'Gemini', base: 'https://gemini.google.com/app' },
    grok: { name: 'Grok', base: 'https://grok.com/', url: (q) => `https://grok.com/?q=${q}` },
    // ウェブを検索して答えるので、自治体の計画を探してもらうのに向く
    perplexity: { name: 'Perplexity', base: 'https://www.perplexity.ai/', url: (q) => `https://www.perplexity.ai/?q=${q}` },
    copilot: { name: 'Copilot', base: 'https://copilot.microsoft.com/' },
  };

  async function launch(key, prompt, temporary) {
    const s = SERVICES[key];
    const { flash } = window.Common;
    let copied = true;
    try { await navigator.clipboard.writeText(prompt); } catch { copied = false; }
    const q = encodeURIComponent(prompt);
    const direct = s.url && q.length <= MAX_URL_PARAM;
    window.open(direct ? s.url(q, temporary) : s.base, '_blank', 'noopener');
    if (direct) flash(`${s.name}を開きました。入力欄に指示文が入っていなければ、貼り付け（Ctrl+V／長押し）してください。`, 5000);
    else if (copied) flash(`指示文をコピーしました。開いた${s.name}の入力欄に貼り付けて送信してください。`, 5000);
    else flash('コピーできませんでした。指示文の欄を長押し（またはCtrl+A）で選んでコピーしてください。', 5000);
  }

  // いつも使う AI は人によって違うので、最後に押した AI を覚えて、どの欄でも先頭に大きく出す（この端末の中にだけ残す）
  const PREF_KEY = 'ai-service';
  let pref = 'chatgpt';
  try { pref = SERVICES[localStorage.getItem(PREF_KEY)] ? localStorage.getItem(PREF_KEY) : pref; } catch { /* 覚えられない環境では ChatGPT を先頭に */ }
  const boxes = [...document.querySelectorAll('.ai-launch')];
  const buttons = () => [pref, ...Object.keys(SERVICES).filter((k) => k !== pref)]
    .map((k) => `<button type="button" class="btn btn-small ${k === pref ? 'btn-primary' : ''}" data-ai="${k}">${SERVICES[k].name}で開く</button>`).join('');

  // <div class="ai-launch" data-source="テキストエリアのid"> の中にボタンを並べる（data-compact を付けると、説明を1行にする）
  boxes.forEach((box) => {
    const source = document.getElementById(box.dataset.source);
    box.innerHTML = `
      <div class="ai-buttons">${buttons()}</div>
      ${box.dataset.temporary !== undefined ? '<label class="check temp-chat"><input type="checkbox" checked> ChatGPTでは履歴に残さない「一時チャット」で開く</label>' : ''}
      ${box.dataset.compact !== undefined ? '<p class="hint-sm">指示文をコピーしてAIを開きます。入っていなければ貼り付けて送ってください。</p>' : `<p class="hint-sm">ボタンを押すと、指示文をコピーしてAIを開きます。ChatGPT・Claude・Grok・Perplexityは指示文が入った状態で開きます（ChatGPTとPerplexityはそのまま送られます）。GeminiとCopilotや、入らなかったときは、貼り付けてください。ログインしていないと入力が消えることがあります。最後に使ったAIが、次から先頭に出ます。</p>`}`;
    box.addEventListener('click', (e) => {
      const key = e.target.dataset.ai;
      if (!key || !source.value) return;
      const temp = box.querySelector('.temp-chat input');
      launch(key, source.value, temp ? temp.checked : false);
      if (key === pref) return;
      pref = key;
      try { localStorage.setItem(PREF_KEY, key); } catch { /* この画面の間だけ覚える */ }
      boxes.forEach((b) => { b.querySelector('.ai-buttons').innerHTML = buttons(); });
    });
  });
})();
