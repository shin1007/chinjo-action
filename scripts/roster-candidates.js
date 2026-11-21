#!/usr/bin/env node
// 議員の名前の「候補」を、名簿のページ以外から集める。
//   node scripts/roster-candidates.js   … scripts/roster-candidates/discussvision.json を作り直す
// 集め方：多くの議会が使う議会中継のシステム（DiscussVision の「スマート中継」）の発言者の一覧。
//   議会が自分で載せているものだが、前の議員が残っていることがある（「（～令和5年5月1日）」と書かれたものは落とす）。
//   そのため、ここで集めた名前はそのままは使わない。scripts/roster-names.js が、議会の名簿のページ（一次資料）に
//   その名前が書いてあるかを確かめ、書いてあった名前だけを使う。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'roster-candidates', 'discussvision.json');
const B = 'https://smart.discussvision.net/dvsapi/';
const MAX_ID = Number(process.argv[2] || 1200);

const M = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'data', 'municipalities.js'), 'utf8').replace(/^[\s\S]*?=\s*/, '').replace(/;\s*$/, ''));

async function get(u) {
  for (let k = 0; k < 3; k++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    try { return await (await fetch(B + u, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)' } })).json(); } catch { /* もう一度 */ } finally { clearTimeout(t); }
  }
  return null;
}

// 「香川県議会　県議会インターネット中継」「高浜市議会　議会中継」→ 議会の id（同じ名前の市町村が2つ以上あれば使わない）
function councilId(title) {
  const t = title.replace(/[\s　]/g, '');
  const p = t.match(/^(.+?[都道府県])議会/);
  if (p && M[p[1]]) return `${p[1]}/@`;
  const hits = [];
  for (const pref in M) for (const c of M[pref]) {
    const short = c.replace(/^.+?郡/, '');
    if (t.startsWith(`${pref}${short}議会`) || t.startsWith(`${pref}${c}議会`)) hits.push(`${pref}/${c}`);
    else if (t.startsWith(`${short}議会`)) hits.push(`${pref}/${c}`);
  }
  const withPref = hits.filter((h) => t.startsWith(h.split('/')[0]));
  const list = withPref.length ? withPref : hits;
  return list.length === 1 ? list[0] : null;
}

async function main() {
  const found = {};
  let id = 1;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (id <= MAX_ID) {
      const tenant = id++;
      const info = await get(`tenant/all?tenant_id=${tenant}`);
      if (!info || !info.title) continue;
      const cid = councilId(info.title);
      if (!cid) continue;
      const names = new Map();
      for (let i = 0; i <= 12; i++) {
        const r = await get(`speaker/list?tenant_id=${tenant}&search_index=${i}`);
        for (const s of (r && r.speaker_list) || []) {
          const n = String((s.details && s.details[0]) || s.name || '').trim();
          if (!n || /[0-9０-９]/.test(n) || !/[一-龥ぁ-んァ-ヶ]/.test(n) || /[～~]/.test(n) || /[（(]/.test(n)) continue; // 前の議員・肩書きつき
          names.set(s.speaker_id, n.replace(/[\s　]+/g, ' '));
        }
      }
      if (names.size < 5) continue;
      // 同じ議会がテスト用などで2つ以上あるときは、名前の多いほう
      if (!found[cid] || found[cid].names.length < names.size) found[cid] = { tenant, title: info.title.trim(), names: [...names.values()] };
    }
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const sorted = Object.fromEntries(Object.keys(found).sort().map((k) => [k, found[k]]));
  fs.writeFileSync(OUT, JSON.stringify({ source: 'https://smart.discussvision.net/ の発言者の一覧', fetched_at: new Date().toISOString().slice(0, 10), councils: sorted }, null, 0).replace(/,"(?=[^"]+\/[^"]*":\{)/g, ',\n"') + '\n');
  console.error(`${Object.keys(found).length} 議会の候補`);
}
main();
