# 自治体の Word の様式（.docx）の段落に、文面を入れる。scripts/unei-form.js から呼ぶ。
#   python scripts/unei-docx.py <様式.docx> <入れる内容.json> <書き出す.docx>
# 入れる内容.json：{"set": {"段落の番号": "文"}, "lines": {"段落の番号": ["1行目", "2行目"]}}
#   set   … その段落の文字を置き換える（書式は段落の最初の文字のものを使う）
#   lines … その段落を行の数だけ複製して、1行ずつ入れる（趣旨・理由など長い文）
# 段落の番号は 0 から。様式の段落の並びは、様式ごとに scripts/unei-form.js の DOCX に書く。
import json
import re
import sys
import zipfile
from xml.sax.saxutils import escape


def main(src, spec_path, out):
    spec = json.load(open(spec_path, encoding='utf-8'))
    with zipfile.ZipFile(src) as z:
        files = {n: z.read(n) for n in z.namelist()}
    xml = files['word/document.xml'].decode('utf-8')
    paras = list(re.finditer(r'<w:p[ >].*?</w:p>|<w:p/>', xml, re.S))

    def with_text(p, text):
        # 最初の文字の書式（w:rPr）を残して、文字を1つの w:r にまとめる
        ppr = re.search(r'<w:pPr>.*?</w:pPr>', p, re.S)
        rpr = re.search(r'<w:rPr>.*?</w:rPr>', p[ppr.end() if ppr else 0:], re.S)
        head = re.match(r'<w:p[^>]*>', p).group(0) if not p.startswith('<w:p/>') else '<w:p>'
        run = f'<w:r>{rpr.group(0) if rpr else ""}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
        return f'{head}{ppr.group(0) if ppr else ""}{run}</w:p>'

    out_parts, last = [], 0
    for i, m in enumerate(paras):
        out_parts.append(xml[last:m.start()])
        p = m.group(0)
        key = str(i)
        if key in spec.get('lines', {}):
            out_parts.append(''.join(with_text(p, line) for line in spec['lines'][key]))
        elif key in spec.get('set', {}):
            out_parts.append(with_text(p, spec['set'][key]))
        elif key in spec.get('drop', []):
            pass
        else:
            out_parts.append(p)
        last = m.end()
    out_parts.append(xml[last:])
    files['word/document.xml'] = ''.join(out_parts).encode('utf-8')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, b in files.items():
            z.writestr(n, b)


if __name__ == '__main__':
    main(*sys.argv[1:4])
