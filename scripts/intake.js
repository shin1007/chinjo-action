#!/usr/bin/env node
// 陳情（議会）と要望（首長）の受け付け方のデータベースを扱う。
// データの本体は site/data/intake/chinjo.jsonl と yobo.jsonl（1行1自治体）。形は site/data/intake/README.md。
//
//   node scripts/intake.js migrate [--force]  今ある mail.js・councils.js・request-pages.js などから作る（最初の1回だけ）
//   node scripts/intake.js check              形を確かめる（npm test からも呼ぶ）
//   node scripts/intake.js population         人口を municipality-populations.json で入れ直す
//   node scripts/intake.js stats              どこまで埋まったかを数える
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'data');
const DIR = path.join(DATA, 'intake');
const FILES = { chinjo: path.join(DIR, 'chinjo.jsonl'), yobo: path.join(DIR, 'yobo.jsonl') };

const METHODS = ['hand', 'mail', 'email', 'form', 'fax'];
// 陳情：review 審査する／distribute 配付・閲覧だけ／accept 受け付けるが扱いは書いていない／no 受け付けない／unknown
// 要望：accept 受け付ける／no 受け付けない／unknown
const VALUES = {
  chinjo: new Set(['review', 'distribute', 'accept', 'no', 'unknown']),
  yobo: new Set(['accept', 'no', 'unknown']),
};
const ROUTES = new Set(['official_site', 'office_reply', 'user_tip', 'auto_extract']);
const CONFIDENCE = new Set(['confirmed', 'likely', 'unknown']);
const TRI = new Set(['yes', 'no', 'unknown']);

function loadWindow(files) {
  global.window = {};
  for (const f of files) require(path.join(DATA, f));
  return global.window;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`${path.basename(file)}:${i + 1} JSONとして読めない: ${e.message}`); }
  });
}

function writeJsonl(file, rows) {
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function populations() {
  const p = require(path.join(DATA, 'municipality-populations.json'));
  return { asOf: p.asOf, get: (pref, key) => p.populations[`${pref}|${key === '@' ? '都道府県議会' : key}`] ?? null };
}

function blankMethods() {
  const m = {};
  for (const k of METHODS) m[k] = { resident: 'unknown', nonresident: 'unknown' };
  return m;
}

function baseRecord(pref, key, pop) {
  return {
    id: `${pref}/${key}`,
    pref,
    name: key === '@' ? pref : key,
    level: key === '@' ? 'pref' : 'municipality',
    population: pop.get(pref, key),
    population_as_of: pop.asOf,
    methods: blankMethods(),
  };
}

function readUnresolved() {
  const file = path.join(ROOT, 'docs', '確認用', '郵送の扱いが不明な議会.csv');
  const out = {};
  if (!fs.existsSync(file)) return out;
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1);
  for (const l of lines) {
    const c = l.split(',');
    if (!c[0] || !c[0].startsWith('1')) continue;
    out[`${c[1]}|${c[2].replace(/議会$/, '')}`] = c[8] || '';
  }
  return out;
}

function migrate(force) {
  if (!force && (fs.existsSync(FILES.chinjo) || fs.existsSync(FILES.yobo))) {
    console.error('すでにあります。作り直すときは --force（手で足した分は消えます）');
    process.exit(1);
  }
  const w = loadWindow(['municipalities.js', 'mail.js', 'mail-policy.js', 'councils.js', 'request-pages.js']);
  const pop = populations();
  const unresolved = readUnresolved();
  const chinjo = [];
  const yobo = [];

  for (const pref of Object.keys(w.MUNICIPALITIES)) {
    for (const key of ['@', ...w.MUNICIPALITIES[pref]]) {
      const councilName = key === '@' ? `${pref}議会` : `${key}議会`;
      // ---- 陳情（議会）
      const c = { ...baseRecord(pref, key, pop), to: councilName, sources: [] };
      const mail = ((w.MAIL || {})[pref] || {})[key];
      if (mail) {
        const [kind, quote, url] = mail;
        const m = c.methods;
        if (kind === 'ok') m.mail = { resident: 'review', nonresident: 'review' };
        if (kind === 'outside') m.mail = { resident: 'review', nonresident: 'distribute' };
        if (kind === 'jisan') { m.mail = { resident: 'distribute', nonresident: 'distribute' }; m.hand.resident = 'review'; }
        if (kind === 'none') {
          m.mail = { resident: 'distribute', nonresident: 'distribute' };
          m.hand = { resident: 'distribute', nonresident: 'distribute' };
        }
        c.page_url = url;
        c.sources.push({ fields: ['methods.mail', 'methods.hand'], quote, url, checked_at: '2026-11-05', route: 'official_site', confidence: 'confirmed', from: `mail.js:${kind}` });
      }
      const pol = window.MailPolicy && window.MailPolicy.valid(((w.MAIL_POLICY || {})[pref] || {})[key]) ? w.MAIL_POLICY[pref][key] : null;
      if (pol) {
        c.methods.mail = { resident: pol.mail_resident === 'ok' ? 'review' : pol.mail_resident, nonresident: pol.mail_nonresident === 'ok' ? 'review' : pol.mail_nonresident };
        if (pol.hand_nonresident !== 'unknown') c.methods.hand.nonresident = pol.hand_nonresident === 'ok' ? 'review' : pol.hand_nonresident;
        c.sources.push({ fields: ['methods.mail', 'methods.hand'], quote: pol.source_quote, url: pol.source_url, checked_at: pol.verified_at, route: 'official_site', confidence: pol.confidence, from: 'mail-policy.js' });
      }
      const co = ((w.COUNCILS || {})[pref] || {})[key] || {};
      if (co.deadline) { c.deadline = co.deadline; c.sources.push({ fields: ['deadline'], quote: co.deadline, url: '', checked_at: '2026-11-04', route: 'auto_extract', confidence: 'likely', from: 'councils.js' }); }
      if (co.denshi) {
        if (c.methods.form.resident === 'unknown') c.methods.form = { resident: 'accept', nonresident: 'unknown' };
        c.sources.push({ fields: ['methods.form'], quote: '（案内ページに電子申請の記載あり）', url: '', checked_at: '2026-11-04', route: 'auto_extract', confidence: 'likely', from: 'councils.js' });
      }
      for (const [f, label] of [['yusoNote', 'methods.mail'], ['outsideNote', 'methods.mail']]) {
        if (co[f]) c.sources.push({ fields: [label], quote: co[f], url: '', checked_at: '2026-11-04', route: 'auto_extract', confidence: 'unknown', from: `councils.js:${f}` });
      }
      const ur = unresolved[`${pref}|${key === '@' ? pref : key}`];
      if (ur !== undefined && !mail) c.unresolved = ur || '調べたが判定できず';
      chinjo.push(c);

      // ---- 要望（首長）
      const y = { ...baseRecord(pref, key, pop), to: key === '@' ? `${pref}知事` : `${key}長`, sources: [] };
      for (const k of METHODS) y.methods[k] = { resident: 'unknown', nonresident: 'unknown' };
      const rp = (w.REQUEST_PAGES || {})[`${pref}/${key}`];
      if (rp) {
        y.page_url = rp[0];
        y.page_title = rp[1];
        y.sources.push({ fields: ['page_url'], quote: rp[1], url: rp[0], checked_at: '2026-11-11', route: 'auto_extract', confidence: 'likely', from: 'request-pages.js' });
      }
      yobo.push(y);
    }
  }
  fs.mkdirSync(DIR, { recursive: true });
  writeJsonl(FILES.chinjo, chinjo);
  writeJsonl(FILES.yobo, yobo);
  console.log(`陳情 ${chinjo.length} 件・要望 ${yobo.length} 件を書いた`);
}

function checkKind(kind) {
  const rows = readJsonl(FILES[kind]);
  const errs = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const at = `${kind}.jsonl:${i + 1}（${r.id}）`;
    if (!r.id || seen.has(r.id)) errs.push(`${at} id がないか重複`);
    seen.add(r.id);
    if (r.id !== `${r.pref}/${r.level === 'pref' ? '@' : r.name}`) errs.push(`${at} id と pref・name が合わない`);
    if (r.population !== null && !Number.isInteger(r.population)) errs.push(`${at} population が整数でない`);
    for (const m of METHODS) {
      const v = r.methods && r.methods[m];
      if (!v) { errs.push(`${at} methods.${m} がない`); continue; }
      for (const who of ['resident', 'nonresident']) if (!VALUES[kind].has(v[who])) errs.push(`${at} methods.${m}.${who} が「${v[who]}」`);
    }
    for (const f of ['anonymous_ok', 'name_published', 'statement', 'result_notice', 'reply']) {
      if (r[f] !== undefined && !TRI.has(r[f])) errs.push(`${at} ${f} が「${r[f]}」`);
    }
    if (!Array.isArray(r.sources)) errs.push(`${at} sources がない`);
    else r.sources.forEach((s, j) => {
      if (!ROUTES.has(s.route)) errs.push(`${at} sources[${j}].route が「${s.route}」`);
      if (!CONFIDENCE.has(s.confidence)) errs.push(`${at} sources[${j}].confidence が「${s.confidence}」`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.checked_at || '')) errs.push(`${at} sources[${j}].checked_at が日付でない`);
      if (s.route === 'official_site' && !s.url) errs.push(`${at} sources[${j}] 公式サイトなのに url がない`);
    });
    // 値が unknown 以外なのに根拠がないものは不可
    const known = METHODS.some((m) => r.methods && r.methods[m] && (r.methods[m].resident !== 'unknown' || r.methods[m].nonresident !== 'unknown'));
    if (known && !(r.sources || []).some((s) => (s.fields || []).some((f) => f.startsWith('methods')))) errs.push(`${at} 出し方の値に根拠（sources）がない`);
  });
  return { rows, errs };
}

function check() {
  let bad = 0;
  for (const kind of ['chinjo', 'yobo']) {
    const { rows, errs } = checkKind(kind);
    errs.slice(0, 50).forEach((e) => console.error(e));
    bad += errs.length;
    if (!errs.length) console.log(`${kind}: ${rows.length} 件 OK`);
  }
  if (bad) process.exit(1);
}

function population() {
  const pop = populations();
  for (const kind of ['chinjo', 'yobo']) {
    const rows = readJsonl(FILES[kind]);
    for (const r of rows) {
      r.population = pop.get(r.pref, r.level === 'pref' ? '@' : r.name);
      r.population_as_of = pop.asOf;
    }
    writeJsonl(FILES[kind], rows);
  }
  console.log(`人口を ${pop.asOf} 時点に入れ直した`);
}

function stats() {
  for (const kind of ['chinjo', 'yobo']) {
    const rows = readJsonl(FILES[kind]);
    console.log(`\n## ${kind}（${rows.length} 件）`);
    for (const m of METHODS) {
      const c = {};
      for (const r of rows) { const v = r.methods[m]; const k = `${v.resident}/${v.nonresident}`; c[k] = (c[k] || 0) + 1; }
      console.log(m.padEnd(6), Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join('  '));
    }
    const routes = {};
    for (const r of rows) for (const s of r.sources) routes[s.route] = (routes[s.route] || 0) + 1;
    console.log('根拠の経路', routes, '判定できず', rows.filter((r) => r.unresolved).length);
  }
}

module.exports = { checkKind, METHODS, FILES };

if (require.main === module) {
  const [cmd, opt] = process.argv.slice(2);
  if (cmd === 'migrate') migrate(opt === '--force');
  else if (cmd === 'check') check();
  else if (cmd === 'population') population();
  else if (cmd === 'stats') stats();
  else { console.error('使い方: node scripts/intake.js migrate|check|population|stats'); process.exit(1); }
}
