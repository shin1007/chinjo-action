// 陳情の文面・項目・参考資料を、ほかのAIに渡しやすいJSONへ書き出す。
// 一次資料の本文は含めず、data/source-index.json のIDで必要な資料だけ参照する。
//   node scripts/export-ai.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const THEMES = ['kodomo', 'dansei', 'nihonjin', 'shiho', 'kenko', 'sonota'];
const OUT = path.join(ROOT, 'ai');
const SOURCE_INDEX = path.join(ROOT, 'data', 'source-index.json');

const read = (file) => fs.readFileSync(file, 'utf8');

function loadTheme(theme) {
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  for (const file of ['theme.js', 'asks-national.js', 'asks-local.js', 'template.js']) {
    vm.runInContext(read(path.join(ROOT, 'themes', theme, file)), ctx, { filename: file });
  }
  return ctx.window;
}

function sourceId(url) {
  const digest = crypto.createHash('sha1').update(url).digest('hex').slice(0, 10);
  return `src-${digest}`;
}

function sourceKind(title, url) {
  if (/法|条約|条例|規則|判例|法律/.test(title) || /laws\.e-gov\.go\.jp/.test(url)) return 'law';
  if (/裁判所|国会|議会|省|庁|府|県|市|町|村|国連|政府/.test(title)) return 'official';
  return 'research';
}

function collect() {
  const sources = new Map();
  const themes = THEMES.map((theme) => {
    const w = loadTheme(theme);
    const items = w.ASKS.map((a) => ({
      id: a.id,
      scope: a.scope,
      category: a.category || null,
      label: a.label,
      title: a.title,
      wording: a.text,
      reason: a.reason,
      references: (a.refs || []).map((r) => {
        if (!r.url) return { title: r.t, note: r.note || null };
        const id = sourceId(r.url);
        if (!sources.has(id)) {
          sources.set(id, {
            id,
            title: r.t,
            url: r.url,
            note: r.note || null,
            kind: r.secondary ? 'secondary' : sourceKind(r.t, r.url),
          });
        }
        return { sourceId: id, title: r.t, note: r.note || null };
      }),
    }));
    return {
      id: w.THEME.id,
      name: w.THEME.name,
      templates: {
        subjectNational: w.TEMPLATE.subjectNational,
        subjectLocal: w.TEMPLATE.subjectLocal,
        purposeNational: w.TEMPLATE.purposeNational,
        purposeLocal: w.TEMPLATE.purposeLocal,
        closing: w.TEMPLATE.closing,
      },
      items,
    };
  });
  return {
    schemaVersion: 1,
    description: '陳情アクションのAI連携用データ。一次資料の本文は含めず、sourceIdから必要な資料だけ確認する。',
    themes,
    sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

// トップページの「陳情の内容をさがす」で使う、テーマを横断した項目の一覧（search.js が読む）
const SHORT = { kodomo: '子どもの権利', dansei: '男女平等', nihonjin: '日本人の権利', shiho: '司法への参加', kenko: '国民の健康', sonota: 'その他' };
const WORDS = require('./search-words');
function searchIndex(data) {
  const list = data.themes.flatMap((t) => t.items.map((a) => ({
    theme: t.id,
    themeName: SHORT[t.id] || t.name,
    id: a.id,
    scope: a.scope,
    category: a.category,
    label: a.label,
    words: WORDS[`${t.id}/${a.id}`] || '',
    text: `${a.title}\n${a.wording}`,
  })));
  return `// node scripts/export-ai.js で作るファイル。手で書き換えないでください
window.SEARCH_INDEX = ${JSON.stringify(list)};
`;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

if (require.main === module) {
  const data = collect();
  fs.mkdirSync(OUT, { recursive: true });
  const previous = fs.existsSync(SOURCE_INDEX)
    ? JSON.parse(read(SOURCE_INDEX)).sources || []
    : [];
  const saved = new Map(previous.map((s) => [s.id, { fetchedAt: s.fetchedAt || null, localPath: s.localPath || null }]));
  writeJson(SOURCE_INDEX, {
    schemaVersion: 1,
    description: '陳情の参考資料として登録した一次資料と信頼のおける二次資料（kind: secondary）の索引。本文は必要なときだけ scripts/source.js で保存する。',
    sources: data.sources.map((s) => ({ ...s, ...(saved.get(s.id) || { fetchedAt: null, localPath: null }) })),
  });
  writeJson(path.join(OUT, 'petitions.json'), data);
  fs.writeFileSync(path.join(ROOT, 'search-index.js'), searchIndex(data));
  console.log(`${data.themes.length}テーマ、${data.sources.length}資料を書き出しました`);
}

module.exports = { collect, sourceId, searchIndex };
