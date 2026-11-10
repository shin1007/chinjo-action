# リンクカード（og:image、1200×630）を作る。サイトのトップとテーマのページの見出しに合わせている。
#   python scripts/og-images.py
# Windows の游ゴシック（YuGothB.ttc・YuGothM.ttc）を使う。見出しを変えたら、ここも直して作り直す。
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
FONTS = 'C:/Windows/Fonts'
W, H = 1200, 630
MAIN, MAIN_DARK, INK, MUTED = '#c96a3d', '#9f4f2c', '#20262b', '#65707a'
BG_FROM, BG_TO, SOFT, LINE = (244, 246, 247), (233, 237, 239), '#f7ede8', '#e4c4b5'

CARDS = [
    # (書き出す先, 上の小さな見出し, 大見出し（2行）, 下に並べる札)
    ('og-image.png', '6つのテーマから選べます',
     ['地方議会に、', '意見を正式な手続きで届ける。'],
     ['陳情書', '要望書', '議員への手紙']),
    ('themes/kodomo/og-image.png', '子どもの権利を守る陳情',
     ['子どもが両方の親と関わり続け', 'られる制度を、地方議会に。'],
     ['実子誘拐の解決', '共同親権の原則化']),
    ('themes/dansei/og-image.png', '男女平等を求める陳情',
     ['性別にかかわらず相談先と', '避難先がある制度を、地方議会に。'],
     ['男性も使える相談窓口', 'DV被害者の避難先']),
    ('themes/nihonjin/og-image.png', '日本人の権利を守る陳情',
     ['税と社会保障のルールの', '見直しを、地方議会に。'],
     ['生活保護', '社会保険料の未納', '土地の取得規制']),
    ('themes/shiho/og-image.png', '司法に国民の声を届ける陳情',
     ['司法に国民の声が届く仕組みを、', '地方議会から国に。'],
     ['家庭裁判所の透明化', '国民審査の見直し']),
    ('themes/kenko/og-image.png', '国民の健康を守る陳情',
     ['病気を防ぎ、早く見つける', '施策を、地方議会に。'],
     ['健康のための課税', 'がん検診', '受動喫煙の防止']),
    ('themes/sonota/og-image.png', '税の公平と教育を守る陳情',
     ['税の公平と、公立の学校を', '守る施策を、地方議会に。'],
     ['法人への課税の見直し', '私立高校無償化']),
]


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def draw_card(out, crumb, title, tags):
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):  # サイトのヒーローと同じ、上から下への薄いグラデーション
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_FROM, BG_TO)))
    d.rectangle([0, 0, 16, H], fill=MAIN)

    # 書類のアイコンとサイト名
    x0, y0 = 80, 70
    d.rounded_rectangle([x0, y0, x0 + 64, y0 + 64], radius=14, fill=MAIN)
    d.rectangle([x0 + 18, y0 + 13, x0 + 46, y0 + 51], fill='#fff')
    for i, w in enumerate([20, 20, 13]):
        d.rectangle([x0 + 23, y0 + 22 + i * 9, x0 + 23 + w, y0 + 25 + i * 9], fill=MAIN)
    d.text((x0 + 84, y0 + 4), '陳情アクション', font=font('YuGothB.ttc', 26), fill=MAIN_DARK)
    d.text((x0 + 84, y0 + 36), crumb, font=font('YuGothM.ttc', 22), fill=MUTED)

    # 大見出し（幅に収まるように字の大きさを決める）
    size = 64
    while max(d.textlength(s, font=font('YuGothB.ttc', size)) for s in title) > W - 160:
        size -= 2
    f = font('YuGothB.ttc', size)
    for i, s in enumerate(title):
        d.text((80, 215 + i * round(size * 1.45)), s, font=f, fill=INK)

    # 札
    ft, x = font('YuGothB.ttc', 26), 80
    for s in tags:
        w = d.textlength(s, font=ft) + 44
        d.rounded_rectangle([x, 470, x + w, 524], radius=27, fill=SOFT, outline=LINE, width=2)
        d.text((x + 22, 497), s, font=ft, fill=MAIN_DARK, anchor='lm')
        x += w + 14
    d.text((80, 566), 'chinjo-action.vercel.app', font=font('YuGothM.ttc', 22), fill=MUTED)
    img.save(os.path.join(ROOT, out), optimize=True)


if __name__ == '__main__':
    for card in CARDS:
        draw_card(*card)
        print(card[0])
