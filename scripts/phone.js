#!/usr/bin/env node
// 議会事務局に電話で聞いた答えを入力する画面。
//   node scripts/phone.js        → http://localhost:8787 を起動して、ブラウザで自動で開く（--no-open で開かない）
// 一覧は docs/調査/電話で聞く議会.md（人口順・電話番号）。保存すると site/data/intake/chinjo.jsonl の行を直し、
// 根拠に route: "office_reply" を足す。メモの原文は docs/非公開/電話の記録.jsonl（Git に入れない）に残す。
// 保存のあとは node scripts/intake.js check と export を流す（画面の「保存」でも自動で流す）。
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'site/data/intake/chinjo.jsonl');
const LIST = path.join(ROOT, 'docs/調査/電話で聞く議会.md');
const LOG = path.join(ROOT, 'docs/非公開/電話の記録.jsonl');
const PORT = Number(process.env.PORT || 8787);

const read = () => fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const write = (rows) => fs.writeFileSync(FILE, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// 一覧の表から 宛先→電話・出典 を引く
function phones() {
  const m = {};
  for (const l of fs.readFileSync(LIST, 'utf8').split('\n')) {
    const c = l.split('|').map((s) => s.trim());
    if (c.length < 8 || !/^\d+$/.test(c[1])) continue;
    const url = (c[6].match(/\((.+)\)/) || [])[1] || '';
    m[c[3] + '|' + c[4]] = { tel: c[5], url };
  }
  return m;
}

// 特別な条件の選択肢（chinjo.jsonl の conditions に文で入る）
const CONDITIONS = [
  '陳情者が委員会で説明しないと審査しない',
  '自筆の署名が要る',
  '押印が要る',
  '原本だけ受け付ける（コピー・FAX・PDFは不可）',
  '1件の陳情に趣旨は1つだけ',
  '陳情者の電話番号の記載が要る',
  '議会の様式で出す',
  '用紙の大きさ・向きの決まりがある（A4縦など）',
  '参考資料の枚数・ページ数に上限がある',
  '参考資料は受け付けない／配らない',
  '出す前に事務局へ連絡が要る',
  '同じ趣旨の陳情は一定の期間出せない',
  '団体の陳情は代表者の記載・会則が要る',
];

// 台本は一覧の md の「## 台本」の節をそのまま出す（台本を直すときは md だけ直す）
function script() {
  const t = fs.readFileSync(LIST, 'utf8');
  const sec = (t.split('## 台本')[1] || '').split('\n## ')[0];
  const esc = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return sec.trim().split(/\r?\n/).filter((l) => l.trim()).map((l) => '<p>' + esc(l.replace(/^> ?/, '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>') + '</p>').join('');
}

function page() {
  const tel = phones();
  const list = read().filter((r) => r.level && (r.methods.mail.resident === 'unknown' || (r.sources || []).some((s) => s.from === 'phone')))
    .sort((a, b) => (b.population || 0) - (a.population || 0))
    .map((r) => ({ id: r.id, pref: r.pref, to: r.to || r.name, pop: r.population || 0, done: (r.sources || []).some((s) => s.from === 'phone'), ...(tel[r.pref + '|' + (r.to || r.name)] || {}) }));
  return `<!doctype html><meta charset="utf-8"><title>電話の答えの入力</title>
<style>body{font:15px sans-serif;margin:0;display:flex;flex-direction:column;height:100vh}#l{flex:none;border-bottom:2px solid #ccc}#items{height:96px;overflow-y:auto}#items div{height:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;padding:4px 8px;cursor:pointer;border-bottom:1px solid #eee}#items div.on{background:#def}#items .done{color:#888}
#f{padding:12px 20px}#sc p{margin:4px 0}table{border-collapse:collapse}td,th{padding:3px 8px;border:1px solid #ddd}fieldset{margin:10px 0}input[type=text],textarea{width:100%;box-sizing:border-box}label{display:block}.tel{font-size:22px;font-weight:bold}</style>
<div id="l"><div style="display:flex;gap:12px;align-items:center;padding:6px 8px"><input id="q" placeholder="絞り込み（都道府県・議会の名前）" style="flex:1"><label><input type="checkbox" id="hide" checked>済みを隠す</label></div><div id="items"></div><div id="tel" style="padding:6px 8px;background:#eef6ff;border-top:1px solid #ccc">議会を選ぶと、ここに電話番号が出ます。</div></div>
<main style="flex:1;min-height:0;display:flex"><div id="sc" style="width:40%;overflow-y:auto;padding:8px 16px;background:#fffbe6;border-right:1px solid #ccc"><b>台本</b>${script()}</div><form id="f" style="flex:1;overflow-y:auto"><p>上の一覧から議会を選んでください。</p></form></main>
<script>
const L=${JSON.stringify(list)},C=${JSON.stringify(CONDITIONS)};
const M=[['hand','持参'],['mail','郵送'],['email','メール'],['form','電子申請・フォーム'],['fax','FAX']];
const V=[['unknown','聞いていない'],['review','受け付けて審査'],['distribute','受け付けるが配付・回覧だけ'],['accept','受け付ける（扱いは未確認）'],['no','受け付けない']];
const T=[['unknown','聞いていない'],['yes','はい'],['no','いいえ']];
const E=[['','—'],['same','住民と同じ'],['distribute','配付・回覧だけ'],['may_distribute','議長などの判断で審査しないことがある'],['as_request','要望書として扱う'],['no','出せない']];
const sel=(n,o,v)=>'<select name="'+n+'">'+o.map(([k,t])=>'<option value="'+k+'"'+(k===v?' selected':'')+'>'+t+'</option>').join('')+'</select>';
function draw(){const q=document.getElementById('q').value,h=document.getElementById('hide').checked;
 document.getElementById('items').innerHTML=L.map((x,i)=>(q&&!(x.pref+x.to).includes(q))||(h&&x.done)?'':'<div data-i="'+i+'" class="'+(x.done?'done':'')+'">'+(i+1)+'. '+x.pref+' '+x.to+'　<small>'+x.pop.toLocaleString()+'人</small></div>').join('');}
document.getElementById('q').oninput=draw;document.getElementById('hide').onchange=draw;
document.getElementById('items').onclick=async e=>{const d=e.target.closest('[data-i]');if(!d)return;document.querySelectorAll('#items .on').forEach(x=>x.classList.remove('on'));d.classList.add('on');
 const x=L[d.dataset.i];document.getElementById('tel').innerHTML=x.pref+' '+x.to+'　<span class="tel">'+(x.tel?'<a href="tel:'+x.tel+'">'+x.tel+'</a>':'番号なし')+'</span>'+(x.tel&&x.url?'　<small>（番号の出典：<a target="_blank" href="'+x.url+'">案内ページ</a>）</small>':'');const r=await (await fetch('/row?id='+encodeURIComponent(x.id))).json();form(x,r);};
function form(x,r){const nr=r.nonresident_rule||{};
 document.getElementById('f').innerHTML='<h2>'+x.pref+' '+x.to+'</h2><p>'+(x.url?'<a target="_blank" href="'+x.url+'">案内ページ</a>':'案内ページなし')+(r.page_url&&r.page_url!==x.url?' / <a target="_blank" href="'+r.page_url+'">page_url</a>':'')+'</p>'
 +'<input type="hidden" name="id" value="'+x.id+'"><label>聞いた日 <input type="date" name="date" value="'+new Date().toISOString().slice(0,10)+'"></label>'
 +'<fieldset><legend>1・3 出し方</legend><table><tr><th></th><th>住民</th><th>住民以外</th></tr>'+M.map(([m,t])=>'<tr><td>'+t+'</td><td>'+sel(m+'.resident',V,r.methods[m].resident)+'</td><td>'+sel(m+'.nonresident',V,r.methods[m].nonresident)+'</td></tr>').join('')+'</table>'
 +'<label>メールの宛先 <input type="text" name="email_addr" value="'+(r.email_addr||'')+'"></label><label>フォームのURL <input type="text" name="form_url" value="'+(r.form_url||'')+'"></label></fieldset>'
 +'<fieldset><legend>2 住民以外の決まり</legend><label>対象（例：市外に住所がある人）<input type="text" name="nr_who" value="'+(nr.who||'')+'"></label><label>扱い '+sel('nr_effect',E,nr.effect||'')+'</label><label>例外（例：在勤・在学は住民と同じ）<input type="text" name="nr_unless" value="'+(nr.unless||'')+'"></label></fieldset>'
 +'<fieldset><legend>4 締切</legend><input type="text" name="deadline" placeholder="例：定例会の告示日の前日の正午まで" value="'+(r.deadline||'')+'"></fieldset>'
 +'<fieldset><legend>5 部数・様式・参考資料</legend><label>陳情書の部数 <input type="text" name="copies" placeholder="例：正本1部" value="'+(r.copies||'')+'"></label>'
 +'<label>参考資料を添えるときの部数（2以上の数字。1部なら空）<input type="number" min="2" name="ref_copies" value="'+(r.ref_copies||'')+'"></label>'
 +'<label>参考資料の枚数の上限・決まり（例：A4で10枚まで、両面不可）<input type="text" name="ref_limit" value="'+(r.ref_limit||'')+'"></label>'
 +'<label>様式 <input type="text" name="format" placeholder="例：様式は自由" value="'+(r.format||'')+'"></label></fieldset>'
 +'<fieldset><legend>6 公開と結果</legend>'+[['name_published','氏名・住所が公開される'],['result_notice','結果を知らせてくれる'],['statement','委員会で説明できる'],['anonymous_ok','匿名で出せる']].map(([k,t])=>'<label>'+t+' '+sel(k,T,r[k]||'unknown')+'</label>').join('')+'</fieldset>'
 +'<fieldset><legend>7 特別な条件</legend>'+C.map(c=>'<label><input type="checkbox" name="cond" value="'+c+'"'+((r.conditions||[]).includes(c)?' checked':'')+'>'+c+'</label>').join('')
 +'<label>そのほかの条件（1行に1つ）<textarea name="cond_more" rows="3">'+(r.conditions||[]).filter(c=>!C.includes(c)).join('\\n')+'</textarea></label></fieldset>'
 +'<fieldset><legend>8 案内の場所</legend><label>案内・要綱のURL（あれば）<input type="text" name="page_hint"></label></fieldset>'
 +'<fieldset><legend>答えの要旨（根拠に載る。公開してよいことだけ。名前は書かない）</legend><textarea name="quote" rows="3" required></textarea>'
 +'<legend>メモ（docs/非公開 だけに残る）</legend><textarea name="memo" rows="2"></textarea></fieldset>'
 +'<button>保存</button> <span id="msg"></span>';}
document.getElementById('f').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),o={};for(const[k,v]of fd)o[k]=k==='cond'?[...(o[k]||[]),v]:v;
 const res=await (await fetch('/save',{method:'POST',body:JSON.stringify(o)})).json();document.getElementById('msg').textContent=res.ok?'保存しました（check OK）':'エラー：'+res.error;
 if(res.ok){const x=L.find(x=>x.id===o.id);x.done=true;draw();}};
draw();
</script>`;
}

function save(o) {
  const rows = read();
  const r = rows.find((x) => x.id === o.id);
  if (!r) throw new Error('議会が見つからない');
  if (!o.quote || !o.quote.trim()) throw new Error('答えの要旨が空');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : new Date().toISOString().slice(0, 10);
  const fields = [];
  const set = (k, v) => { if (v === '') v = undefined; if (JSON.stringify(r[k]) !== JSON.stringify(v)) { if (v === undefined || v === '') delete r[k]; else r[k] = v; fields.push(k); } };
  for (const m of ['hand', 'mail', 'email', 'form', 'fax']) {
    const v = { resident: o[m + '.resident'], nonresident: o[m + '.nonresident'] };
    if (v.resident !== r.methods[m].resident || v.nonresident !== r.methods[m].nonresident) { r.methods[m] = v; fields.push('methods.' + m); }
  }
  for (const k of ['email_addr', 'form_url', 'deadline', 'format', 'ref_limit']) set(k, (o[k] || '').trim());
  let copies = (o.copies || '').trim();
  const ref = parseInt(o.ref_copies, 10);
  if (ref >= 2) {
    if (!copies.normalize('NFKC').includes(String(ref))) copies = (copies ? copies + '。' : '') + `参考資料を添えるときは${ref}部`;
    set('ref_copies', ref);
  } else set('ref_copies', undefined);
  set('copies', copies);
  for (const k of ['name_published', 'result_notice', 'statement', 'anonymous_ok']) set(k, o[k] === 'unknown' && r[k] === undefined ? undefined : o[k]);
  const cond = [...(o.cond || []), ...(o.cond_more || '').split('\n').map((s) => s.trim()).filter(Boolean)];
  set('conditions', cond.length ? cond : undefined);
  if (o.nr_effect) set('nonresident_rule', { who: o.nr_who || '市外に住所がある人', methods: ['all'], effect: o.nr_effect, ...(o.nr_unless ? { unless: o.nr_unless } : {}) });
  if (!fields.length) fields.push('note');
  r.sources.push({ fields, quote: o.quote.trim(), url: '', checked_at: date, route: 'office_reply', confidence: 'confirmed', from: 'phone' });
  if (o.page_hint) r.sources.push({ fields: ['page_url'], quote: '事務局の案内で教わったページ', url: o.page_hint.trim(), checked_at: date, route: 'office_reply', confidence: 'likely', from: 'phone' });
  if (r.unresolved && fields.some((f) => f.startsWith('methods.mail'))) delete r.unresolved;
  const before = fs.readFileSync(FILE, 'utf8');
  write(rows);
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'intake.js'), 'check'], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, [path.join(__dirname, 'intake.js'), 'export'], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    fs.writeFileSync(FILE, before);
    throw new Error('check に通らないので元に戻した：' + String(e.stderr || e.message).slice(0, 500));
  }
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...o }) + '\n');
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type + '; charset=utf-8' }); res.end(body); };
  if (u.pathname === '/') return send(200, 'text/html', page());
  if (u.pathname === '/row') return send(200, 'application/json', JSON.stringify(read().find((r) => r.id === u.searchParams.get('id')) || {}));
  if (u.pathname === '/save' && req.method === 'POST') {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      try { save(JSON.parse(b)); send(200, 'application/json', '{"ok":true}'); } catch (e) { send(200, 'application/json', JSON.stringify({ ok: false, error: e.message })); }
    });
    return;
  }
  send(404, 'text/plain', 'not found');
});
// 起動したらブラウザで開く（--no-open で開かない）。すでに動いていたら、開くだけにする
const URL_ = `http://localhost:${PORT}`;
const openBrowser = () => {
  if (process.argv.includes('--no-open')) return;
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', URL_]] : [process.platform === 'darwin' ? 'open' : 'xdg-open', [URL_]];
  require('child_process').spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref();
};
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.log(`${URL_} はもう動いています。ブラウザで開きます`);
  openBrowser();
});
server.listen(PORT, '127.0.0.1', () => { console.log(`${URL_} を開きました（止めるときは Ctrl+C）`); openBrowser(); });
