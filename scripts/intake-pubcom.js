#!/usr/bin/env node
// 都道府県・政令市のパブリックコメント（意見募集）の案内ページを、公式サイトのトップのリンクから探す。
//   node scripts/intake-pubcom.js            # 都道府県・政令市を探して scripts/.intake-cache/pubcom.json に書く（公開しない）
//   node scripts/intake-pubcom.js --next 30  # まだ pubcom_url がない市区町村を、人口の多い順に30件
// 見つけたものは人が開いて確かめてから yobo.jsonl の pubcom_url に入れる。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/data/sites.js'), 'utf8').replace(/^\s*(const|let)\s+/m, 'var '), ctx);
const SITES = ctx.SITES || ctx.window.SITES || Object.values(ctx).find((v) => v && v['北海道']);
const CITIES = { 北海道: ['札幌市'], 宮城県: ['仙台市'], 埼玉県: ['さいたま市'], 千葉県: ['千葉市'], 神奈川県: ['横浜市', '川崎市', '相模原市'], 新潟県: ['新潟市'], 静岡県: ['静岡市', '浜松市'], 愛知県: ['名古屋市'], 京都府: ['京都市'], 大阪府: ['大阪市', '堺市'], 兵庫県: ['神戸市'], 岡山県: ['岡山市'], 広島県: ['広島市'], 福岡県: ['北九州市', '福岡市'], 熊本県: ['熊本市'] };
const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)', 'Accept-Language': 'ja' } });
    if (r.status >= 400) return { err: 'HTTP ' + r.status };
    const buf = Buffer.from(await r.arrayBuffer()); const ct = r.headers.get('content-type') || '';
    const cs = (ct.match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html; try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : /euc/i.test(cs) ? 'euc-jp' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    const links = [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(([, h, tx]) => { try { return { href: new URL(h, r.url).href, text: strip(tx).slice(0, 80) }; } catch { return null; } }).filter(Boolean);
    return { url: r.url, links, title: strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') };
  } catch (e) { return { err: String(e.name || e) }; } finally { clearTimeout(t); }
}
const PC = /パブリック・?コメント|パブコメ|意見募集|意見公募/;
const BAD = /結果|終了|実施状況|一覧（過去|過去の/;
(async () => {
  const out = [];
  const targets = [];
  const ni = process.argv.indexOf('--next');
  if (ni > 0) {
    const rows = fs.readFileSync(path.join(ROOT, 'site/data/intake/yobo.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    rows.filter((r) => r.level === 'municipality' && !r.pubcom_url).sort((a, b) => (b.population || 0) - (a.population || 0))
      .slice(0, +process.argv[ni + 1] || 30).forEach((r) => targets.push([r.pref, r.name]));
  } else for (const p of Object.keys(SITES)) { targets.push([p, '@']); for (const c of CITIES[p] || []) targets.push([p, c]); }
  for (const [p, c] of targets) {
    const top = (SITES[p][c] || [])[0];
    const g = top ? await get(top) : { err: 'no top' };
    let hits = (g.links || []).filter((l) => PC.test(l.text) && !BAD.test(l.text));
    let via = 'top';
    if (!hits.length && g.links) { // 1段だけ「市政・県政」系のページをたどる
      for (const l of g.links.filter((l) => /(市政|区政|県政|府政|都政|道政)(情報)?$|広聴|意見・提案|ご意見|参加|参画/.test(l.text)).slice(0, 3)) {
        const g2 = await get(l.href); const h = (g2.links || []).filter((x) => PC.test(x.text) && !BAD.test(x.text));
        if (h.length) { hits = h; via = l.href; break; }
      }
    }
    const cand = hits[0] ? await get(hits[0].href) : null;
    out.push({ id: `${p}/${c}`, top, err: g.err, via, cands: hits.slice(0, 4), title: cand && cand.title, final: cand && cand.url });
    console.log(`${p}/${c}\t${hits[0] ? hits[0].text + '\t' + (cand && cand.url) + '\t' + (cand && cand.title) : 'なし ' + (g.err || '')}`);
  }
  fs.writeFileSync(path.join(__dirname, '.intake-cache/pubcom.json'), JSON.stringify(out, null, 1));
})();
