#!/usr/bin/env node
// ページの速さを Lighthouse（スマホ想定）で測って表にする。
//   npm run speed                 … 主なページを測る
//   npm run speed -- about kodomo/make … 指定したページだけ（先頭の / は付けない。Git Bash が / をパスに変えてしまうため）
// 手元で site/ を配って測る（本番は叩かない）。Lighthouse と配信用のサーバーは npx で一時的に使うので、依存には足さない。
// 結果は scripts/.speed/ に JSON で残る（Git には入れない）。前回の結果があれば差も出す。
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, '.speed');
const PORT = 8799;
const PAGES = ['/', '/letter', '/kodomo', '/kodomo/make', '/kodomo/guide', '/feedback'];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const pages = process.argv.slice(2).map((a) => `/${a.replace(/^\/+/, '')}`.replace(/^\/index$/, '/'));
const targets = pages.length ? pages : PAGES;
// cleanUrls（/about → about.html）に合わせて、ファイルの名前に直す
const fileOf = (p) => (p === '/' ? '/index.html' : fs.existsSync(path.join(ROOT, 'site', `${p}.html`)) ? `${p}.html` : `${p}/index.html`);
const nameOf = (p) => (p === '/' ? 'index' : p.slice(1).replace(/\//g, '_'));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(npx, ['-y', 'http-server', path.join(ROOT, 'site'), '-p', String(PORT), '-s', '-c-1'], { shell: process.platform === 'win32' });
  await new Promise((r) => setTimeout(r, 3000));
  const rows = [];
  try {
    for (const p of targets) {
      const file = path.join(OUT, `${nameOf(p)}.json`);
      const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      execFileSync(npx, ['-y', 'lighthouse', `http://localhost:${PORT}${fileOf(p)}`, '--quiet', '--only-categories=performance,accessibility,best-practices',
        '--chrome-flags=--headless=new', '--output=json', `--output-path=${file}`], { stdio: 'ignore', shell: process.platform === 'win32' });
      const r = JSON.parse(fs.readFileSync(file, 'utf8'));
      const kb = (x) => Math.round(x.audits['total-byte-weight'].numericValue / 1024);
      const lcp = (x) => x.audits['largest-contentful-paint'].numericValue / 1000;
      const perf = (x) => Math.round(x.categories.performance.score * 100);
      const diff = (a, b, unit = '') => (prev ? ` (${a - b >= 0 ? '+' : ''}${Math.round((a - b) * 10) / 10}${unit})` : '');
      const errors = (r.audits['errors-in-console'].details?.items || []).length;
      rows.push([p, `${perf(r)}${diff(perf(r), prev && perf(prev))}`, `${lcp(r).toFixed(1)}秒${diff(lcp(r), prev && lcp(prev))}`,
        `${kb(r)}KB${diff(kb(r), prev && kb(prev))}`, Math.round(r.categories.accessibility.score * 100), errors]);
    }
  } finally {
    // Windows では shell の下に立ったサーバーまで止める
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* もう止まっている */ } } else server.kill();
  }
  console.log('| ページ | 性能 | 表示まで(LCP) | 転送量 | アクセシビリティ | コンソールのエラー |\n|---|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.join(' | ')} |`));
  console.log('\n（スマホ想定・回線を遅くした状態の値。カッコは前回からの差。/api/ は手元にないので、それによるエラーは本番では出ない）');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
