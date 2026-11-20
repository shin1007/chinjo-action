# サイト紹介用の画像（X などに投稿する。600×750 の 4:5。サイトには置かない）を、テーマごとに3枚ずつ作る。
#   python scripts/make-promo-cards.py  → docs/見本/紹介画像/<テーマ>-<番号>.png
# 各テーマの国あての陳情の最初の3件について、件名と「いま」の説明（easy.js。一次資料で確かめた文）を載せる。
# 文や項目を直したら作り直す。
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
for (const f of ['asks-national.js', 'easy.js']) vm.runInNewContext(fs.readFileSync(path.join(dir, f), 'utf8'), { window });
process.stdout.write(JSON.stringify(window.ASKS.filter((a) => window.EASY[a.id]).map((a) => ({ id: a.id, label: a.label, ...window.EASY[a.id] }))));
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


def card(key, theme, hue, n, total, a):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    main, dark, soft = hsl(hue, 0.55, 0.55), hsl(hue, 0.55, 0.36), hsl(hue, 0.6, 0.94)
    d.rectangle((0, 0, 12, H), fill=main)
    # テーマの札と通し番号
    tf = f(22)
    tw = d.textlength(theme, font=tf)
    d.rounded_rectangle((44, 40, 44 + tw + 36, 80), 20, fill=soft)
    d.text((62, 60), theme, font=tf, fill=dark, anchor='lm')
    d.text((W - 44, 60), f'{n}/{total}', font=f(20, False), fill=SUB, anchor='rm')
    # 小さな陳情書に見立てた白い紙に、件名を大きく
    d.rounded_rectangle((46, 108, W - 38, 300), 14, fill=(232, 226, 214))
    d.rounded_rectangle((40, 102, W - 44, 294), 14, fill=PAPER, outline=LINE, width=2)
    d.rectangle((52, 102, W - 56, 107), fill=main)
    label = re.sub(r'（[^）]*）', '', a['label'])
    title = label + ('することを求める陳情' if label.endswith('に') else 'を求める陳情')
    for size in (36, 33, 30, 27, 24):
        lines = wrap(d, title, f(size), W - 132)
        if len(lines) <= 3 and len(lines[-1]) > 2:  # 最後の行が「情」だけのようにならない大きさにする
            break
    ty = 198 - len(lines) * size * 0.7
    for k, t in enumerate(lines):
        d.text((66, ty + k * size * 1.4), t, font=f(size), fill=INK)
    # いま、どうなっているか（easy.js の now）と、なぜ必要か（why）。入るところまで文の切れ目で取る
    bf, y = f(20, False), 326
    left = 9
    for head, key2 in (('いま、どうなっているか', 'now'), ('なぜ必要か', 'why')):
        if left < 2:
            break
        lines = sentences(a[key2], d, bf, W - 88, left)
        if key2 == 'why' and lines[-1].endswith('…'):
            break  # 文の途中で切れるなら「なぜ」は載せない（切った文は意味が変わりうる）
        d.text((44, y), head, font=f(22), fill=dark)
        y += 40
        for t in lines:
            d.text((44, y), t, font=bf, fill=INK)
            y += 31
        y += 16
        left -= len(lines) + 2
    # 下：費用と行き先
    d.line((44, 668, W - 44, 668), fill=LINE, width=2)
    d.text((44, 692), '陳情書は選ぶだけで作れます　陳情5件を郵送して約480円', font=f(18), fill=ACC, anchor='lm')
    d.text((44, 720), f'{SITE}/{key}/easy/{a["id"]}', font=f(16, False), fill=SUB, anchor='lm')
    return im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for key, theme, hue in THEMES:
        asks = load(key)[:PER]
        for n, a in enumerate(asks, 1):
            p = OUT / f'{key}-{n}.png'
            card(key, theme, hue, n, len(asks), a).save(p, optimize=True)
            print(p.name, a['label'])


if __name__ == '__main__':
    main()
