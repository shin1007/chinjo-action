#!/usr/bin/env node
// scripts/intake-fetch.js で取った案内ページの本文から、受け付け方を決まった言い回しで読み取って、
// site/data/intake/*.jsonl の「unknown」の項目だけを埋める。人が確かめた値（confidence: confirmed）は変えない。
//   node scripts/intake-extract.js chinjo|yobo          … 読み取った結果を数えるだけ（書かない）
//   node scripts/intake-extract.js chinjo|yobo --apply  … 書き込む
//   node scripts/intake-extract.js chinjo --show 東京都/墨田区  … 1件の読み取り結果と根拠の一文を見る
// 読み取った値は route: official_site（公式サイトの一文が根拠）、confidence: likely（機械で判断）、from: intake-extract。
// 人が原文を読んで確かめたら confidence を confirmed にする。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'site', 'data', 'intake');
const CACHE = path.join(__dirname, '.intake-cache');
const fileOf = (kind, id) => path.join(CACHE, kind, id.replace(/[\\/:*?"<>|]/g, '_') + '.json');

const K = {
  email: /(電子メール|[EＥｅe][-－]?(mail|メール|ｍａｉｌ)|メール)(?!アドレス|フォーム|送信フォーム|マガジン|配信|・?フォーム|送信画面)/i,
  fax: /FAX|ＦＡＸ|ファクス|ファックス|ファクシミリ/i,
  form: /電子申請|オンライン|フォーム|LoGo|ＬｏＧｏ|e-?Tumo|ぴったりサービス|graffer|インターネット/i,
  mail: /郵送|郵便|はがき|ハガキ|封書/,
  hand: /持参|窓口|直接(提出|お持ち|来庁|お越し|ご提出)|ご来庁/,
};
// 出し方の言葉のすぐ後ろ（20字以内）に「提出・受付」などがあるときだけ、その出し方の話とみなす
const NEAR = '[^。]{0,20}?(提出|受け付|受付|送付|送信|お送り|お持ち|による(陳情|請願|提出|要望|ご意見)|で(の|も)?(陳情|請願|要望|ご意見)|で(お寄せ|お届け|応募|投稿)|から(提出|投稿|送信|応募|お寄せ)|でも|又は|または|・|、)';
const near = (m, s) => new RegExp('(' + K[m].source + ')' + NEAR, K[m].flags).test(s);
const OKNEG = /構いません|かまいません|差し支えありません|差支えありません|問題ありません|必要ありません|ありません。?$/;
const NEG = /(受け付け|受付|受理|取り扱|取扱|提出|送付|応じ|対応|利用)[^。]{0,25}?(ません|できない|できかね|不可)|ご遠慮|以外は(受け付け|受付)|お断り|受け付けない|受付けない/;
const POS = /(でき(ます|る)|可能|受け付け(ます|ており|てい)|受付(して|いた)(おり|い)|ください|構いません|かまいません|も(提出|受付|受け付)|お寄せ|送信して|お送り)/;
const NONRES = /(市外|区外|町外|村外|県外|都外|府外|道外|(?<!所)管外|市域外|区域外)(の|に|在住|から|に住所|にお住|居住)|住所を有しない|(市民|区民|町民|村民|県民|都民|府民|道民|住民)以外|在住(していない|でない)/;
const DIST = /要望書(として|の)?扱い|議長(預かり|止め|供覧)|配付|配布|参考送付|写しを(全|各|議員|配)|閲覧|回覧|供覧|資料として|審議(されず|されません|の対象外|対象外|しない)|審査(されず|されません|の対象外|対象外|しない|いたしません)/;

const sentences = (t) => t.split(/(?<=。)|\n/).map((s) => s.trim()).filter((s) => s.length >= 6 && s.length <= 400);

function read(kind, row, page) {
  const out = { methods: {}, fields: {}, src: [] };
  out.conflict = [];
  const set = (m, who, v, s) => {
    out.methods[m] ||= {};
    const old = out.methods[m][who];
    if (!old) { out.methods[m][who] = v; out.src.push([`methods.${m}.${who}`, s]); }
    else if (old !== v && old !== 'conflict' && !(old === 'distribute' && v === 'accept')) { out.methods[m][who] = 'conflict'; out.conflict.push(`${m}.${who}: ${old}／${v}「${s.slice(0, 60)}」`); }
  };
  const setF = (f, v, s) => { if (out.fields[f] === undefined) { out.fields[f] = v; out.src.push([f, s]); } };
  const ss = sentences(page.text || '').flatMap((x) => x.split(/(?<=[ですま]すが、)|(?<=可ですが、)|(?<=んが、)/)).filter((x) => !/[か？?]。?$/.test(x));
  for (const s of ss) {
    const neg = !/署名|取下げ|取り下げ|訂正/.test(s) && NEG.test(s) && !OKNEG.test(s) && !/以外/.test(s.replace(NONRES, ''));
    const nonres = NONRES.test(s);
    const dist = DIST.test(s);
    const ms = Object.keys(K).filter((m) => near(m, s) && !(m === 'email' && /回答|返信|お返事|受信|ドメイン|公文書|件数|受け付けた/.test(s)) && !/件数|受け付けた(もの|件)|d+件/.test(s));
    for (const m of Object.keys(K)) if (new RegExp('(' + K[m].source + ')(で|による提出|での提出)?ではなく', K[m].flags).test(s)) { set(m, 'resident', 'no', s); if (kind === 'chinjo') set(m, 'nonresident', 'no', s); }
    if (kind === 'chinjo') {
      if (!/陳情|請願/.test(s) && !/提出/.test(s)) continue;
      if (nonres) {
        if (dist) for (const m of (ms.length ? ms : ['hand', 'mail'])) set(m, 'nonresident', 'distribute', s);
      } else if (ms.length && dist && !/以外/.test(s)) {
        for (const m of ms) { set(m, 'resident', 'distribute', s); set(m, 'nonresident', 'distribute', s); }
      } else if (ms.length && neg && !dist) {
        for (const m of ms) { set(m, 'resident', 'no', s); set(m, 'nonresident', 'no', s); }
      } else if (ms.length && POS.test(s) && !neg && !dist) {
        for (const m of ms) set(m, 'resident', 'accept', s);
      }
    } else {
      // 要望の「受け付けません」は内容の制限（営業・誹謗中傷など）がほとんどなので読まない。住民に限る書き方だけ拾う
      if (/(在住|在勤|在学|住民|市民|町民|村民|区民|県民|都民|府民|道民)[^。]{0,15}(の方|の人|者|の皆さま|の皆様)?(に限|のみ(?!な)|だけ(を|が|から|と)|を対象|が対象)/.test(s.replace(/のみな/g, '')) && !/どなたでも|窓口|掲載|該当しない/.test(s)) setF('_residentOnly', true, s);
      if (nonres || neg) {
        // 読まない
      } else if (ms.includes('email') && /フォーム|控え|モニター|お問い合わせ|問合せ/.test(s)) {
        for (const m of ms.filter((x) => x !== 'email')) set(m, 'resident', 'accept', s);
      } else if (ms.length && (POS.test(s) || ms.length >= 2)) {
        for (const m of ms) set(m, 'resident', 'accept', s);
      }
    }
    // 住民以外
    if (nonres) {
      if (kind === 'yobo' && neg) for (const m of Object.keys(K)) set(m, 'nonresident', 'no', s);
    }
    if (kind === 'yobo' && /どなたでも|市外の方も|市外在住の方も|県外の方も|区外の方も|町外の方も/.test(s)) setF('_anyone', true, s);
    // そのほかの項目
    if (/匿名|無記名/.test(s) && /(受け付け|取り扱|審査|回答|受理)[^。]{0,20}(ません|できません|しません)|ご遠慮/.test(s)) setF('anonymous_ok', 'no', s);
    if (kind === 'chinjo') {
      if (/(住所|氏名|名前)[^。]{0,40}(公開|公表|掲載|会議録|文書表|インターネット|ホームページ)/.test(s)) {
        setF('name_published', /(公開|公表|掲載)(しません|いたしません|されません)|非公開|伏せ/.test(s) ? 'no' : 'yes', s);
      }
      if (/意見陳述|趣旨説明|口頭陳述|趣旨の聴取|趣旨を説明/.test(s) && /でき|機会|希望|申し出|出席|お願い|行い|求め|ありません|しません/.test(s)) setF('statement', neg ? 'no' : 'yes', s);
      if (/結果[^。]{0,20}(通知|お知らせ|連絡|送付)/.test(s)) setF('result_notice', /(通知|お知らせ|連絡)(は)?(しません|いたしません|行いません|行っておりません)/.test(s) ? 'no' : 'yes', s);
      if (!row.deadline && /(締切|締め切り|締切り|提出期限|受付期間|まで(に|の間))/.test(s) && /定例会|開会|招集|告示|議会運営委員会/.test(s)) setF('deadline', s, s);
      if (!row.copies && /部数|\d+部|[一二三１２３]部/.test(s) && /提出|添え|必要/.test(s)) setF('copies', s, s);
    } else {
      if (/回答/.test(s) && !/過去|一覧|公表|掲載/.test(s)) {
        if (/回答(は|を)?(いたし|致し)?(かね|しません|できません|行いません|しておりません)|回答(を)?(要しない|しない)/.test(s)) setF('reply', 'no', s);
        else if (/回答(いたします|します|をお送り|をし|させていただ|を差し上げ)|お答え(します|いたします)/.test(s)) setF('reply', 'yes', s);
      }
    }
  }
  // フォーム・メールのリンク
  for (const l of page.links || []) {
    if (/^mailto:/i.test(l.href)) { if (!row.email_addr) setF('email_addr', l.href.replace(/^mailto:/i, '').split('?')[0], `リンク：${l.text}`); }
    else if (/form|shinsei|e-?apply|graffer|logoform/i.test(l.href) && /フォーム|送信|投稿|電子申請|オンライン|入力|申請/.test(l.text)) {
      if (!row.form_url) setF('form_url', l.href, `リンク：${l.text}`);
    }
  }
  if (kind === 'yobo') {
    if (page.hasForm) set('form', 'resident', 'accept', '（このページに入力フォームがある）');
    if (out.fields.form_url && /意見|要望|提案|声|ご意見|手紙/.test(out.fields.form_url + JSON.stringify(page.links)) && !(out.methods.form || {}).resident) set('form', 'resident', 'accept', `（フォームへのリンク：${out.fields.form_url}）`);
    if (out.fields._anyone) {
      for (const m of Object.keys(out.methods)) if (out.methods[m].resident && !out.methods[m].nonresident) { out.methods[m].nonresident = out.methods[m].resident; out.src.push([`methods.${m}.nonresident`, out.src.find((x) => x[0] === '_anyone')[1]]); }
    }
  }
  if (kind === 'yobo' && out.fields._residentOnly && !out.fields._anyone) {
    const q = out.src.find((x) => x[0] === '_residentOnly')[1];
    for (const m of Object.keys(out.methods)) if (out.methods[m].resident === 'accept' && !out.methods[m].nonresident) { out.methods[m].nonresident = 'no'; out.src.push([`methods.${m}.nonresident`, q]); }
  }
  delete out.fields._residentOnly;
  out.src = out.src.filter((x) => x[0] !== '_residentOnly');
  delete out.fields._anyone;
  out.src = out.src.filter((x) => x[0] !== '_anyone');
  return out;
}

function main() {
  const [kind, opt, arg] = process.argv.slice(2);
  const file = path.join(DIR, `${kind}.jsonl`);
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const count = {};
  for (const row of rows) {
    if (opt === '--show' && row.id !== arg) continue;
    let page;
    try { page = JSON.parse(fs.readFileSync(fileOf(kind, row.id), 'utf8')); } catch { continue; }
    if (!page.text) continue;
    const r = read(kind, row, page);
    if (opt === '--show') { console.log(page.url, '\n', JSON.stringify(r, null, 1)); return; }
    const used = new Map();
    for (const [m, v] of Object.entries(r.methods)) {
      for (const who of ['resident', 'nonresident']) {
        if (!v[who] || v[who] === 'conflict' || row.methods[m][who] !== 'unknown') continue;
        row.methods[m][who] = v[who];
        count[`${m}.${who}=${v[who]}`] = (count[`${m}.${who}=${v[who]}`] || 0) + 1;
        if (opt === '--list') console.log(['L', row.id, `${m}.${who}=${v[who]}`, (r.src.find((x) => x[0] === `methods.${m}.${who}`) || [])[1]].join('	'));
        const s = r.src.find((x) => x[0] === `methods.${m}.${who}`);
        if (s) used.set(s[1], [...(used.get(s[1]) || []), `methods.${m}`]);
      }
    }
    for (const [f, v] of Object.entries(r.fields)) {
      if (row[f] !== undefined) continue;
      row[f] = v;
      count[f] = (count[f] || 0) + 1;
      const s = r.src.find((x) => x[0] === f);
      if (s) used.set(s[1], [...(used.get(s[1]) || []), f]);
    }
    if (!row.page_url) row.page_url = page.url;
    if (r.conflict.length && !row.note) row.note = '案内ページの文の読み取りで食い違いがあった（人が確かめる）：' + r.conflict.join('、');
    for (const [quote, fields] of used) {
      row.sources.push({ fields: [...new Set(fields)], quote: quote.slice(0, 300), url: page.finalUrl || page.url, checked_at: page.fetched_at, route: 'official_site', confidence: 'likely', from: 'intake-extract' });
    }
  }
  console.log(Object.entries(count).sort().map(([k, n]) => `${k}: ${n}`).join('\n'));
  if (opt === '--apply') { fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); console.log('書いた'); }
}
main();
