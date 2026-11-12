// 受け付け方のデータベースから、人が読む一覧表を docs/確認用/陳情・要望の受け付け方の一覧.md に書く。
// node scripts/intake.js report から呼ぶ。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'site', 'data', 'intake');
const METHODS = ['hand', 'mail', 'email', 'form', 'fax'];
const NAME = { hand: '持参', mail: '郵送', email: 'メール', form: 'フォーム', fax: 'FAX' };
const L = { review: '審査', distribute: '配付だけ', accept: '可', no: '不可', unknown: '' };
const T = { yes: 'あり', no: 'なし', unknown: '' };

const read = (kind) => fs.readFileSync(path.join(DIR, `${kind}.jsonl`), 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);

function cell(v) {
  if (v.resident === v.nonresident) return L[v.resident];
  return `住民:${L[v.resident] || '?'}／外:${L[v.nonresident] || '?'}`;
}

function conf(r) {
  const rs = r.sources.filter((x) => x.fields.some((f) => f.startsWith('methods')));
  if (!rs.length) return '';
  if (rs.some((x) => x.route === 'official_site' && x.confidence === 'confirmed')) return '確認済み';
  if (rs.some((x) => x.route === 'office_reply')) return '事務局の回答';
  if (rs.some((x) => x.route === 'official_site')) return '機械読み取り';
  if (rs.some((x) => x.route === 'user_tip')) return '利用者情報';
  return '機械読み取り';
}

module.exports = function report() {
  const lines = [
    '# 陳情・要望の受け付け方の一覧',
    '',
    'site/data/intake/*.jsonl から `node scripts/intake.js report` で作る（手で直さない。直すのは jsonl のほう）。人口の多い順。空欄はまだわからないもの。',
    '',
    '- 「確認済み」：公式サイトの原文を読んで確かめたもの。「機械読み取り」：公式サイトの文を決まった言い回しで読み取っただけのもの（根拠の一文は jsonl の sources にある。間違いが混じる）。',
    '- 陳情の「審査」は委員会などで審査される、「配付だけ」は議員に写しを配るだけ（または議長預かり・要望書扱い）、「可」は受け付けるが審査されるかはページに書いていない、「不可」は受け付けない。',
    '- 「住民:…／外:…」は、住民と住民以外で扱いが違うもの（「?」はわからない）。',
    '',
  ];
  for (const kind of ['chinjo', 'yobo']) {
    const rows = read(kind).sort((a, b) => (b.population || 0) - (a.population || 0));
    lines.push(`## ${kind === 'chinjo' ? '議会への陳情' : '首長への要望'}（${rows.length} 件）`, '', '### 埋まり具合', '', '| 出し方 | わかっている数 | 内訳 |', '|---|---|---|');
    for (const m of METHODS) {
      const c = {};
      for (const r of rows) { const k = cell(r.methods[m]); if (k) c[k] = (c[k] || 0) + 1; }
      const n = Object.values(c).reduce((a, b) => a + b, 0);
      lines.push(`| ${NAME[m]} | ${n} | ${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k} ${x}`).join('、')} |`);
    }
    const extraHead = kind === 'chinjo' ? ['意見陳述', '結果の通知', '氏名の公開'] : ['回答'];
    const head = ['自治体', '人口', ...METHODS.map((m) => NAME[m]), ...extraHead, '根拠', '案内'];
    lines.push('', '### 自治体ごと', '', `| ${head.join(' | ')} |`, `|${'---|'.repeat(head.length)}`);
    for (const r of rows) {
      const extra = kind === 'chinjo' ? [r.statement, r.result_notice, r.name_published] : [r.reply];
      lines.push(`| ${[
        r.id.replace('/@', ''),
        r.population ? r.population.toLocaleString('en') : '',
        ...METHODS.map((m) => cell(r.methods[m])),
        ...extra.map((v) => T[v] || ''),
        conf(r) + (r.unresolved ? '（判定できず）' : '') + (r.note && /食い違い/.test(r.note) ? '（食い違いあり）' : ''),
        r.page_url ? `[開く](${r.page_url})` : '',
      ].join(' | ')} |`);
    }
    lines.push('');
  }
  const out = path.join(ROOT, 'docs', '確認用', '陳情・要望の受け付け方の一覧.md');
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`書いた：${path.relative(ROOT, out)}`);
};
