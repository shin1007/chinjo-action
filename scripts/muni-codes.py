# 総務省の「都道府県コード及び市区町村コード」の Excel から site/data/muni-codes.js を作る
# 使い方：python scripts/muni-codes.py 000925835.xlsx（https://www.soumu.go.jp/denshijiti/code.html から保存したもの。openpyxl が要る）
import json
import re
import sys

import openpyxl

wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
rows = list(wb.worksheets[0].iter_rows(values_only=True))[1:]  # 「現在の団体」のシート
src = open('site/data/municipalities.js', encoding='utf-8').read()
M = json.loads(re.search(r'window.MUNICIPALITIES = (\{.*?\});', src, re.S).group(1))
prefs = re.findall(r"'([^']+)'", re.search(r'PREFS = \[(.*?)\]', open('site/data/prefs.js', encoding='utf-8').read(), re.S).group(1))


def nz(t):
    # 「ヶ」「ケ」、「梼」「檮」の書き方の違いをそろえる
    return t and t.replace('ヶ', 'ケ').replace('梼', '檮')


code = {}
for r in rows:
    code[(r[1], nz(r[2]) or '@')] = str(r[0])[:5]

miss, out = [], {}
for i, p in enumerate(prefs):
    assert code[(p, '@')] == f'{i + 1:02d}000', p
    arr = []
    for n in M[p]:
        # このサイトの町村名には郡名が付いている（総務省の一覧には付いていない）
        c = code.get((p, nz(n))) or code.get((p, nz(re.sub(r'^.+?郡', '', n, count=1))))
        if not c:
            miss.append((p, n))
            continue
        assert c[:2] == f'{i + 1:02d}'
        arr.append(int(c[2:]))
    assert len(set(arr)) == len(arr), p
    out[p] = arr
assert not miss, miss

body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
with open('site/data/muni-codes.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write('// 市区町村の全国地方公共団体コード（上5桁から都道府県の2桁を除いた3桁）。data/municipalities.js と同じ並び。\n')
    f.write('// 共有リンク・QR コードを短くするために使う（例：東京都世田谷区 → 13112）。都道府県の議会は「都道府県の2桁＋000」。\n')
    f.write('// 出典：総務省「都道府県コード及び市区町村コード」（令和6年1月1日更新） https://www.soumu.go.jp/denshijiti/code.html\n')
    f.write('// 作り方：python scripts/muni-codes.py <総務省の Excel ファイル>\n')
    f.write(f'window.MUNI_CODES = {body};\n')
