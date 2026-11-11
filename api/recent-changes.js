const COMMITS_URL = 'https://api.github.com/repos/shin1007/chinjo-action/commits?sha=main&per_page=30';
const REPO_URL = 'https://github.com/shin1007/chinjo-action';
const LIMIT = 10;

// 日本時間の日付（YYYY-MM-DD）にする
const jstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const toItem = (commit) => {
  const subject = String(commit.commit?.message || '').split('\n')[0].trim();
  const pr = subject.match(/\(#(\d+)\)\s*$/);
  return {
    title: subject.replace(/\s*\(#\d+\)\s*$/, ''),
    date: jstDate(commit.commit?.committer?.date || commit.commit?.author?.date),
    url: pr ? `${REPO_URL}/pull/${pr[1]}` : `${REPO_URL}/commit/${commit.sha}`,
  };
};

module.exports = async (req, res) => {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'chinjo-site' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(COMMITS_URL, { headers });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const commits = await response.json();
    const items = commits
      .filter((commit) => (commit.parents || []).length < 2)
      .map(toItem)
      .filter((item) => item.title && !/^Merge /.test(item.title))
      .slice(0, LIMIT);
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ items });
  } catch (error) {
    console.error('Failed to load recent changes:', error);
    res.status(502).json({ error: 'Recent changes are unavailable' });
  }
};
