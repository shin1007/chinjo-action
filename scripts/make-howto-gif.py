# 郵送で陳情書を出す流れを紹介する GIF を作る（site/img/mail-howto.gif と、スマホ用の縦長 mail-howto-tall.gif）。
# 画面のスクリーンショットは使わず、手順と金額だけをイラストで見せる（サイトの作りが変わっても使えるように）。
# 金額を変えるときは STEPS の cost と、下の NOTE を直して `python scripts/make-howto-gif.py` を実行する。
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / 'site' / 'img' / 'mail-howto.gif'  # トップページ（/）からリンクしている
FONT_B = 'C:/Windows/Fonts/BIZ-UDGothicB.ttc'
FONT_R = 'C:/Windows/Fonts/BIZ-UDGothicR.ttc'
f = lambda size, bold=True: ImageFont.truetype(FONT_B if bold else FONT_R, size)

BG, INK, SUB, ACC, LINE = '#fbf8f2', '#2b2b2b', '#6b6b6b', '#d9653b', '#e6dfd2'
PAPER, BLUE, GREEN = '#ffffff', '#3b6fb6', '#4a8f5a'

NOTE = '金額は陳情書5件（1件3枚）＋送付状を1通で郵送するときの目安。2026年11月時点'

# 手順：（見出し、補足、金額の表示、合計に足す円、絵）
STEPS = [
    ('サイトで入力する', '求めることを選ぶ\n出す先の議会を選ぶ\n住所・氏名を入れる（空けて手書きでもよい）', '無料', 0, 'screen'),
    ('PDFを保存する', '全部が1つのPDFになる\nUSBメモリーに入れる\nスマホからネットプリントに登録してもよい', '無料', 0, 'usb'),
    ('コンビニで印刷する', 'USBから白黒A4・1枚10円（ネットプリントは20円）\n陳情書15枚・送付状1枚・宛名の用紙1枚\n出し方メモ2枚（スマホで見るなら要らない）', '19枚 190円', 190, 'printer'),
    ('日付を書いて署名する', '日付は空欄なので、出す日を手書きする\n住所・氏名を空けたなら、それも手書きする\n押印は議会によって要らない', '', 0, 'pen'),
    ('宛名と差出人を切る', '切り取り線で切る\nラベル用紙なら、はがすだけ', '', 0, 'scissors'),
    ('クリアファイルに入れる', '全部をまとめて1枚に入れる', '約11円', 11, 'file'),
    ('角2封筒に入れる', 'A4を折らずに入れる', '約10円', 10, 'envelope'),
    ('宛名と切手を貼る', '宛名は表に、差出人は裏に、のりで貼る\n16枚とクリアファイルで約100g\n厚手の紙や封筒でも150gまで届く270円', '切手 270円', 270, 'stamp'),
    ('ポストに出す', '締切の1週間前には届くように出す', '', 0, 'post'),
]


def mail_stats():
    """受け付け方のDB（site/data/intake/chinjo.jsonl）から、郵送で出せるとわかっている議会の数と人口の割合を数える。
    議員に配るだけ（distribute）の議会も、郵送で受け取るので数に入れる"""
    import json
    root = Path(__file__).resolve().parent.parent
    acc = {'municipality': [0, 0, 0], 'pref': [0, 0, 0]}  # [議会の数, その人口, 全体の人口]
    for line in open(root / 'site' / 'data' / 'intake' / 'chinjo.jsonl', encoding='utf-8'):
        r = json.loads(line)
        a, pop = acc[r['level']], r.get('population') or 0
        a[2] += pop
        if r['methods']['mail']['resident'] in ('review', 'accept', 'distribute'):
            a[0] += 1
            a[1] += pop
    pct = lambda a: round(a[1] / a[2] * 100)
    m, p = acc['municipality'], acc['pref']
    return (f'郵送で出せるとわかっている議会 {m[0] + p[0]}か所', f'市区町村議会 {m[0]}（人口の約{pct(m)}%）',
            f'都道府県議会 {p[0]}（人口の約{pct(p)}%）')


_post = STEPS[-1]
STEPS[-1] = (_post[0], '\n'.join((_post[1],) + mail_stats()), *_post[2:])


def icon(d, kind, cx, cy):
    """手順の絵を、(cx, cy) を中心に描く（およそ 220×220）"""
    if kind == 'screen':
        d.rounded_rectangle((cx - 100, cy - 75, cx + 100, cy + 65), 12, fill=PAPER, outline=INK, width=5)
        for i, w in enumerate((140, 110, 150)):
            d.rounded_rectangle((cx - 75, cy - 50 + i * 32, cx - 75 + w, cy - 34 + i * 32), 6, fill=LINE)
        d.rectangle((cx - 30, cy + 65, cx + 30, cy + 85), fill=INK)
        d.rounded_rectangle((cx - 60, cy + 85, cx + 60, cy + 95), 4, fill=INK)
    elif kind == 'usb':
        d.rounded_rectangle((cx - 45, cy - 40, cx + 45, cy + 95), 14, fill=BLUE)
        d.rectangle((cx - 28, cy - 95, cx + 28, cy - 40), fill='#c9ccd1', outline=INK, width=4)
        d.rectangle((cx - 15, cy - 82, cx - 5, cy - 68), fill=INK)
        d.rectangle((cx + 5, cy - 82, cx + 15, cy - 68), fill=INK)
        d.text((cx, cy + 30), 'PDF', font=f(30), fill='#fff', anchor='mm')
    elif kind == 'printer':
        # コンビニのマルチコピー機：背の高い本体、上に原稿台、前に操作パネル（画面・お金の入口）、横に排紙トレイ
        d.rectangle((cx - 95, cy - 70, cx + 75, cy + 110), fill='#e9ebee', outline=INK, width=5)
        d.rectangle((cx - 100, cy - 95, cx + 80, cy - 70), fill='#c9ccd1', outline=INK, width=5)
        d.polygon([(cx - 60, cy - 30), (cx + 50, cy - 30), (cx + 60, cy + 10), (cx - 70, cy + 10)], fill='#8a8f98', outline=INK)
        d.rectangle((cx - 50, cy - 24, cx + 5, cy + 4), fill='#9fd0f0', outline=INK, width=2)
        d.rectangle((cx + 18, cy - 22, cx + 42, cy - 14), fill=INK)
        d.ellipse((cx + 24, cy - 8, cx + 36, cy + 4), fill='#e0b030')
        for i in range(3):
            d.line((cx - 80, cy + 35 + i * 22, cx + 60, cy + 35 + i * 22), fill='#b8bcc3', width=3)
        d.rectangle((cx + 75, cy - 20, cx + 125, cy - 5), fill='#c9ccd1', outline=INK, width=3)
        d.rectangle((cx + 82, cy - 45, cx + 118, cy - 18), fill=PAPER, outline=INK, width=2)
        d.rounded_rectangle((cx - 135, cy - 40, cx - 108, cy + 2), 4, fill=BLUE)
        d.line((cx - 108, cy - 20, cx - 95, cy - 20), fill=INK, width=4)
    elif kind == 'pen':
        d.rectangle((cx - 85, cy - 100, cx + 70, cy + 100), fill=PAPER, outline=INK, width=4)
        for i in range(5):
            d.line((cx - 65, cy - 75 + i * 25, cx + 50, cy - 75 + i * 25), fill=LINE, width=6)
        d.line((cx - 60, cy + 70, cx - 30, cy + 50, cx - 5, cy + 72, cx + 25, cy + 52), fill=BLUE, width=5, joint='curve')
        d.polygon([(cx + 40, cy + 40), (cx + 110, cy - 40), (cx + 125, cy - 25), (cx + 55, cy + 55)], fill=ACC, outline=INK)
        d.polygon([(cx + 40, cy + 40), (cx + 55, cy + 55), (cx + 30, cy + 65)], fill=INK)
    elif kind == 'scissors':
        d.rectangle((cx - 100, cy - 95, cx + 100, cy + 95), fill=PAPER, outline=INK, width=4)
        for x in range(cx - 100, cx + 100, 18):
            d.line((x, cy, x + 9, cy), fill=SUB, width=3)
        for y in range(cy - 95, cy + 95, 18):
            d.line((cx, y, cx, y + 9), fill=SUB, width=3)
        d.text((cx - 50, cy - 48), '宛名', font=f(26), fill=INK, anchor='mm')
        d.text((cx + 50, cy - 48), '宛名', font=f(26), fill=INK, anchor='mm')
        d.text((cx - 50, cy + 48), '差出人', font=f(22), fill=INK, anchor='mm')
        d.ellipse((cx + 95, cy - 20, cx + 125, cy + 10), outline=ACC, width=6)
        d.ellipse((cx + 95, cy + 10, cx + 125, cy + 40), outline=ACC, width=6)
        d.line((cx + 100, cy, cx + 60, cy + 4), fill=INK, width=5)
        d.line((cx + 100, cy + 10, cx + 60, cy + 4), fill=INK, width=5)
    elif kind == 'file':
        d.rectangle((cx - 70, cy - 95, cx + 75, cy + 95), fill=PAPER, outline=INK, width=3)
        d.rectangle((cx - 85, cy - 105, cx + 85, cy + 105), fill=None, outline=BLUE, width=6)
        d.line((cx - 85, cy - 105, cx + 85, cy - 105), fill='#9fbfe6', width=10)
        for i in range(5):
            d.line((cx - 50, cy - 60 + i * 26, cx + 50, cy - 60 + i * 26), fill=LINE, width=6)
    elif kind == 'envelope':
        # 角2は縦長。口は上。A4を折らずに上から入れる
        d.rectangle((cx - 55, cy - 125, cx + 55, cy + 20), fill=PAPER, outline=BLUE, width=4)
        d.rectangle((cx - 75, cy - 80, cx + 75, cy + 120), fill='#d8b37c', outline=INK, width=5)
        d.polygon([(cx - 75, cy - 80), (cx - 75, cy - 110), (cx + 75, cy - 110), (cx + 75, cy - 80)], fill='#caa168', outline=INK)
        d.text((cx, cy + 50), '角2', font=f(34), fill=INK, anchor='mm')
    elif kind == 'stamp':
        # 縦長の封筒：切手は左上、宛名は中央に縦長のラベル
        d.rectangle((cx - 75, cy - 110, cx + 75, cy + 110), fill='#d8b37c', outline=INK, width=5)
        d.rectangle((cx - 65, cy - 100, cx - 25, cy - 52), fill='#f3d3c4', outline=ACC, width=4)
        d.text((cx - 45, cy - 76), '切手', font=f(14), fill=ACC, anchor='mm')
        d.rectangle((cx - 50, cy - 35, cx + 55, cy + 95), fill=PAPER, outline=INK, width=3)
        d.text((cx + 2, cy - 5), '〇〇議会', font=f(20), fill=INK, anchor='mm')
        d.text((cx + 2, cy + 25), '議長 様', font=f(20), fill=INK, anchor='mm')
        d.text((cx + 2, cy + 65), '陳情書在中', font=f(14), fill=ACC, anchor='mm')
    elif kind == 'post':
        d.rounded_rectangle((cx - 70, cy - 100, cx + 70, cy + 70), 30, fill='#d23b2f', outline=INK, width=5)
        d.rectangle((cx - 45, cy - 60, cx + 45, cy - 45), fill=INK)
        d.text((cx, cy + 10), '〒', font=f(54), fill='#fff', anchor='mm')
        d.rectangle((cx - 15, cy + 70, cx + 15, cy + 110), fill=INK)
        d.rectangle((cx - 30, cy - 85, cx + 30, cy - 65), fill='#d8b37c', outline=INK, width=3)



LAYOUTS = {
    # トップページ（/）でその場で再生する横（PC）と縦（スマホ）。最後のコマは「▼ 下からテーマを選ぶ」
    'wide': dict(size=(960, 540), out=OUT, end='themes'),
    'tall': dict(size=(540, 960), out=OUT.with_name('mail-howto-tall.gif'), end='themes'),
    # X（Twitter）などに投稿する紹介用。サイトには置かない。
    # タイムラインで切れずに見えるよう 4:5 にし、最初のコマはトップのカード（site/og-image.png）と同じ内容と費用の目安、
    # 最後のコマはサイトのアドレスとQRコードにする
    'x': dict(size=(600, 750), out=OUT.parent.parent.parent / 'docs' / '見本' / '紹介GIF' / 'mail-howto-x.gif', end='url'),
}


SITE = 'https://chinjo-action.vercel.app/'


def qr_image(px):
    """サイトのアドレスのQRコードを px 四方で作る（pip install qrcode）"""
    import qrcode
    q = qrcode.QRCode(border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(SITE)
    q.make(fit=True)
    return q.make_image(fill_color=INK, back_color=PAPER).get_image().convert('RGB').resize((px, px), Image.NEAREST)


def ending(d, w, y, end, size):
    if end == 'url':
        d.text((w // 2, y), 'chinjo-action.vercel.app', font=f(size), fill=BLUE, anchor='mm')
    else:
        tw = d.textlength('▼ 下からテーマを選ぶ', font=f(size))
        d.rounded_rectangle((w // 2 - tw / 2 - 28, y - size, w // 2 + tw / 2 + 28, y + size), size, fill=ACC)
        d.text((w // 2, y), '▼ 下からテーマを選ぶ', font=f(size), fill='#fff', anchor='mm')


def total_text(total, safe):
    return f'約{total}円' 


def frame(i, total, safe, size):
    title, sub, cost, _, kind = STEPS[i]
    w, h = size
    tall = h > w
    im = Image.new('RGB', size, BG)
    d = ImageDraw.Draw(im)
    lines = sub.split('\n')
    if h * 4 == w * 5:
        # X用（4:5）。下の「ここまで」の行に注記を入れる余裕がないので、注記は最後のコマだけに出す
        d.text((w // 2, 36), '陳情書を郵送で出すまで', font=f(22), fill=SUB, anchor='mm')
        x0 = (w - (len(STEPS) * 36 - 14)) // 2
        for k in range(len(STEPS)):
            d.ellipse((x0 + k * 36, 62, x0 + k * 36 + 22, 84), fill=ACC if k <= i else LINE)
        icon(d, kind, w // 2, 225)
        d.text((40, 362), f'{i + 1}', font=f(56), fill=ACC)
        d.text((100, 372), title, font=f(34 if len(title) <= 10 else 30), fill=INK)
        y = 448
        for line in lines:
            d.ellipse((42, y + 7, 52, y + 17), fill=ACC)
            d.text((64, y), line, font=f(19 if len(line) <= 24 else 17, False), fill=INK)
            y += 34
        if cost:
            fnt = f(24)
            tw = d.textlength(cost, font=fnt)
            d.rounded_rectangle((w - 40 - tw - 36, 300, w - 40, 346), 23, fill='#fde7dc')
            d.text((w - 40 - 18, 323), cost, font=fnt, fill=ACC, anchor='rm')
        fy = h - 40
        d.line((40, fy - 30, w - 40, fy - 30), fill=LINE, width=2)
        d.text((40, fy), 'ここまで ' + total_text(total, safe), font=f(24), fill=INK, anchor='lm')
        return im
    if tall:
        d.text((w // 2, 44), '陳情書を郵送で出すまで', font=f(24), fill=SUB, anchor='mm')
        x0 = (w - (len(STEPS) * 36 - 14)) // 2
        for k in range(len(STEPS)):
            d.ellipse((x0 + k * 36, 80, x0 + k * 36 + 22, 102), fill=ACC if k <= i else LINE)
        icon(d, kind, w // 2, 270)
        d.text((40, 430), f'{i + 1}', font=f(60), fill=ACC)
        d.text((100, 440), title, font=f(34 if len(title) <= 10 else 30), fill=INK)
        y = 530
        for line in lines:
            d.ellipse((42, y + 7, 52, y + 17), fill=ACC)
            d.text((64, y), line, font=f(19, False), fill=INK)
            y += 40
        y += 20
        bx = 40
    else:
        d.text((40, 32), '陳情書を郵送で出すまで', font=f(24), fill=SUB)
        for k in range(len(STEPS)):
            x = 600 + k * 36
            d.ellipse((x, 34, x + 22, 56), fill=ACC if k <= i else LINE)
        icon(d, kind, 230, 290)
        d.text((440, 150), f'{i + 1}', font=f(64), fill=ACC)
        d.text((520, 160), title, font=f(38 if len(title) <= 10 else 32), fill=INK)
        # 説明は1行ずつ箇条書きにする（STEPS の改行が項目の区切り）
        for k, line in enumerate(lines):
            y = 240 + k * 38
            d.ellipse((444, y + 8, 454, y + 18), fill=ACC)
            d.text((466, y), line, font=f(22, False), fill=INK)
        y, bx = 378, 440
    if cost:
        fnt = f(26)
        tw = d.textlength(cost, font=fnt)
        d.rounded_rectangle((bx, y, bx + tw + 40, y + 52), 26, fill='#fde7dc')
        d.text((bx + 20, y + 26), cost, font=fnt, fill=ACC, anchor='lm')
    fy = h - 58 if not tall else h - 110
    d.line((40, fy - 30, w - 40, fy - 30), fill=LINE, width=2)
    d.text((40, fy), 'ここまで ' + total_text(total, safe), font=f(24), fill=INK, anchor='lm')
    if tall:
        d.multiline_text((40, fy + 30), NOTE.replace('目安。', '目安\n'), font=f(14, False), fill=SUB, spacing=6)
    else:
        d.text((w - 40, fy + 34), NOTE, font=f(14, False), fill=SUB, anchor='rm')
    return im


def cover(total, size):
    """X用の最初のコマ。トップのカード（site/og-image.png。scripts/og-images.py で作る）をそのまま、幅いっぱいに置く。
    上下はカードの背景と同じ色で埋め、左の帯もつなげる。カードの文言や金額は og-images.py の側で直す"""
    w, h = size
    card = Image.open(OUT.parent.parent / 'og-image.png').convert('RGB')
    ch = round(card.height * w / card.width)
    card = card.resize((w, ch), Image.LANCZOS)
    y0 = (h - ch) // 2
    im = Image.new('RGB', size)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w, y0), fill=card.getpixel((w // 2, 0)))
    d.rectangle((0, y0 + ch, w, h), fill=card.getpixel((w // 2, ch - 1)))
    bar = card.crop((0, ch // 2, 12, ch // 2 + 1))  # 左の帯（縮めたときのにじみごと）を上下に伸ばす
    im.paste(bar.resize((12, y0)), (0, 0))
    im.paste(bar.resize((12, h - y0 - ch)), (0, y0 + ch))
    im.paste(card, (0, y0))
    return im


def summary(total, size, end):
    w, h = size
    tall = h > w
    im = Image.new('RGB', size, BG)
    d = ImageDraw.Draw(im)
    parts = [f'{name} {yen}円' for name, yen in (('印刷', STEPS[2][3]), ('クリアファイル', STEPS[5][3]), ('封筒', STEPS[6][3]), ('切手', STEPS[7][3]))]
    if h * 4 == w * 5:
        d.text((w // 2, 50), '陳情5件を郵送で、合わせて', font=f(28), fill=INK, anchor='mm')
        d.text((w // 2, 125), f'約{round(total, -1)}円', font=f(80), fill=ACC, anchor='mm')
        d.text((w // 2, 192), ' ＋ '.join(parts[:2]), font=f(18, False), fill=INK, anchor='mm')
        d.text((w // 2, 220), ' ＋ '.join(parts[2:]), font=f(18, False), fill=INK, anchor='mm')
        d.text((w // 2, 256), '電子申請で出せる議会なら、印刷も切手も要りません', font=f(17, False), fill=SUB, anchor='mm')
        d.line((40, 285, w - 40, 285), fill=LINE, width=2)
        d.text((w // 2, 318), 'スマホで読み取って、陳情書を作る', font=f(24), fill=INK, anchor='mm')
        qpx = 270
        im.paste(qr_image(qpx), ((w - qpx) // 2, 345))
        ending(d, w, 652, end, 28)
        d.multiline_text((w // 2, 705), NOTE.replace('目安。', '目安\n'), font=f(14, False), fill=SUB, anchor='mm', align='center', spacing=6)
    elif tall and end == 'url':
        # 紹介用：金額をまとめたうえで、下半分にQRコードとアドレスを大きく出す
        d.text((w // 2, 90), '陳情5件を郵送で、合わせて', font=f(30), fill=INK, anchor='mm')
        d.text((w // 2, 185), f'約{round(total, -1)}円', font=f(96), fill=ACC, anchor='mm')
        for k, t in enumerate(parts):
            d.text((w // 2, 270 + k * 32), t, font=f(20, False), fill=INK, anchor='mm')
        d.text((w // 2, 412), '電子申請で出せる議会なら、印刷も切手も要りません', font=f(18, False), fill=SUB, anchor='mm')
        d.line((40, 448, w - 40, 448), fill=LINE, width=2)
        d.text((w // 2, 488), 'スマホで読み取って、陳情書を作る', font=f(24), fill=INK, anchor='mm')
        qpx = 280
        im.paste(qr_image(qpx), ((w - qpx) // 2, 520))
        ending(d, w, 838, end, 28)
        d.multiline_text((w // 2, 905), NOTE.replace('目安。', '目安\n'), font=f(14, False), fill=SUB, anchor='mm', align='center', spacing=6)
    elif tall:
        d.text((w // 2, 170), '陳情5件を郵送で', font=f(34), fill=INK, anchor='mm')
        d.text((w // 2, 220), '合わせて', font=f(34), fill=INK, anchor='mm')
        d.text((w // 2, 330), f'約{round(total, -1)}円', font=f(100), fill=ACC, anchor='mm')
        d.text((w // 2, 430), '厚手の紙・封筒にしても、切手270円で150gまで届きます', font=f(20), fill=ACC, anchor='mm')
        for k, t in enumerate(parts):
            d.text((w // 2, 510 + k * 36), t, font=f(22, False), fill=INK, anchor='mm')
        d.text((w // 2, 690), '電子申請で出せる議会なら', font=f(20, False), fill=SUB, anchor='mm')
        d.text((w // 2, 720), '印刷も切手も要りません', font=f(20, False), fill=SUB, anchor='mm')
        ending(d, w, 810, end, 28)
        d.multiline_text((w // 2, 890), NOTE.replace('目安。', '目安\n'), font=f(14, False), fill=SUB, anchor='mm', align='center', spacing=6)
    else:
        d.text((w // 2, 100), '陳情5件を郵送で、合わせて', font=f(36), fill=INK, anchor='mm')
        d.text((w // 2, 205), f'約{round(total, -1)}円', font=f(110), fill=ACC, anchor='mm')
        d.text((w // 2, 290), '厚手の紙・封筒にしても、切手270円で150gまで届きます', font=f(24), fill=ACC, anchor='mm')
        d.text((w // 2, 345), ' ＋ '.join(parts), font=f(22, False), fill=INK, anchor='mm')
        d.text((w // 2, 390), '電子申請で出せる議会なら、印刷も切手も要りません', font=f(22, False), fill=SUB, anchor='mm')
        ending(d, w, 462, end, 28)
        d.text((w - 40, 515), NOTE, font=f(14, False), fill=SUB, anchor='rm')
    return im


def main():
    for lay in LAYOUTS.values():
        size, out = lay['size'], lay['out']
        frames, durs, total = [], [], 0
        for i, s in enumerate(STEPS):
            total += s[3]
            frames.append(frame(i, total, s[4] in ('stamp', 'post'), size))
            durs.append(3500 + 1200 * s[1].count('\n'))  # 説明の項目が多いコマほど長く見せる
        if lay['end'] == 'url':  # X用は、費用の目安を見せるカードから始める
            frames.insert(0, cover(sum(s[3] for s in STEPS), size))
            durs.insert(0, 5000)
        frames.append(summary(total, size, lay['end']))
        durs.append(7000)
        out.parent.mkdir(parents=True, exist_ok=True)
        pal = [fr.convert('P', palette=Image.ADAPTIVE, colors=64) for fr in frames]
        pal[0].save(out, save_all=True, append_images=pal[1:], duration=durs, loop=0, optimize=True)
        print(out.name, f'{out.stat().st_size // 1024}KB', f'合計 {total}円')


if __name__ == '__main__':
    main()
