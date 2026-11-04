// 生成AIを開くボタン。指示文を必ずクリップボードにコピーし、URLで渡せるサービスには入力済みの状態で開く。
// URLで渡す方法は各サービスの非公式な仕様なので、入らなかったときは貼り付けてもらう。
(() => {
  // エンコード後の長さがこれを超えるとURLが長すぎて開けないことがあるため、貼り付けに切り替える
  const MAX_URL_PARAM = 30000;

  const SERVICES = {
    chatgpt: { name: 'ChatGPT', base: 'https://chatgpt.com/', url: (q, temp) => `https://chatgpt.com/?q=${q}${temp ? '&temporary-chat=true' : ''}` },
    claude: { name: 'Claude', base: 'https://claude.ai/new', url: (q) => `https://claude.ai/new?q=${q}` },
    gemini: { name: 'Gemini', base: 'https://gemini.google.com/app' },
    copilot: { name: 'Copilot', base: 'https://copilot.microsoft.com/', url: (q) => `https://copilot.microsoft.com/?q=${q}` },
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

  // <div class="ai-launch" data-source="テキストエリアのid"> の中にボタンを並べる
  document.querySelectorAll('.ai-launch').forEach((box) => {
    const source = document.getElementById(box.dataset.source);
    box.innerHTML = `
      <div class="ai-buttons">
        ${Object.entries(SERVICES).map(([k, s]) => `<button type="button" class="btn btn-small ${k === 'chatgpt' ? 'btn-primary' : ''}" data-ai="${k}">${s.name}で開く</button>`).join('')}
      </div>
      ${box.dataset.temporary !== undefined ? '<label class="check temp-chat"><input type="checkbox" checked> ChatGPTでは履歴に残さない「一時チャット」で開く</label>' : ''}
      <p class="hint-sm">ボタンを押すと、指示文をコピーしてAIを開きます。ChatGPT・Claude・Copilotは入力欄に指示文が入った状態で開きます（入らない場合やGeminiでは、貼り付けてください）。ログインしていないと入力が消えることがあります。</p>`;
    box.addEventListener('click', (e) => {
      const key = e.target.dataset.ai;
      if (!key || !source.value) return;
      const temp = box.querySelector('.temp-chat input');
      launch(key, source.value, temp ? temp.checked : false);
    });
  });
})();
