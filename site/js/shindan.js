// 「比較表」（/#compare）へのリンクで来たときは、よくある質問の中の表を開く
(() => {
  const open = () => {
    if (location.hash !== '#compare') return;
    const t = document.querySelector(location.hash);
    const d = t && (t.matches('details') ? t : t.querySelector('details'));
    if (d) d.open = true;
  };
  open();
  window.addEventListener('hashchange', open);
})();
