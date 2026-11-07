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

module.exports = async (req, res) => {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const response = await fetch(RSS_URL);
    if (!response.ok) throw new Error(`e-Gov RSS returned ${response.status}`);
    const xml = await response.text();
    const requested = typeof req.query?.keywords === 'string'
      ? req.query.keywords.split(',').map((word) => word.trim()).filter(Boolean)
      : DEFAULT_KEYWORDS;
    const keywords = requested.length ? requested : DEFAULT_KEYWORDS;
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
      .filter((item) => item.title && item.url && keywords.some((word) => `${item.title} ${item.text}`.includes(word)))
      .slice(0, 8)
      .map(({ text, ...item }) => item);

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ items });
  } catch (error) {
    console.error('Failed to load e-Gov public comments:', error);
    res.status(502).json({ error: 'Public comment feed is unavailable' });
  }
};
