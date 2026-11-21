#!/usr/bin/env node
// 名前の候補（scripts/roster-candidates/discussvision.json）がいちばん多く書いてある公式サイトのページを探し、
// その議会の議員名簿のページとして site/data/roster.json に書く（名簿のページが見つからない・読めない議会のため）。
//   node scripts/roster-find-by-names.js              … 名前をまだ出せていない、候補のある議会を全部
//   node scripts/roster-find-by-names.js 千葉県/松戸市 --dry … 1件だけ。書かずに見せる
// 探し方：今の名簿のページ・陳情の案内ページ・議会のページ・公式サイトから、同じサイトの中で「議員」「名簿」「会派」などの
// リンクを2段までたどる（PDF も読む）。1つのページに候補の名前が多く書いてあれば、そのページを名簿とみなす。
// そのあと node scripts/roster-names.js --only <id> で、そのページに書いてある名前だけを出す。
'use strict';
const fs = require('fs');
const path = require('path');
const { html, baseOf } = require('./roster-names.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const CAND = JSON.parse(fs.readFileSync(path.join(__dirname, 'roster-candidates', 'discussvision.json'), 'utf8')).councils;
const roster = JSON.parse(fs.readFileSync(path.join(DATA, 'roster.json'), 'utf8'));
global.window = {};
require(path.join(DATA, 'sites.js'));
const SITES = window.SITES;
const have = {};
for (const f of fs.readdirSync(path.join(DATA, 'roster'))) if (!f.startsWith('.')) Object.assign(have, JSON.parse(fs.readFileSync(path.join(DATA, 'roster', f), 'utf8')));

const flat = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<rt>[\s\S]*?<\/rt>/gi, '').replace(/<img[^>]*\balt=["']([^"']+)["'][^>]*>/gi, '|$1|').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, '')
  .replace(/[\s　]+/g, '').replace(/[﨑]/g, '崎').replace(/[髙]/g, '高').replace(/󠄀/g, '');
const FOLLOW = /議員|名簿|会派|議会|議席|紹介/;
const NOT = /会議録|中継|映像|報酬|政務活動|資産|歴代|元議員|選挙|英語|English|中文|한국|委員会/;
const PRIOR = /名簿|議員一覧|議員紹介|議員の紹介|議員の一覧/;

async function find(id) {
  const c = CAND[id];
  const [pref, muni] = id.split('/');
  const starts = [roster[id] && roster[id].url, ...[...((SITES[pref] || {})[muni] || [])].reverse()].filter((u) => typeof u === 'string' && /^https?:/.test(u));
  if (!starts.length) return { id, cand: c.names.length, error: '公式サイトがわからない' };
  const base = new URL(starts[starts.length - 1]).host.replace(/^www\./, '');
  const names = c.names.map(flat);
  const seen = new Set();
  const queue = starts.map((u) => ({ u, d: 0, pri: 1 }));
  let best = { n: 0 };
  let opened = 0;
  while (queue.length && opened < 45) {
    queue.sort((a, b) => b.pri - a.pri || a.d - b.d);
    const { u, d } = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    opened++;
    const p = await html(u);
    const body = p.text != null ? p.text : p.html;
    if (!body) continue;
    const t = flat(body);
    const hit = names.filter((f) => t.includes(f)).length;
    if (hit > best.n) best = { n: hit, url: u };
    if (!p.html || d >= 2) continue;
    for (const [, h, txt] of p.html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = txt.replace(/<[^>]+>/g, '').trim();
      if (!FOLLOW.test(label) || NOT.test(label)) continue;
      let v;
      try { v = new URL(h.replace(/&amp;/g, '&'), baseOf(p.html, u)); } catch { continue; }
      if (!/^https?:$/.test(v.protocol) || !v.host.replace(/^www\./, '').endsWith(base)) continue;
      if (!seen.has(v.href)) queue.push({ u: v.href, d: d + 1, pri: PRIOR.test(label) ? 2 : /議員/.test(label) ? 1 : 0 });
    }
  }
  return { id, cand: c.names.length, ...best };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  const ids = args.length ? args : Object.keys(CAND).filter((id) => !have[id]);
  const out = [];
  const q = [...ids];
  await Promise.all(Array.from({ length: 6 }, async () => { for (let id; (id = q.shift());) out.push(await find(id)); }));
  let n = 0;
  for (const r of out.sort((a, b) => a.id.localeCompare(b.id))) {
    const ok = r.url && r.n >= 8 && r.n >= r.cand * 0.8 && !/shisatu|houkoku|kekka|sanpi|iinkai/i.test(r.url);
    console.log(ok ? 'OK' : '--', r.id, `${r.n || 0}/${r.cand}`, r.url || r.error || '');
    if (ok && !dry && (!roster[r.id] || roster[r.id].url !== r.url)) {
      roster[r.id] = { url: r.url, title: '議員名簿（議会中継の発言者の名前が多く書いてあるページ）', found_at: new Date().toISOString().slice(0, 10) };
      n++;
    }
  }
  if (!dry) {
    const keys = Object.keys(roster).sort();
    fs.writeFileSync(path.join(DATA, 'roster.json'), `{${keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(roster[k])}`).join(',\n')}}\n`);
    console.error(`${n} 件の名簿のページを書いた`);
  }
}
main();
