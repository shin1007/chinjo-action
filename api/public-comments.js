const RSS_URL = 'https://public-comment.e-gov.go.jp/rss/pcm_list.xml';
const DEFAULT_KEYWORDS = [
  '共同親権', '親子交流', '面会交流', 'こども家庭', '児童',
  '親権', '家族法', '民法', '養育費', 'ひとり親',
];

const decodeXml = (value) => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')
  .trim();

const tagValue = (item, tag) => {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return decodeXml(match && match[1]);
};

const plainText = (value) => value
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const parseDescription = (description) => {
  const text = plainText(description);
  const deadline = text.match(/受付締切日時：\s*([^<]+?)(?=\s*(?:カテゴリー|問合せ先|$))/);
  const agency = text.match(/問合せ先（所管省庁・部局名等）：\s*(.+)$/);
  return {
    deadline: deadline ? deadline[1].trim() : '',
    agency: agency ? agency[1].trim() : '',
    text,
  };
};

// 利用者が決められるのは絞り込みの語だけ。個数と長さを抑え、上流（e-Gov）へは数分に1回しか取りに行かない
const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LENGTH = 30;
const FETCH_TIMEOUT_MS = 8000;
const XML_TTL_MS = 5 * 60 * 1000;
let cache = { xml: '', at: 0 };

const parseKeywords = (raw) => {
  if (typeof raw !== 'string') return DEFAULT_KEYWORDS;
  const words = raw.slice(0, 500).split(',')
    .map((word) => word.trim().slice(0, MAX_KEYWORD_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
  return words.length ? words : DEFAULT_KEYWORDS;
};

// リンクに使うのは http(s) だけ（javascript: などを通さない）
const isWebUrl = (url) => /^https?:\/\/[^\s]+$/i.test(url);

const loadXml = async () => {
  if (cache.xml && Date.now() - cache.at < XML_TTL_MS) return cache.xml;
  const response = await fetch(RSS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`e-Gov RSS returned ${response.status}`);
  cache = { xml: await response.text(), at: Date.now() };
  return cache.xml;
};

const handler = async (req, res) => {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const xml = await loadXml();
    const keywords = parseKeywords(req.query?.keywords);
    const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
      .map((match) => {
        const body = match[1];
        const title = tagValue(body, 'title');
        const description = tagValue(body, 'description');
        const details = parseDescription(description);
        return {
          title,
          url: tagValue(body, 'link') || decodeXml((body.match(/rdf:about="([^"]+)"/i) || [])[1]),
          ...details,
        };
      })
      .filter((item) => item.title && isWebUrl(item.url) && keywords.some((word) => `${item.title} ${item.text}`.includes(word)))
      .slice(0, 8)
      .map(({ text, ...item }) => item);

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ items });
  } catch (error) {
    console.error('Failed to load e-Gov public comments:', error);
    res.status(502).json({ error: 'Public comment feed is unavailable' });
  }
};

module.exports = handler;
module.exports.parseKeywords = parseKeywords;
module.exports.resetCache = () => { cache = { xml: '', at: 0 }; };
