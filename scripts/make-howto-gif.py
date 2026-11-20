# 郵送で陳情書を出す流れを紹介する GIF を作る（docs/見本/紹介GIF/mail-howto.gif）。
# 画面のスクリーンショットは使わず、手順と金額だけをイラストで見せる（サイトの作りが変わっても使えるように）。
# 金額を変えるときは STEPS の cost と、下の NOTE を直して `python scripts/make-howto-gif.py` を実行する。
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 960, 540
OUT = Path(__file__).resolve().parent.parent / 'docs' / '見本' / '紹介GIF' / 'mail-howto.gif'
FONT_B = 'C:/Windows/Fonts/BIZ-UDGothicB.ttc'
FONT_R = 'C:/Windows/Fonts/BIZ-UDGothicR.ttc'
f = lambda size, bold=True: ImageFont.truetype(FONT_B if bold else FONT_R, size)

BG, INK, SUB, ACC, LINE = '#fbf8f2', '#2b2b2b', '#6b6b6b', '#d9653b', '#e6dfd2'
PAPER, BLUE, GREEN = '#ffffff', '#3b6fb6', '#4a8f5a'

NOTE = '金額は陳情書5件（1件3枚）＋送付状を1通で郵送するときの目安。2026年11月時点'

# 手順：（見出し、補足、金額の表示、合計に足す円、絵）
STEPS = [
    ('サイトで入力する', '求めることと出す先の議会を選び、住所・氏名を入れる', '無料', 0, 'screen'),
    ('PDFを保存する', 'USBメモリーに入れる（スマホからネットプリントでもよい）', '無料', 0, 'usb'),
    ('コンビニで印刷する', 'USBから白黒A4・1枚10円（ネットプリントは20円）\n陳情書15枚・送付状1枚・宛名の用紙1枚', '17枚 170円', 170, 'printer'),
    ('日付を書いて署名する', '日付は空欄なので、出す日を手書きする\n住所・氏名を空けたなら、それも手書きする\n押印は議会によって要らない', '', 0, 'pen'),
    ('宛名と差出人を切る', '切り取り線で切る（ラベル用紙なら はがすだけ）', '', 0, 'scissors'),
    ('クリアファイルに入れる', '全部をまとめて1枚に', '約11円', 11, 'file'),
    ('角2封筒に入れる', 'A4を折らずに入れる', '約10円', 10, 'envelope'),
    ('宛名と切手を貼る', '宛名は表、差出人は裏に のりで貼る\n16枚とクリアファイルで100gぎりぎり\n心配なら270円分を貼る', '切手 180円', 180, 'stamp'),
    ('ポストに出す', '締切の1週間前には届くように', '', 0, 'post'),
]


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


def frame(i, total):
    title, sub, cost, _, kind = STEPS[i]
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 32), '陳情書を郵送で出すまで', font=f(24), fill=SUB)
    # 進み具合
    for k in range(len(STEPS)):
        x = 600 + k * 36
        d.ellipse((x, 34, x + 22, 56), fill=ACC if k <= i else LINE)
    icon(d, kind, 230, 290)
    d.text((440, 150), f'{i + 1}', font=f(64), fill=ACC)
    d.text((520, 160), title, font=f(38 if len(title) <= 10 else 32), fill=INK)
    d.multiline_text((442, 240), sub, font=f(22, False), fill=INK, spacing=12)
    if cost:
        d.rounded_rectangle((440, 360, 440 + 24 * len(cost) + 40, 412), 26, fill='#fde7dc')
        d.text((460, 386), cost, font=f(28), fill=ACC, anchor='lm')
    d.line((40, 468, W - 40, 468), fill=LINE, width=2)
    d.text((40, 498), f'ここまで 約{total}円', font=f(26), fill=INK, anchor='lm')
    d.text((W - 40, 498), NOTE, font=f(14, False), fill=SUB, anchor='rm')
    return im


def summary(total):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((W // 2, 120), '陳情5件を郵送で、合わせて', font=f(36), fill=INK, anchor='mm')
    d.text((W // 2, 230), f'約{round(total, -1)}円', font=f(110), fill=ACC, anchor='mm')
    d.text((W // 2, 330), '印刷 170円 ＋ クリアファイル 11円 ＋ 封筒 10円 ＋ 切手 180円', font=f(22, False), fill=INK, anchor='mm')
    d.text((W // 2, 375), '電子申請で出せる議会なら、印刷も切手も要りません', font=f(22, False), fill=SUB, anchor='mm')
    d.text((W // 2, 470), 'chinjo-action.vercel.app', font=f(30), fill=BLUE, anchor='mm')
    d.text((W - 40, 515), NOTE, font=f(14, False), fill=SUB, anchor='rm')
    return im


def main():
    frames, durs, total = [], [], 0
    for i, s in enumerate(STEPS):
        total += s[3]
        frames.append(frame(i, total))
        durs.append(2600 if s[1].count('\n') else 2200)
    frames.append(summary(total))
    durs.append(4000)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    pal = [fr.convert('P', palette=Image.ADAPTIVE, colors=64) for fr in frames]
    pal[0].save(OUT, save_all=True, append_images=pal[1:], duration=durs, loop=0, optimize=True)
    print(OUT, f'{OUT.stat().st_size // 1024}KB', f'合計 {total}円')


if __name__ == '__main__':
    main()
