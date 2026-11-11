// 要望書の出し方のページ（data/request-pages.js）を、手元の生成AI（Ollama）に1件ずつ読ませて分類し、
// 「出し方」でなさそうなページだけを一覧にする。人が見る件数を減らすための下ごしらえで、AI の判断だけで外さない。
//   node scripts/request-pages-llm.js                 … data/request-pages.js の全ページを分類する
//   node scripts/request-pages-llm.js 東京都/港区 ...   … 指定したページだけ
//   node scripts/request-pages-llm.js --url URL ...   … 任意のページ（手で外した自治体の答え合わせなど）
// 2026-11-11 に qwen3:8b（CPU、1件数秒）で試した精度：手で確かめて残した697件のうち約59件（約8%）を誤って挙げ、
// 手で外した21件のうち13件を正しく挙げた。見落としもあるので、新しく見つけたページは今までどおり人も開いて確かめる
// 前もって Ollama を起動し、モデルを入れておく（ollama pull qwen3:8b）。モデルは OLLAMA_MODEL で替えられる
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data/request-pages.js'));

const MODEL = process.env.OLLAMA_MODEL || 'qwen3:8b';
const HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const KINDS = ['出し方', '子ども向け', '一覧・記録', '入口・紹介', '特定の話題', 'その他'];

const PROMPT = `あなたは自治体の公式サイトのページを分類します。住民が、知事・市区町村長あてに要望や意見を出したい人のために、そのページが案内として使えるかを判断します。
次のどれか1つを選んでください。
- 出し方：自治体への意見・要望・提案を受け付けていて、出し方（入力フォーム、郵送、メール、FAX、窓口など）が書いてある。「ご意見・お問い合わせ」の総合フォームも含む
- 子ども向け：子ども・若者だけを対象にした意見箱
- 一覧・記録：過去に寄せられた意見と回答の一覧、受付件数、活動の記録や報告
- 入口・紹介：「広聴」「広報・広聴」のような、いくつもの制度へのリンクを並べただけの入口のページや、課・係の紹介。出し方の手がかり（フォーム、メールアドレス、送り先）がない
- 特定の話題：ある計画・施設・事業など、決まった話題についての意見だけを受け付けている（パブリックコメントを含む）
- その他：上のどれにも当たらない
出し方の手がかりは「リンク」の欄にもあります。ただし、子ども向け・特定の話題・過去の一覧のページにもフォームはあるので、フォームがあるだけで「出し方」にしないでください。
JSON で {"kind": 分類, "reason": 30字以内の理由} だけを答えてください。`;

const strip = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

async function page(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (request-pages checker)', 'Accept-Language': 'ja' } });
    const buf = Buffer.from(await r.arrayBuffer());
    const cs = ((r.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || buf.subarray(0, 3000).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    let html;
    try { html = new TextDecoder(/s(hift)?[-_]?jis/i.test(cs) ? 'shift_jis' : cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
    const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    // 本文は、出し方の手がかりの言葉のまわりを優先して渡す（長いページでも AI に渡す量を抑える）
    const text = strip((html.match(/<main[\s\S]*?<\/main>/i) || [html])[0]);
    const i = Math.max(0, text.search(/送信|フォーム|郵送|はがき|ファクス|FAX|メール|受け付け|受付/) - 300);
    // フォーム・メールへのリンクは抜き出した本文から外れやすいので、別に拾って渡す
    const links = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, h, t]) => [h, strip(t)])
      .filter(([h, t]) => /^mailto:|form|shinsei|e-?apply|graffer|enquete/i.test(h) || /フォーム|送信|投稿|申請|メール|入力/.test(t))
      .slice(0, 15).map(([h, t]) => `${t}（${h.slice(0, 80)}）`);
    if (/<form[\s>]/i.test(html)) links.unshift('このページに入力フォームあり');
    return { ok: r.ok, title, text: text.slice(i, i + 2000), links: links.join(' / ') || 'なし' };
  } catch (e) {
    return { ok: false, title: '', text: '', error: String(e.name || e) };
  } finally { clearTimeout(t); }
}

async function classify(p) {
  const r = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      model: MODEL, stream: false, think: false, options: { temperature: 0 },
      format: { type: 'object', properties: { kind: { type: 'string', enum: KINDS }, reason: { type: 'string' } }, required: ['kind', 'reason'] },
      messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: `題：${p.title}\n本文（抜き出し）：${p.text}\nリンク：${p.links}` }],
    }),
  });
  if (!r.ok) throw new Error(`Ollama が答えなかった（${r.status}）。ollama serve と ollama pull ${MODEL} を確かめてください`);
  return JSON.parse((await r.json()).message.content);
}

(async () => {
  const args = process.argv.slice(2);
  const urlMode = args[0] === '--url';
  const items = urlMode ? args.slice(1).map((u) => [u, u])
    : (args.length ? args : Object.keys(window.REQUEST_PAGES)).map((id) => [id, window.REQUEST_PAGES[id][0]]);
  const counts = {};
  for (const [id, url] of items) {
    const p = await page(url);
    const c = p.ok ? await classify(p) : { kind: '開けなかった', reason: p.error || '' };
    counts[c.kind] = (counts[c.kind] || 0) + 1;
    // 「出し方」以外だけを出す。人が開いて確かめる
    if (c.kind !== '出し方') console.log(`${c.kind}\t${id}\t${p.title}\t${c.reason}\t${url}`);
  }
  console.error(`\n${MODEL} で ${items.length} 件を分類：${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join('、')}`);
})();
