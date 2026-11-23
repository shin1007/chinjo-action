# X に投稿する紹介動画（MP4・音声つき・字幕つき）を作る。台本は docs/設計/紹介動画の台本案.md。
# 見てほしい人：SNS で不満を書いているが、まだ行動していない人。責めず、議会に出せる道があることを伝える。
# 音声は VOICEVOX:No.7（アナウンス）。VOICEVOX のエンジンを先に起動しておくこと
#   （VOICEVOX を開くか、vv-engine/run.exe を実行。http://localhost:50021 で待ち受ける）。ffmpeg も要る。
# 声の規約は docs/調査/宣伝動画の合成音声の規約.md。「VOICEVOX:No.7」のクレジットを画面の右下に出し、投稿の文にも書くこと。
#   python scripts/make-promo-video.py                出力：docs/見本/紹介動画/mail-howto-no7.mp4 と .srt
#   python scripts/make-promo-video.py --pattern 7|all  30案のうち1つ（all で全部。案の一覧は --list、見比べる画像は --sheet --out 出力先）
#   python scripts/make-promo-video.py --dry          エンジンなしの確認用。声のかわりに無音（長さは文字数から見積もる）。出力は --out へ
#   python scripts/make-promo-video.py --out 出力先     出力先のフォルダを指定する
# 字幕は、画面の下に読み上げと同じ文を焼き込む（X は無音で自動再生されるため）。同じ文と時間を .srt にも書く。
# 数字は書き出す日に数え直す：262 は node scripts/intake-reach.js（/coverage#reach と同じ数え方）、金額は make-howto-gif.py の STEPS。
import importlib.util, json, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('howto', ROOT / 'scripts' / 'make-howto-gif.py')
howto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(howto)

OUT_DIR = ROOT / 'docs' / '見本' / '紹介動画'
ENGINE = 'http://localhost:50021'
SPEAKER, CREDIT, SPEED = 30, 'VOICEVOX:No.7', 1.1  # No.7（アナウンス）。規約 https://voiceseven.com/
BASE = (600, 750)          # 絵のもとの大きさ（make-howto-gif.py の X 用）
W, H = 1080, 1350          # X の縦長 4:5
PIC = 1.5                  # 絵は 900×1125 に広げ、その下の 225px に字幕を置く

# Windows のフォントがなければ、日本語の入ったフォントを探す
if not Path(howto.FONT_B).exists():
    for p in ('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',
              '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'):
        if Path(p).exists():
            howto.FONT_B = howto.FONT_R = p
            break
font = howto.f
BG, INK, SUB, ACC = howto.BG, howto.INK, howto.SUB, howto.ACC


def reach():
    """「陳情が議員に届くと確かめられた議会」の数。/coverage#reach と同じ数え方（scripts/intake-reach.js）"""
    return json.loads(subprocess.run(['node', str(ROOT / 'scripts' / 'intake-reach.js')], capture_output=True, check=True, text=True).stdout)


NOHEAD = '。、」』）！？'   # 行の頭に置かない字


def wrap(d, text, fnt, width):
    """幅に収まるように折り返す。「。」「、」を行頭に出さず、できれば読点・句点のところで折る"""
    rows, cur = [], ''
    for k, ch in enumerate(text):
        if d.textlength(cur + ch, font=fnt) > width and cur and ch not in NOHEAD:
            # 行の後ろ半分に読点・句点があれば、そこで折る
            cut = max((cur.rfind(c) for c in '、。'), default=-1)
            if cut >= len(cur) * 0.55:
                rows.append(cur[:cut + 1])
                cur = cur[cut + 1:] + ch
            else:
                rows.append(cur)
                cur = ch
        else:
            cur += ch
    return rows + ([cur] if cur else [])


PARTICLES = 'をはがにでともへの'


def phrases(text):
    """読点・句点・かぎ括弧と、助詞のあとで区切る（折り返しで言葉の途中を切らないための簡単な規則）"""
    out, cur = [], ''
    for k, ch in enumerate(text):
        cur += ch
        nxt = text[k + 1] if k + 1 < len(text) else ''
        cut = ch in '、。」'
        if not cut and ch in PARTICLES and nxt and nxt not in PARTICLES + '、。」' and k > 0:
            prev = text[k - 1]
            cut = not (ch == 'の' and prev in 'すくぐむぶぬうつるいー') and not (ch == 'も' and (prev == 'か' or nxt == 'う'))
        if cut:
            out.append(cur)
            cur = ''
    return out + ([cur] if cur else [])


def balanced(d, text, fnt, width):
    """文節（phrases）のところで折り返し、行の長さをそろえる。1つの文節が幅を超えるときだけ、字の途中で折る"""
    def greedy(w):
        rows, cur, broke = [], '', False
        for part in phrases(text):
            if d.textlength(cur + part, font=fnt) <= w:
                cur += part
                continue
            if cur:
                rows.append(cur)
            if d.textlength(part, font=fnt) <= w:
                cur = part
            else:
                sub = wrap(d, part, fnt, w)
                rows += sub[:-1]
                cur = sub[-1]
                broke = True
        return rows + ([cur] if cur else []), broke
    rows, _ = greedy(width)
    n = len(rows)
    if n < 2:
        return rows
    w = d.textlength(text, font=fnt) / n
    while w < width:  # 行数を変えずに、狭い幅から試して、行の長さをそろえる（言葉の途中で折れる幅は使わない）
        cand, broke = greedy(w)
        if len(cand) <= n and not broke:
            return cand
        w += 6
    return rows


def card(lines, big=None, big_sub=None, note=None, accent=False):
    """文字だけのコマ（600×750）。big は大きな数字・語、big_sub はその説明、note は小さな補足"""
    im = Image.new('RGB', BASE, BG)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 12, BASE[1]), fill=ACC)
    cx = BASE[0] // 2 + 6
    rows = [r for t in lines for r in balanced(d, t, font(40), 500)]
    gap = 62
    note_rows = balanced(d, note, font(20, False), 480) if note else []
    block = len(rows) * gap + ((120 + 150 + (50 if big_sub else 0)) if big else 0) + (len(note_rows) * 30 + 30 if note else 0)
    y = (BASE[1] - block) // 2 + gap // 2
    for r in rows:
        d.text((cx, y), r, font=font(40), fill=ACC if accent else INK, anchor='mm')
        y += gap
    if big:
        y += 90
        d.text((cx, y), big, font=font(130), fill=ACC, anchor='mm')
        y += 85
        if big_sub:
            d.text((cx, y), big_sub, font=font(26, False), fill=SUB, anchor='mm')
            y += 40
    if note:
        y += 40
        for k, r in enumerate(note_rows):
            d.text((cx, y + k * 30), r, font=font(20, False), fill=SUB, anchor='mm')
    return im


def step_frame(i):
    total = sum(s[3] for s in howto.STEPS[:i + 1])
    return howto.frame(i, total, howto.STEPS[i][4] in ('stamp', 'post'), BASE)


# 台本の可変部分。固定：4（262の議会）・5（署名と費用）・6（手順）・9（検索）。
# 事実の根拠は docs/設計/紹介動画の台本30案.md の表。資料で確かめられない言い方（「議員に読まれる」「市長が確認する」「国を変えられる」）は使わない。
HOOK = {  # 1コマ目：出だし
    'h1': 'その怒り、井戸端で終わらせていませんか。', 'h2': 'SNSで怒っているあなたへ。', 'h3': 'その不満、どこに届いていますか。',
    'h4': '書くだけで、満足していませんか。', 'h5': 'あなたの怒りには、届け先があります。', 'h6': '文句を言う力は、もう持っています。',
    'h7': 'タイムラインの外に、出てみませんか。', 'h8': '怒りを、行動に変えませんか。', 'h9': '投稿の次の一歩、知っていますか。',
    'h10': 'SNSの外で、声を届けませんか。',
}
CONTRAST = {  # 2コマ目：SNSと議会の違い
    'c1': 'SNSへの書き込みは、議会への提出ではありません。', 'c3': '請願や陳情は、文書で議会に出します。',
    'c5': '議会に届ける方法は、ちゃんとあります。', 'c6': 'SNSで言うのも大事。そのうえで、もう一歩。',
    'c7': 'SNSは、気持ちを出す場所。議会は、決める場所です。', 'c8': '議会には、文書で届けられます。',
}
BRIDGE = {  # 3コマ目：陳情へのつなぎ
    'b1': '議会に出せる意見があります。請願と、陳情です。', 'b2': 'その方法が、陳情です。',
    'b3': 'それが、請願と、陳情です。', 'b4': '陳情書を、議会に出すのです。',
}
ARRIVE = {  # 7コマ目：国への道（「届くかもしれない」「こともある」までにとどめる）
    'k1': 'あなたの1通が、議会を通じて、国に届くかもしれません。', 'k2': '議会が採択すれば、意見書として国に出されることもあります。',
    'k3': '届く道は、ちゃんとあります。', 'k6': '小さな1通が、議会が動くきっかけになるかもしれません。',
}
CLOSE = {  # 8コマ目：背中を押す締め
    'e1': '文句を言える人は、もう動けます。出す先を、変えるだけです。', 'e2': '怒りを、議会に届く形に。', 'e3': 'あとは、出すだけです。',
    'e5': '声は、出す先を選べます。', 'e6': '怒れるあなたなら、書けます。', 'e7': '書くなら、議会に出す文書に。', 'e8': '今夜の投稿のかわりに、1通。',
}
# 30案：（名前, 1, 2, 3, 7, 8）。p01 が現行（2026-11-23 に決めた台本）
PATTERNS = [
    ('現行', 'h1', 'c1', 'b1', 'k1', 'e1'),
    # 共感型（責めず、そのままの怒りを認める）
    ('共感1', 'h6', 'c6', 'b1', 'k1', 'e1'), ('共感2', 'h6', 'c7', 'b2', 'k6', 'e6'), ('共感3', 'h2', 'c6', 'b1', 'k3', 'e5'),
    ('共感4', 'h4', 'c6', 'b3', 'k1', 'e6'), ('共感5', 'h10', 'c5', 'b2', 'k6', 'e5'), ('共感6', 'h2', 'c7', 'b1', 'k2', 'e1'),
    # 問いかけ型
    ('問い1', 'h3', 'c1', 'b1', 'k1', 'e2'), ('問い2', 'h3', 'c8', 'b2', 'k2', 'e3'), ('問い3', 'h9', 'c1', 'b3', 'k1', 'e7'),
    ('問い4', 'h4', 'c1', 'b1', 'k3', 'e8'), ('問い5', 'h9', 'c5', 'b4', 'k6', 'e2'), ('問い6', 'h7', 'c1', 'b1', 'k2', 'e3'),
    # 事実型（制度の違いを淡々と）
    ('事実1', 'h2', 'c1', 'b3', 'k2', 'e3'), ('事実2', 'h2', 'c3', 'b1', 'k2', 'e2'), ('事実3', 'h10', 'c3', 'b4', 'k2', 'e7'),
    ('事実4', 'h3', 'c3', 'b3', 'k2', 'e5'), ('事実5', 'h9', 'c8', 'b1', 'k2', 'e3'), ('事実6', 'h5', 'c3', 'b2', 'k2', 'e2'),
    # 強め（対比をはっきり）
    ('強め1', 'h1', 'c7', 'b2', 'k1', 'e1'), ('強め2', 'h1', 'c1', 'b2', 'k3', 'e8'), ('強め3', 'h4', 'c7', 'b1', 'k1', 'e2'),
    ('強め4', 'h8', 'c1', 'b1', 'k3', 'e1'), ('強め5', 'h7', 'c7', 'b3', 'k1', 'e8'), ('強め6', 'h1', 'c5', 'b1', 'k1', 'e6'),
    # 短く（コマの言葉を少なく）
    ('短く1', 'h5', 'c5', 'b2', 'k3', 'e3'), ('短く2', 'h8', 'c5', 'b2', 'k3', 'e2'), ('短く3', 'h6', 'c5', 'b2', 'k3', 'e3'),
    ('短く4', 'h7', 'c5', 'b4', 'k3', 'e8'), ('短く5', 'h10', 'c8', 'b2', 'k3', 'e5'), ('短く6', 'h8', 'c8', 'b4', 'k3', 'e7'),
]
assert len(PATTERNS) == 31 and len({p[1:] for p in PATTERNS}) == 31, '案が重複している'


def scenes(pattern=0):
    """（絵, 読み上げ＝字幕）の並び。1つが1つの文。pattern は PATTERNS の番号（0 が現行）"""
    _, h, c, b, k, e = PATTERNS[pattern]
    r = reach()
    cost = round(sum(s[3] for s in howto.STEPS), -1)
    total = sum(s[3] for s in howto.STEPS)
    return [
        (card([HOOK[h]], accent=True), HOOK[h]),
        (card([CONTRAST[c]]), CONTRAST[c]),
        (card([BRIDGE[b]], accent=True), BRIDGE[b]),
        (card(['陳情は、議員に届きます。'], big=str(r['reach']), big_sub='の議会で確かめられました',
              note=f'公式サイトの案内で確かめた数（全{r["total"]}議会のうち）'), f'確かめられた{r["reach"]}の議会では、陳情は議員に届きます。'),
        (card(['署名を集める必要は', 'ありません。'], big=f'約{cost}円', big_sub='陳情5件を郵送で出す費用',
              note='参考資料を添えるときは、議会の決まりを確かめてください'), f'署名を集める必要はありません。費用は、5件で、およそ{cost}円です。'),
        (step_frame(0), 'サイトで、求めることと、出す先の議会を選びます。'),
        (step_frame(2), 'コンビニで印刷します。'),
        (step_frame(6), '名前を書いて、封筒に入れて、'),
        (step_frame(8), 'ポストに入れて、それだけです。'),
        (card([ARRIVE[k]], accent=True), ARRIVE[k]),
        (card([CLOSE[e]]), CLOSE[e]),
        (howto.summary(total, BASE, 'url'), '「権利を守る陳情アクション」で検索してください。'),
    ]


def synth(text, path, dry):
    if dry:
        sec = 0.16 * len(text) / SPEED + 0.3
        with wave.open(str(path), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(b'\x00\x00' * int(24000 * sec))
        return sec
    q = urllib.parse.urlencode({'text': text, 'speaker': SPEAKER})
    query = json.load(urllib.request.urlopen(urllib.request.Request(f'{ENGINE}/audio_query?{q}', method='POST')))
    query['speedScale'] = SPEED
    query['postPhonemeLength'] = 0.25
    req = urllib.request.Request(f'{ENGINE}/synthesis?speaker={SPEAKER}', data=json.dumps(query).encode(), headers={'Content-Type': 'application/json'})
    path.write_bytes(urllib.request.urlopen(req).read())
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def compose(pic, line):
    """絵（900×1125）の下に、読み上げと同じ文の字幕を焼き込み、右下にクレジットを出す"""
    im = Image.new('RGB', (W, H), BG)
    pic = pic.resize((round(BASE[0] * PIC), round(BASE[1] * PIC)), Image.LANCZOS)
    im.paste(pic, ((W - pic.width) // 2, 0))
    d = ImageDraw.Draw(im)
    top = pic.height
    d.rectangle((0, top, W, H), fill='#2b2b2b')
    fnt = font(44)
    rows = balanced(d, line, fnt, W - 120)
    y = top + 18 + (3 - min(3, len(rows))) * 26
    for r in rows[:3]:
        d.text((W // 2, y + 26), r, font=fnt, fill='#ffffff', anchor='mm')
        y += 54
    d.text((W - 16, H - 10), CREDIT, font=font(22, False), fill='#bdbdbd', anchor='rb')
    return im


def srt_time(t):
    ms = round(t * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


def make(ffmpeg, out_dir, dry, pattern=0):
    items = scenes(pattern)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        parts, cues, t = [], [], 0.0
        for n, (pic, line) in enumerate(items):
            sec = synth(line, tmp / f'{n}.wav', dry)
            hold = sec + (2.0 if n == len(items) - 1 else 0.35)  # 最後は、アドレスを読み取れるよう少し残す
            compose(pic, line).save(tmp / f'{n}.png')
            seg = tmp / f'{n}.mp4'
            subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-loop', '1', '-i', tmp / f'{n}.png', '-i', tmp / f'{n}.wav',
                            '-af', 'apad', '-t', f'{hold:.2f}', '-r', '30', '-c:v', 'libx264', '-tune', 'stillimage',
                            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', seg], check=True)
            parts.append(seg)
            cues.append((t, t + hold - 0.1, line))
            t += hold
        (tmp / 'list.txt').write_text(''.join(f"file '{p.as_posix()}'\n" for p in parts), encoding='utf-8')
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / ('mail-howto-no7.mp4' if pattern == 0 else f'mail-howto-no7-p{pattern:02d}.mp4')
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', tmp / 'list.txt',
                        '-c', 'copy', '-movflags', '+faststart', out], check=True)
        srt = out.with_suffix('.srt')
        srt.write_text(''.join(f'{i + 1}\n{srt_time(a)} --> {srt_time(b)}\n{line}\n\n' for i, (a, b, line) in enumerate(cues)), encoding='utf-8')
    print(out.name, f'{out.stat().st_size // 1024}KB', f'{t:.1f}秒', '（確認用の無音）' if dry else '')


def sheets(out_dir, per=8):
    """全案の、可変の5コマ（出だし・対比・つなぎ・国への道・締め）を並べた確認用の画像。案を選ぶときに見る"""
    out_dir.mkdir(parents=True, exist_ok=True)
    tw = 330
    th = round(H * tw / W)
    lab = 150
    n = len(PATTERNS)
    for g in range(0, n, per):
        rows = list(range(g, min(n, g + per)))
        sheet = Image.new('RGB', (lab + 5 * (tw + 8), len(rows) * (th + 14)), '#e8e4da')
        d = ImageDraw.Draw(sheet)
        for ri, pi in enumerate(rows):
            y = ri * (th + 14) + 7
            d.text((12, y + 10), f'案{pi:02d}', font=font(34), fill=INK)
            d.text((12, y + 56), PATTERNS[pi][0], font=font(24, False), fill=SUB)
            sc = scenes(pi)
            for ci, si in enumerate((0, 1, 2, 9, 10)):
                im = compose(*sc[si]).resize((tw, th), Image.LANCZOS)
                sheet.paste(im, (lab + ci * (tw + 8), y))
        name = out_dir / f'sheet-{rows[0]:02d}-{rows[-1]:02d}.png'
        sheet.save(name)
        print(name.name)


def listing():
    """全案の文を、Markdown の表で出す（docs/設計/紹介動画の台本30案.md に貼る）"""
    print('| 案 | 名前 | 1 出だし | 2 対比 | 3 つなぎ | 7 国への道 | 8 締め |\n|---|---|---|---|---|---|---|')
    for i, (name, h, c, b, k, e) in enumerate(PATTERNS):
        print(f'| {i:02d} | {name} | {HOOK[h]} | {CONTRAST[c]} | {BRIDGE[b]} | {ARRIVE[k]} | {CLOSE[e]} |')


def main():
    args = sys.argv[1:]
    dry = '--dry' in args
    out_dir = Path(args[args.index('--out') + 1]) if '--out' in args else OUT_DIR
    if '--list' in args:
        return listing()
    if '--sheet' in args:
        return sheets(out_dir)
    pats = [0]
    if '--pattern' in args:
        v = args[args.index('--pattern') + 1]
        pats = list(range(len(PATTERNS))) if v == 'all' else [int(v)]
    ffmpeg = shutil.which('ffmpeg') or next((Path.home() / 'AppData/Local/Microsoft/WinGet/Packages').glob('Gyan.FFmpeg*/*/bin/ffmpeg.exe'), None)
    if not ffmpeg:
        sys.exit('ffmpeg が見つからない')
    for pat in pats:
        make(str(ffmpeg), out_dir, dry, pat)


if __name__ == '__main__':
    main()
