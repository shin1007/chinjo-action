// 提出の報告と、議会ごとの報告件数。Supabase に直接つなぐ（個人情報は送らない：都道府県名・議会名・陳情の項目数だけ）。
// URL とキーが空のあいだは、報告の機能は出さない。キーは公開してよい publishable キー。
window.Report = (() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  // 制作中は止めておく（いたずらで件数が増えないように）。公開するときに false にする
  const PAUSED = false;
  const enabled = !PAUSED && !!(URL && KEY);
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  // 出した陳情の内容（「テーマ/項目id」）も送り、議会ごとに「同じ内容がもう出ているか」を出す。
  // supabase/schema.sql の reports.asks 列と council_asks ビューを反映してから true にする
  const ASKS_LIVE = true;
  const ASK_RE = /^[a-z]+\/[a-z0-9_]+$/;

  // 「都道府県/議会名」→ 件数。読めなかったときは空のまま（報告の数が出ないだけ）
  let counts = new Map();
  const loaded = !enabled ? Promise.resolve(counts)
    : fetch(`${URL}/rest/v1/council_counts?select=pref,council,n`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => (counts = new Map(rows.map((r) => [`${r.pref}/${r.council}`, r.n]))))
      .catch(() => counts);

  // 同じ端末から同じ議会を二度数えないよう、報告済みの議会を覚えておく
  const DONE_KEY = window.THEME.key('reported');
  const done = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) || []; } catch { return []; } };
  const reported = (id) => done().includes(id);

  // 「都道府県/議会名」→ [{ ask: 'テーマ/項目id', n, last }]
  const asksMap = new Map();
  const asksLoaded = !(enabled && ASKS_LIVE) ? Promise.resolve(asksMap)
    : fetch(`${URL}/rest/v1/council_asks?select=pref,council,ask,n,last`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { rows.forEach((r) => { const k = `${r.pref}/${r.council}`; asksMap.set(k, [...(asksMap.get(k) || []), r]); }); return asksMap; })
      .catch(() => asksMap);
  const asked = (id) => asksMap.get(id) || [];

  // いたずら対策の計算：sha256(都道府県|議会名|UTCの日付|答え) の16進の頭が 0000 になる答えを探す（ふつうは1〜3秒）
  async function solve(pref, council) {
    const day = new Date().toISOString().slice(0, 10);
    const enc = new TextEncoder();
    for (let i = 0; i < 5000000; i += 1) {
      const s = i.toString(36);
      const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${pref}|${council}|${day}|${s}`)));
      if (h[0] === 0 && h[1] === 0) return s;
    }
    return null;
  }

  async function report(id, items, asks = []) {
    if (!enabled) return false;
    if (reported(id)) return true;
    const i = id.indexOf('/');
    const pow = await solve(id.slice(0, i), id.slice(i + 1));
    if (!pow) return false;
    const r = await fetch(`${URL}/rest/v1/reports`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pref: id.slice(0, i), council: id.slice(i + 1), ...(Number.isInteger(items) && items >= 1 && items <= 50 ? { items } : {}), ...(ASKS_LIVE && asks.length ? { asks: asks.filter((a) => ASK_RE.test(a)).slice(0, 10) } : {}), pow }),
    }).catch(() => null);
    if (!r || !r.ok) return false;
    counts.set(id, (counts.get(id) || 0) + 1);
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...done(), id])); } catch { /* 覚えられなくても報告はできている */ }
    return true;
  }

  // 議会の扱いを教えてもらう（議会の手続きの情報だけ。陳情の文面・氏名・住所は送らない）。
  // 提出の報告と違って件数を見せないので、制作中の止めとは別に動かす
  const tipsEnabled = !!(URL && KEY);
  async function tip(id, fields) {
    if (!tipsEnabled) return false;
    const i = id.indexOf('/');
    const r = await fetch(`${URL}/rest/v1/council_tips`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pref: id.slice(0, i), council: id.slice(i + 1), ...fields }),
    }).catch(() => null);
    return !!(r && r.ok);
  }

  return { enabled, asksLive: enabled && ASKS_LIVE, asksLoaded, asked, tipsEnabled, tip, loaded, count: (id) => counts.get(id) || 0, prefCount: (pref) => [...counts].filter(([k]) => k.startsWith(`${pref}/`)).length, reported, report };
})();
