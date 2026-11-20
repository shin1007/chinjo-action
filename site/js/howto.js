// トップページ（/）の紹介GIF。開くたびに最初から再生する。
// GIF は1回だけ読み込んで取っておき、開くたびに新しい blob の URL を作って入れ直す（同じ URL のままだと続きから流れる）。
// 縦長の画面（スマホ）では縦長の GIF を使う。
(() => {
  const box = document.querySelector('.lead-howto');
  if (!box) return;
  const img = box.querySelector('img');
  const tall = window.matchMedia('(orientation: portrait) and (max-width: 700px)');
  const cache = {};
  let current = '';
  const pick = () => (tall.matches ? { src: '/img/mail-howto-tall.gif', w: 540, h: 960 } : { src: '/img/mail-howto.gif', w: 960, h: 540 });
  async function play() {
    const g = pick();
    img.width = g.w;
    img.height = g.h;
    try {
      cache[g.src] = cache[g.src] || await fetch(g.src).then((r) => r.blob());
      if (current) URL.revokeObjectURL(current);
      current = URL.createObjectURL(cache[g.src]);
      img.src = current;
    } catch {
      img.src = `${g.src}?t=${Date.now()}`; // 読み込めないときは、URL を変えて読み直す
    }
  }
  box.addEventListener('toggle', () => { if (box.open) play(); });
})();
