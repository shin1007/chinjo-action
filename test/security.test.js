// セキュリティまわりの静的な検査。CSP・HTML・禁止する API・同梱ライブラリ・Supabase の権限。
// 振る舞いそのものの検証（RLS が実際に効くか）はここではできない。SQL は書かれた権限の形だけを見る。
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const walk = (dir, ext, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') walk(p, ext, out); } else if (ext.test(e.name)) out.push(p);
  }
  return out;
};
const rel = (p) => path.relative(ROOT, p);
const htmls = walk(SITE, /\.html$/);
const jss = walk(path.join(SITE, 'js'), /\.js$/);

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const headers = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]));
const csp = Object.fromEntries(headers['Content-Security-Policy'].split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));

test('CSP：スクリプトは自分のドメインだけ。unsafe-inline・unsafe-eval・ワイルドカードを許さない', () => {
  assert.deepStrictEqual(csp['script-src'], ["'self'"]);
  assert.deepStrictEqual(csp['default-src'], ["'self'"]);
  for (const [k, v] of Object.entries(csp)) {
    assert.ok(!v.some((x) => /unsafe-|^\*$|^https?:$/.test(x)), `${k} が広すぎる: ${v}`);
  }
  assert.deepStrictEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepStrictEqual(csp['frame-src'], ["'none'"]);
  assert.deepStrictEqual(csp['base-uri'], ["'self'"]);
  assert.deepStrictEqual(csp['style-src'], ["'self'"]);
});

test('ヘッダー：nosniff・Referrer-Policy・X-Frame-Options・Permissions-Policy がある', () => {
  assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(headers['X-Frame-Options'], 'DENY');
  assert.ok(headers['Referrer-Policy']);
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/);
});

test('CSP の接続先は、使っている Supabase のドメインだけ', () => {
  const report = fs.readFileSync(path.join(SITE, 'js/report.js'), 'utf8');
  const host = report.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
  assert.deepStrictEqual(csp['connect-src'], ["'self'", host]);
});

test('HTML：インラインのスクリプト・style・イベント属性・javascript: がない（CSP で動かなくなる）', () => {
  for (const f of htmls) {
    const h = fs.readFileSync(f, 'utf8');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(h), `${rel(f)}: インライン script`);
    assert.ok(!/<style[\s>]/i.test(h), `${rel(f)}: <style>`);
    assert.ok(!/\sstyle\s*=/i.test(h), `${rel(f)}: style 属性`);
    assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(h), `${rel(f)}: イベント属性`);
    assert.ok(!/(?:href|src|action)\s*=\s*["']\s*javascript:/i.test(h), `${rel(f)}: javascript:`);
  }
});

test('HTML・JS：target="_blank" には rel="noopener" が付く', () => {
  for (const f of [...htmls, ...jss]) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="[^"]*noopener/, `${rel(f)}: ${m[0].slice(0, 80)}`);
  }
});

test('JS：eval・new Function・document.write・javascript: を使わない', () => {
  for (const f of jss) {
    const s = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/\beval\s*\(|new Function\s*\(|document\.write\s*\(|javascript:/.test(s), rel(f));
  }
});

test('JS：外部由来のデータ（API の応答）は、エスケープしてから HTML に入れる', () => {
  for (const f of ['public-comment.js', 'recent-changes.js']) {
    const s = fs.readFileSync(path.join(SITE, 'js', f), 'utf8');
    for (const m of s.matchAll(/\$\{\s*(item\.[a-z]+)/g)) {
      assert.match(s, new RegExp(`esc\\(\\s*${m[1].replace('.', '\\.')}`), `${f}: ${m[1]} が esc() を通っていない`);
    }
    assert.ok(!/\$\{\s*item\.[a-z]+\s*\}/.test(s), `${f}: 未エスケープの item.* がある`);
  }
});

test('同梱ライブラリ：site/vendor/SHA256SUMS と中身が一致する（意図せぬ書き換えを見つける）', () => {
  const dir = path.join(SITE, 'vendor');
  const lines = fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8').split('\n').filter(Boolean);
  assert.ok(lines.length >= 3);
  for (const l of lines) {
    const [sum, name] = l.split(/\s+\*?/);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex');
    assert.strictEqual(actual, sum, `${name} が変わっています。意図した更新なら SHA256SUMS を作り直し、README の版も直す`);
  }
});

test('Supabase：テーブルは RLS を有効にし、anon に渡すのは決めた権限だけ', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8');
  const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  assert.ok(tables.length >= 4);
  for (const t of tables) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`), `${t} の RLS`);
  const grants = [...sql.matchAll(/^grant .*$/gm)].map((m) => m[0].replace(/\s+/g, ' '));
  assert.deepStrictEqual(grants, [
    'grant insert (pref, council, items) on public.reports to anon;',
    'grant select on public.council_counts to anon;',
    'grant select on public.action_totals to anon;',
    'grant insert (pref, council, mail, bring, online, online_url, deadline, copies, source_url, note) on public.council_tips to anon;',
    'grant insert (kind, theme, target, body, source_url) on public.feedback to anon;',
    'grant select on public.feedback_public to anon;',
  ]);
  assert.ok(!/to anon[^;]*\b(update|delete|all)\b/i.test(sql), 'anon に更新・削除を渡している');
  for (const t of ['reports', 'council_tips', 'feedback']) assert.match(sql, new RegExp(`on public\\.${t} for insert to anon`), `${t} は insert だけ`);
});
