#!/usr/bin/env python3
# 「陳情が採択された例」の候補を、議会の公式サイトの結果一覧から機械で拾う。
# 各議会の陳情の案内ページ（site/data/sites.js）から、「請願・陳情」「結果」などのリンクを3段までたどり、
# HTML と PDF の文字のうち、テーマの言葉と結果の「採択」を含む行を候補として書き出す。
# 拾った行は候補にすぎない。サイトに載せる前に、必ず公式の資料を開いて採否・番号・日付を確かめる
# （手順と、これまでの結果は docs/調査/採択例の探し方と結果.md）。
#
#   python scripts/adopted-scan.py                 … 全国（終わった議会は飛ばすので、途中で止めても続きから）
#   python scripts/adopted-scan.py 東京都 大阪府    … 都道府県を絞る
#   python scripts/adopted-scan.py --again         … 終わった議会もやり直す
#
# 出力：scripts/.intake-cache/adopted/candidates.tsv（テーマ・議会・URL・行。重複は除く）
#       scripts/.intake-cache/adopted/done.json（たどり終えた議会）
# 要るもの：pip install pypdf
import concurrent.futures as cf
import html
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'scripts', '.intake-cache', 'adopted')
os.makedirs(OUT, exist_ok=True)
DONE = os.path.join(OUT, 'done.json')
CAND = os.path.join(OUT, 'candidates.tsv')

# テーマごとの言葉（site/themes/<テーマ>/asks-*.js の内容に合わせる）
THEMES = {
    'kodomo': r'親権|共同養育|面会交流|親子交流|連れ去|養育費|離婚後の子',
    'dansei': r'男性.{0,10}(DV|被害|相談|自殺|支援)|女子枠|男女共同参画.{0,10}(見直|検証)|DV防止法.{0,6}前文',
    'nihonjin': r'外国人|外国資本|外国法人|土地.{0,6}(取得|購入|売買|規制)|国籍条項|技能実習|不法滞在|不法就労|通名|通称名|ヘイト|差別的言動',
    'shiho': r'家庭裁判所|国民審査|裁判官|調停委員|司法.{0,4}(参加|改革)|量刑',
    'kenko': r'受動喫煙|たばこ|喫煙|がん検診|特定健診|依存症|ギャンブル|パチンコ|アルコール|砂糖|糖分',
    'sonota': r'教職員定数|正規.{0,4}教員|臨時的任用|宗教法人|私立.{0,6}(授業料|無償)|NPO|ヘッドライト|騒音|偏向報道|訂正報道',
}
THEME_RE = {k: re.compile(v) for k, v in THEMES.items()}
# 結果としての「採択」。「不採択」「趣旨採択」や、件名の「〜の採択を求める」は外す
ADOPTED = re.compile(r'(?<!不)(?<!趣旨)(?<!一部)採択(?!を求|を要望|に関す|を願|しない|されな|すべきでない)')
FOLLOW = re.compile(r'請願|陳情|審査結果|議決結果|審議結果|結果|chinjo|tinjo|tinjyo|chinjyo|seigan|kekka|seichin', re.I)
SKIP = re.compile(r'\.(jpg|jpeg|png|gif|zip|docx?|xlsx?|pptx?)(\?|$)|mailto:|javascript:', re.I)
PAGES_PER_COUNCIL = 120
UA = {'User-Agent': 'Mozilla/5.0 (compatible; chinjo-action adopted-scan)'}


def load_sites():
    src = open(os.path.join(ROOT, 'site', 'data', 'sites.js'), encoding='utf-8').read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=20) as r:
            return r.read(3_000_000), r.headers.get('Content-Type', '')
    except Exception:
        return b'', ''


def to_text(b, ct, u):
    if u.lower().split('?')[0].endswith('.pdf') or 'pdf' in ct:
        try:
            return '\n'.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(b)).pages[:60])
        except Exception:
            return ''
    m = re.search(rb'charset=["\']?([\w-]+)', b[:3000])
    encs = [m.group(1).decode()] if m else []
    for e in encs + ['utf-8', 'cp932', 'euc-jp']:
        try:
            return b.decode(e)
        except Exception:
            pass
    return b.decode('utf-8', 'replace')


def lines_of(t, is_pdf):
    # 1件ずつに分ける。件名と結果が別の行・別の欄にある議会が多いので、
    # 「陳情第〇号」「請願〇号」などの番号の手前で区切り、その件の範囲で件名と結果を見る
    plain = t if is_pdf else re.sub(r'<[^>]+>', ' ', re.sub(r'(?is)<(script|style).*?</\1>', ' ', t))
    plain = re.sub(r'\s+', ' ', html.unescape(plain))
    for x in re.split(r'(?=(?:陳情|請願)\s*(?:第\s*)?[\d０-９]|第\s*[\d０-９]+\s*号\s*(?:陳情|請願))', plain):
        x = x.strip()
        if 6 < len(x) < 600:
            yield x


def scan_council(name, start):
    seen, hits = set(), []
    host = urllib.parse.urlparse(start).netloc

    def visit(u, depth):
        if u in seen or len(seen) >= PAGES_PER_COUNCIL:
            return
        seen.add(u)
        b, ct = get(u)
        t = to_text(b, ct, u)
        if not t:
            return
        for x in lines_of(t, u.lower().split('?')[0].endswith('.pdf') or 'pdf' in ct):
            if ADOPTED.search(x):
                for k, r in THEME_RE.items():
                    if r.search(x):
                        hits.append((k, name, u, x))
        if depth == 0 or u.lower().endswith('.pdf'):
            return
        for href, label in re.findall(r'<a[^>]+href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', t, re.S | re.I):
            v = urllib.parse.urljoin(u, html.unescape(href))
            if urllib.parse.urlparse(v).netloc != host or SKIP.search(v):
                continue
            if FOLLOW.search(re.sub(r'<[^>]+>', '', label) + ' ' + v):
                visit(v, depth - 1)

    visit(start, 3)
    return name, hits, len(seen)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    again = '--again' in sys.argv
    sites = load_sites()
    done = {} if again or not os.path.exists(DONE) else json.load(open(DONE, encoding='utf-8'))
    old = set()
    if os.path.exists(CAND):
        old = set(open(CAND, encoding='utf-8').read().splitlines())
    jobs = []
    for pref, munis in sites.items():
        if args and pref not in args:
            continue
        for muni, v in munis.items():
            name = f'{pref}議会' if muni == '@' else f'{pref}{re.sub(r"^.+?郡", "", muni)}議会'
            start = (v[1] if len(v) > 1 and v[1] else '') or (v[2] if len(v) > 2 and v[2] else '') or v[0]
            if start and name not in done:
                jobs.append((name, start))
    print(f'{len(jobs)}議会をたどります', file=sys.stderr)
    new = 0
    with cf.ThreadPoolExecutor(max_workers=8) as ex, open(CAND, 'a', encoding='utf-8') as out:
        for i, f in enumerate(cf.as_completed([ex.submit(scan_council, n, s) for n, s in jobs]), 1):
            name, hits, n = f.result()
            for h in hits:
                row = '\t'.join(h)
                if row not in old:
                    old.add(row)
                    out.write(row + '\n')
                    new += 1
            out.flush()
            done[name] = n
            if i % 20 == 0 or i == len(jobs):
                json.dump(done, open(DONE, 'w', encoding='utf-8'), ensure_ascii=False)
                print(f'{i}/{len(jobs)} 新しい候補 {new}件', file=sys.stderr)
    print(f'候補は {CAND} にあります（新しく {new}件）。載せる前に公式の資料で確かめてください。', file=sys.stderr)


if __name__ == '__main__':
    main()
