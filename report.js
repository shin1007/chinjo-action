// 提出の報告と、議会ごとの報告件数。Supabase に直接つなぐ（個人情報は送らない：都道府県名と議会名だけ）。
// URL とキーが空のあいだは、報告の機能は出さない。キーは公開してよい publishable キー。
window.Report = (() => {
  const URL = 'https://oquuysfeistgpgrpeswq.supabase.co';
  const KEY = 'sb_publishable_IAXFoFaXZ3bjk-49Z-pD9w_SQZEgzXE';
  // 制作中は止めておく（いたずらで件数が増えないように）。公開するときに false にする
  const PAUSED = true;
  const enabled = !PAUSED && !!(URL && KEY);
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };

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

  async function report(id) {
    if (!enabled) return false;
    if (reported(id)) return true;
    const i = id.indexOf('/');
    const r = await fetch(`${URL}/rest/v1/reports`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pref: id.slice(0, i), council: id.slice(i + 1) }),
    }).catch(() => null);
    if (!r || !r.ok) return false;
    counts.set(id, (counts.get(id) || 0) + 1);
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...done(), id])); } catch { /* 覚えられなくても報告はできている */ }
    return true;
  }

  return { enabled, loaded, count: (id) => counts.get(id) || 0, prefCount: (pref) => [...counts].filter(([k]) => k.startsWith(`${pref}/`)).length, reported, report };
})();
