// 陳情の項目の根拠（refs）の抜けを防ぐ。「直す」の点があれば落ちる（長さなどの「見直し」は警告だけ）。
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('陳情の項目：根拠のない項目・数字に一次資料がない項目がない（scripts/asks-audit.js）', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'asks-audit.js'), '--strict'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout);
});
