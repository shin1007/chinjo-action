# サイト紹介用の画像（X などに投稿する。600×750 の 4:5。サイトには置かない）を、テーマごとに3枚ずつ作る。
#   python scripts/make-promo-cards.py  → docs/見本/紹介画像/<テーマ>-<番号>.png
# 1枚に同じテーマの陳情を何件も並べる。1・2枚目は国に求める陳情（最初の12件を半分ずつ）、3枚目は自治体に求める陳情。
# 項目を直したら作り直す。
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / '見本' / '紹介画像'
FONT_B = 'C:/Windows/Fonts/BIZ-UDGothicB.ttc'
FONT_R = 'C:/Windows/Fonts/BIZ-UDGothicR.ttc'
f = lambda size, bold=True: ImageFont.truetype(FONT_B if bold else FONT_R, size)
BG, INK, SUB, ACC, LINE, PAPER = '#fbf8f2', '#2b2b2b', '#6b6b6b', '#d9653b', '#e6dfd2', '#ffffff'
W, H = 600, 750
SITE = 'chinjo-action.vercel.app'
# [フォルダ, テーマ名, 色相]（scripts/make-howto-gif.py の陳情書の帯と同じ）
THEMES = [('kodomo', '子どもの権利', 20), ('dansei', '男女平等', 200), ('nihonjin', '日本人の権利', 350),
          ('shiho', '司法への参加', 260), ('kenko', '国民の健康', 150), ('sonota', 'その他の陳情', 40)]
PER = 3

# asks-national.js と easy.js を node で読んで、件名と説明を取り出す
JS = r'''
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = process.argv[1];
const window = {};
const out = {};
for (const f of ['asks-national.js', 'asks-local.js']) {
  if (!fs.existsSync(path.join(dir, f))) continue;
  window.ASKS = [];
  vm.runInNewContext(fs.readFileSync(path.join(dir, f), 'utf8'), { window });
  out[f] = window.ASKS.map((a) => a.label);
}
process.stdout.write(JSON.stringify(out));
'''


def load(key):
    out = subprocess.run(['node', '-e', JS, str(ROOT / 'site' / 'themes' / key)], capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def hsl(h, s, l):
    import colorsys
    return '#%02x%02x%02x' % tuple(round(v * 255) for v in colorsys.hls_to_rgb(h / 360, l, s))


def wrap(d, text, font, width):
    lines, cur = [], ''
    for c in text:
        if d.textlength(cur + c, font=font) > width and cur:
            # 句読点や閉じかっこは行頭に置かない
            if c in '、。）」』，．':
                lines.append(cur[:-1])
                cur = cur[-1] + c
            else:
                lines.append(cur)
                cur = c
        else:
            cur += c
    return lines + [cur] if cur else lines


def sentences(text, d, font, width, max_lines):
    """文の切れ目で、max_lines 行に収まるところまで取る"""
    parts = [p + '。' for p in text.split('。') if p]
    take = []
    for p in parts:
        if len(wrap(d, ''.join(take + [p]), font, width)) > max_lines:
            break
        take.append(p)
    if not take:  # 1文目から長すぎるときは、行の途中で切る
        lines = wrap(d, parts[0], font, width)[:max_lines]
        return lines[:-1] + [lines[-1][:-1] + '…']
    return wrap(d, ''.join(take), font, width)


def card(key, theme, hue, n, heading, count, labels):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    main, dark, soft = hsl(hue, 0.55, 0.55), hsl(hue, 0.55, 0.36), hsl(hue, 0.6, 0.94)
    d.rectangle((0, 0, 12, H), fill=main)
    tf = f(22)
    tw = d.textlength(theme, font=tf)
    d.rounded_rectangle((44, 36, 44 + tw + 36, 76), 20, fill=soft)
    d.text((62, 56), theme, font=tf, fill=dark, anchor='lm')
    d.text((W - 44, 56), f'{n}/3', font=f(20, False), fill=SUB, anchor='rm')
    d.text((44, 100), heading, font=f(30), fill=INK)
    d.text((44, 146), f'このテーマには{count}件あります。選んで出せます', font=f(17, False), fill=SUB)
    # 小さな陳情書に見立てた紙を、件名ごとに1枚ずつ重ねて並べる
    top, bottom, gap = 184, 652, 12
    # 件数が少ない画像は、紙と字を大きくして余白を埋める
    fs, pad = (26, 40) if len(labels) <= 3 else (23, 32) if len(labels) <= 4 else (19, 24)
    lh = round(fs * 1.37)
    lf = f(fs)
    items = []
    for t in labels:
        t = re.sub(r'（[^）]*）', '', t)
        lines = wrap(d, t, lf, W - 150)
        if len(lines) > 2:
            lines = [lines[0], lines[1][:-1] + '…']
        items.append(lines)
    hs = [pad + lh * len(x) for x in items]
    y = top + max(0, (bottom - top - sum(hs) - gap * (len(hs) - 1)) // 2)
    for lines, h in zip(items, hs):
        d.rounded_rectangle((44, y + 3, W - 40, y + h + 3), 10, fill=(232, 226, 214))
        d.rounded_rectangle((40, y, W - 44, y + h), 10, fill=PAPER, outline=LINE, width=1)
        d.rectangle((40, y + 8, 45, y + h - 8), fill=main)
        d.text((66, y + h // 2), '✓', font=f(fs + 1), fill=main, anchor='mm')
        for k, t in enumerate(lines):
            d.text((88, y + pad // 2 + k * lh), t, font=lf, fill=INK)
        y += h + gap
    d.line((44, 668, W - 44, 668), fill=LINE, width=2)
    d.text((44, 692), '陳情書は選ぶだけで作れます　陳情5件を郵送して約480円', font=f(18), fill=ACC, anchor='lm')
    d.text((44, 720), f'{SITE}/{key}', font=f(16, False), fill=SUB, anchor='lm')
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, theme, hue in THEMES:
        data = load(key)
        nat, loc = data.get('asks-national.js', []), data.get('asks-local.js', [])
        first = nat[:12]
        half = (len(first) + 1) // 2
        pages = [('国に求める陳情', len(nat), first[:half]),
                 ('国に求める陳情（つづき）', len(nat), first[half:]),
                 ('自治体に求める陳情', len(loc), loc[:6])]
        for n, (heading, count, labels) in enumerate(pages, 1):
            p = OUT / f'{key}-{n}.png'
            card(key, theme, hue, n, heading, count, labels).save(p, optimize=True)
            print(p.name, len(labels))


if __name__ == '__main__':
    main()
