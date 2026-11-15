// api/ の関数のテスト。上流（e-Gov・GitHub）への fetch は差し替えて、ネットワークには出ない。
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const publicComments = require('../api/public-comments.js');
const recentChanges = require('../api/recent-changes.js');

const realFetch = global.fetch;
let calls;
function stubFetch(handler) {
  calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, opts }); return handler(url, opts); };
}
const ok = (body, json) => ({ ok: true, status: 200, text: async () => body, json: async () => json });

function run(fn, req) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; resolve(this); } };
    fn(req, res);
  });
}

const item = (title, link, desc = '受付締切日時：2026年12月1日 カテゴリー：x') => `<item><title>${title}</title><link>${link}</link><description><![CDATA[${desc}]]></description></item>`;
const feed = (...items) => `<?xml version="1.0"?><rdf>${items.join('')}</rdf>`;

beforeEach(() => publicComments.resetCache());
afterEach(() => { global.fetch = realFetch; });

test('パブリックコメント：キーワードは個数・長さを抑える', () => {
  const many = Array.from({ length: 50 }, (_, i) => `語${i}`).join(',');
  assert.strictEqual(publicComments.parseKeywords(many).length, 10);
  assert.strictEqual(publicComments.parseKeywords('あ'.repeat(500))[0].length, 30);
  assert.deepStrictEqual(publicComments.parseKeywords(' , ,'), publicComments.parseKeywords(undefined));
  assert.deepStrictEqual(publicComments.parseKeywords(['配列']), publicComments.parseKeywords(undefined));
});

test('パブリックコメント：語に合う案件だけを返し、http(s) 以外の URL は除く', async () => {
  stubFetch(() => ok(feed(item('共同親権の見直し', 'https://example.go.jp/a'), item('無関係', 'https://example.go.jp/b'), item('共同親権の悪いリンク', 'javascript:alert(1)'))));
  const r = await run(publicComments, { method: 'GET', query: { keywords: '共同親権' } });
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body.items.map((i) => i.url), ['https://example.go.jp/a']);
  assert.match(r.headers['Cache-Control'], /s-maxage/);
});

test('パブリックコメント：キーワードを変えて何度呼んでも、上流へは取りに行き直さない', async () => {
  stubFetch(() => ok(feed(item('児童', 'https://example.go.jp/a'))));
  for (const k of ['a', 'b', 'c', '児童']) await run(publicComments, { method: 'GET', query: { keywords: k } });
  assert.strictEqual(calls.length, 1);
});

test('パブリックコメント：上流への fetch にはタイムアウトが付く', async () => {
  stubFetch(() => ok(feed()));
  await run(publicComments, { method: 'GET', query: {} });
  assert.ok(calls[0].opts && calls[0].opts.signal, 'signal がない');
});

test('パブリックコメント：GET 以外は 405、上流の失敗は 502', async () => {
  stubFetch(() => ok(feed()));
  assert.strictEqual((await run(publicComments, { method: 'POST' })).code, 405);
  assert.strictEqual(calls.length, 0);
  const origError = console.error;
  console.error = () => {};
  try {
    stubFetch(() => ({ ok: false, status: 500 }));
    assert.strictEqual((await run(publicComments, { method: 'GET', query: {} })).code, 502);
    stubFetch(() => { throw new Error('timeout'); });
    assert.strictEqual((await run(publicComments, { method: 'GET', query: {} })).code, 502);
  } finally { console.error = origError; }
});

test('最近の変更：マージコミットを除き、PR 番号があれば PR のリンクにする', async () => {
  const commits = [
    { sha: 'a1', parents: [{}], commit: { message: '文面を直す (#12)\n\n本文', committer: { date: '2026-11-14T16:00:00Z' } } },
    { sha: 'b2', parents: [{}, {}], commit: { message: 'Merge pull request #12', committer: { date: '2026-11-14T16:00:00Z' } } },
    { sha: 'c3', parents: [{}], commit: { message: '別の直し', committer: { date: '2026-11-10T01:00:00Z' } } },
  ];
  stubFetch(() => ok('', commits));
  const r = await run(recentChanges, { method: 'GET' });
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body.items.map((i) => [i.title, i.date, i.url]), [
    ['文面を直す', '2026-11-15', 'https://github.com/shin1007/chinjo-action/pull/12'],
    ['別の直し', '2026-11-10', 'https://github.com/shin1007/chinjo-action/commit/c3'],
  ]);
  assert.ok(calls[0].opts.signal, 'タイムアウトがない');
});

test('最近の変更：POST は 405', async () => {
  stubFetch(() => ok('', []));
  assert.strictEqual((await run(recentChanges, { method: 'POST' })).code, 405);
});
