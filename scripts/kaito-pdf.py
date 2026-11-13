#!/usr/bin/env python3
# 回答の一覧が PDF・エクセルになっている自治体（例：世田谷区の「区民の声の公表（令和8年7月受付分）」）の
# ファイルを落として、ページ（エクセルは行）ごとの文字にする。kaito-build.js がこれを読んで項目に関係のあるところを探す。
#   python scripts/kaito-pdf.py [id ...]
# 入力：scripts/.intake-cache/kaito/*.json（kaito-fetch.js の結果）
# 出力：scripts/.intake-cache/kaito-files/<id>.json  … [{"u": URL, "t": リンクの文字, "pages": ["1ページ目の文字", ...]}]
#       落としたファイルそのものは scripts/.intake-cache/kaito-files/raw/ に置く（公開しない）
# 要るもの：pip install pdfplumber openpyxl
import json, os, re, sys, time, hashlib, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'scripts', '.intake-cache')
SRC = os.path.join(CACHE, 'kaito')
OUT = os.path.join(CACHE, 'kaito-files')
RAW = os.path.join(OUT, 'raw')
os.makedirs(RAW, exist_ok=True)

WANT = re.compile(r'声|意見|回答|提案|要望|受付分|手紙|メール')
SKIP = re.compile(r'件数|要領|要綱|様式|取扱|統計|集計|概要|報告書|チラシ|パンフ|公表の対象とならない|申込')
FILE = re.compile(r'\.(pdf|xlsx|xls)(\?|$)', re.I)

def fetch(u):
    p = os.path.join(RAW, hashlib.sha1(u.encode()).hexdigest()[:16] + os.path.splitext(u.split('?')[0])[1].lower())
    if not os.path.exists(p):
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (compatible; petition-guide-checker)'})
        with urllib.request.urlopen(req, timeout=60) as r, open(p, 'wb') as f:
            f.write(r.read())
        time.sleep(1)
    return p

def text_of(p):
    if p.endswith('.pdf'):
        import pdfplumber
        with pdfplumber.open(p) as pdf:
            return [(pg.extract_text() or '') for pg in pdf.pages[:60]]
    if p.endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        rows = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                t = ' | '.join(str(c) for c in row if c not in (None, ''))
                if len(t) > 20: rows.append(t)
        return rows[:2000]
    return []

def main():
    only = sys.argv[1:]
    for f in sorted(os.listdir(SRC)):
        d = json.load(open(os.path.join(SRC, f), encoding='utf-8'))
        if only and d['id'] not in only: continue
        files = []
        seen = set()
        for l in d.get('lists') or []:
            if l.get('pdf') and l['u'] not in seen:
                seen.add(l['u']); files.append({'u': l['u'], 't': l.get('t', '')})
            for it in l.get('items') or []:
                if FILE.search(it['u']) and WANT.search(it['t']) and not SKIP.search(it['t']) and it['u'] not in seen:
                    seen.add(it['u']); files.append({'u': it['u'], 't': it['t']})
        if not files: continue
        # 同じ題名の PDF とエクセルがあれば PDF を使う。新しいものから24件まで
        pdf_titles = {re.sub(r'（(PDF|エクセル|Excel).*', '', x['t']) for x in files if x['u'].lower().split('?')[0].endswith('.pdf')}
        files = [x for x in files if x['u'].lower().split('?')[0].endswith('.pdf') or re.sub(r'（(PDF|エクセル|Excel).*', '', x['t']) not in pdf_titles][:24]
        out_f = os.path.join(OUT, f)
        old = {x['u']: x for x in json.load(open(out_f, encoding='utf-8'))} if os.path.exists(out_f) else {}
        res = []
        for x in files:
            if x['u'] in old and old[x['u']].get('pages'):
                res.append(old[x['u']]); continue
            try:
                res.append({**x, 'pages': text_of(fetch(x['u']))})
            except Exception as e:
                res.append({**x, 'error': str(e)[:100], 'pages': []})
        json.dump(res, open(out_f, 'w', encoding='utf-8'), ensure_ascii=False)
        print(d['id'], len(res), sum(len(x['pages']) for x in res), file=sys.stderr, flush=True)

main()
