// 応援の段階ごとの目標と、到達割合・あといくらの計算（表示とは分けて、テストできるようにしている）。
/* global module */
(() => {
  const isAmount = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

  // 段階ごとの目標（goal は、その月の応援の合計がいくらに届けば達成か。次の段階の goal は前より大きい）。
  // 金額と段階が不正なら null を返し、集まり具合は出さない
  const plan = (data) => {
    if (!data || !isAmount(data.collected) || !Array.isArray(data.stages)) return null;
    const stages = data.stages.filter((st) => st && typeof st.name === 'string' && isAmount(st.goal) && st.goal > 0);
    if (!stages.length || stages.length !== data.stages.length) return null;
    for (let i = 1; i < stages.length; i += 1) if (stages[i].goal <= stages[i - 1].goal) return null;
    const collected = data.collected;
    const index = stages.findIndex((st) => collected < st.goal);
    const current = index === -1 ? null : stages[index];
    const next = index === -1 ? null : stages[index + 1] || null;
    return {
      collected,
      stages: stages.map((st, i) => ({ ...st, state: index === -1 || i < index ? 'done' : i === index ? 'current' : 'next' })),
      current,
      next,
      pct: current ? Math.min(100, Math.floor((collected / current.goal) * 100)) : 100,
      remaining: current ? current.goal - collected : 0,
      remainingNext: next ? next.goal - collected : 0,
    };
  };

  const api = { plan };
  if (typeof window !== 'undefined') window.SupportPlan = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
