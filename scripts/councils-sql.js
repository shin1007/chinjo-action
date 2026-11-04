// 報告を受け付ける議会の一覧（supabase/councils.sql）を、data/municipalities.js から作る。
// 自治体の一覧を直したら実行し、できた SQL を Supabase の SQL Editor で実行する：node scripts/councils-sql.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['data/prefs.js', 'data/municipalities.js', 'places.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });

const q = (s) => `'${s.replaceAll("'", "''")}'`;
const rows = [...new Set(ctx.Places.all().map((pl) => `(${q(pl.pref)}, ${q(pl.council)})`))];
fs.writeFileSync(path.join(ROOT, 'supabase/councils.sql'), `-- 自動で作ったファイル（node scripts/councils-sql.js）。手で直さない。
-- 報告を受け付ける議会の一覧を入れ直す。schema.sql のあとに実行する。
begin;
delete from public.councils;
insert into public.councils (pref, council) values
${rows.join(',\n')};
commit;
`);
console.log(`supabase/councils.sql：${rows.length}議会`);
