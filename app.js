// テーマのトップページ：文例のコピーと、SNSでの共有
(() => {
  const { copy } = window.Common;

  // かんたん作成は /テーマ/make に移した。前に配ったリンク（#w?… や #generator）はそちらへ送る
  if (/^#(w\?|generator$)/.test(location.hash)) {
    location.replace(`${location.pathname.replace(/\/(index(\.html)?)?$/, '')}/make${location.hash.startsWith('#w?') ? location.hash : ''}`);
    return;
  }
  // かんたん作成のページから「議員への手紙をつくる」で来たら、閉じてある手紙の欄を開く
  if (location.hash === '#letter') document.getElementById('letterFold')?.setAttribute('open', '');

  document.querySelectorAll('[data-template="mp"]').forEach((b) =>
    b.addEventListener('click', () => copy(window.THEME.mpTemplate, '文例をコピーしました'))
  );

  const url = encodeURIComponent(location.href.split('#')[0]);
  const text = encodeURIComponent(window.THEME.shareText);
  const shareX = document.getElementById('shareX');
  const shareLine = document.getElementById('shareLine');
  if (shareX) shareX.href = `https://x.com/intent/post?text=${text}&url=${url}`;
  if (shareLine) shareLine.href = `https://social-plugins.line.me/lineit/share?url=${url}`;
})();
