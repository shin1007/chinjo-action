// /coverage#reach に書いた「議員に届くと確かめられた議会」の数が、データベースの数え直し（scripts/intake-reach.js）と合っているか
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const reach = require('../scripts/intake-reach.js');

test('/coverage#reach の数字が、数え直した結果と同じ', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'site', 'coverage.html'), 'utf8');
  assert.ok(html.includes(`議員に届くと確かめられた議会：${reach.reach}</b>`), `262 など、ページの数字が古い（いまは ${reach.reach}）`);
  assert.ok(html.includes(`審査する${reach.review}・配付や閲覧だけ${reach.distribute}`), '審査・配付の内訳が古い');
  assert.ok(html.includes(`確かめたのは${reach.reachConfirmed}で、残りの${reach.reach - reach.reachConfirmed}は`), '公式に書いてある数が古い');
});
