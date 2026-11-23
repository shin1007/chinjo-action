# X に投稿する紹介動画（MP4・音声つき・字幕つき）を作る。台本は docs/設計/紹介動画の台本案.md。
# 見てほしい人：SNS で不満を書いているが、まだ行動していない人。責めず、議会に出せる道があることを伝える。
# 音声は VOICEVOX:No.7（アナウンス）。VOICEVOX のエンジンを先に起動しておくこと
#   （VOICEVOX を開くか、vv-engine/run.exe を実行。http://localhost:50021 で待ち受ける）。ffmpeg も要る。
# 声の規約は docs/調査/宣伝動画の合成音声の規約.md。「VOICEVOX:No.7」のクレジットを画面の右下に出し、投稿の文にも書くこと。
#   python scripts/make-promo-video.py                出力：docs/見本/紹介動画/mail-howto-no7.mp4 と .srt
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


def balanced(d, text, fnt, width):
    """読点・句点・かぎ括弧のところで折り返す（字幕・補足用）。1つの区切りが幅を超えるときだけ、字の途中で折る"""
    import re
    parts = [x for x in re.split(r'(?<=[、。」])', text) if x]
    rows, cur = [], ''
    for part in parts:
        if d.textlength(cur + part, font=fnt) <= width:
            cur += part
            continue
        if cur:
            rows.append(cur)
        if d.textlength(part, font=fnt) <= width:
            cur = part
        else:
            sub = wrap(d, part, fnt, width)
            rows += sub[:-1]
            cur = sub[-1]
    return rows + ([cur] if cur else [])


def card(lines, big=None, big_sub=None, note=None, accent=False):
    """文字だけのコマ（600×750）。big は大きな数字・語、big_sub はその説明、note は小さな補足"""
    im = Image.new('RGB', BASE, BG)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 12, BASE[1]), fill=ACC)
    cx = BASE[0] // 2 + 6
    rows = [r for t in lines for r in wrap(d, t, font(40), 500)]
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


def scenes():
    """（絵, 読み上げ＝字幕）の並び。1つが1つの文。台本を直したら docs/設計/紹介動画の台本案.md も直す"""
    r = reach()
    cost = round(sum(s[3] for s in howto.STEPS), -1)
    total = sum(s[3] for s in howto.STEPS)
    return [
        (card(['その怒り、', '井戸端で', '終わらせていませんか。'], accent=True), 'その怒り、井戸端で終わらせていませんか。'),
        (card(['SNSへの書き込みは、', '議会への提出では', 'ありません。']), 'SNSへの書き込みは、議会への提出ではありません。'),
        (card(['議会に出せる意見が', 'あります。', '請願と、陳情です。'], accent=True), '議会に出せる意見があります。請願と、陳情です。'),
        (card(['陳情は、議員に届きます。'], big=str(r['reach']), big_sub='の議会で確かめられました',
              note=f'公式サイトの案内で確かめた数（全{r["total"]}議会のうち）'), f'確かめられた{r["reach"]}の議会では、陳情は議員に届きます。'),
        (card(['署名を集める必要は', 'ありません。'], big=f'約{cost}円', big_sub='陳情5件を郵送で出す費用',
              note='参考資料を添えるときは、議会の決まりを確かめてください'), f'署名を集める必要はありません。費用は、5件で、およそ{cost}円です。'),
        (step_frame(0), 'サイトで、求めることと、出す先の議会を選びます。'),
        (step_frame(2), 'コンビニで印刷します。'),
        (step_frame(6), '名前を書いて、封筒に入れて、'),
        (step_frame(8), 'ポストに入れて、それだけです。'),
        (card(['あなたの1通が、', '議会を通じて、', '国に届くかもしれません。'], accent=True), 'あなたの1通が、議会を通じて、国に届くかもしれません。'),
        (card(['文句を言える人は、', 'もう動けます。', '出す先を、変えるだけです。']), '文句を言える人は、もう動けます。出す先を、変えるだけです。'),
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


def make(ffmpeg, out_dir, dry):
    items = scenes()
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
        out = out_dir / 'mail-howto-no7.mp4'
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', tmp / 'list.txt',
                        '-c', 'copy', '-movflags', '+faststart', out], check=True)
        srt = out.with_suffix('.srt')
        srt.write_text(''.join(f'{i + 1}\n{srt_time(a)} --> {srt_time(b)}\n{line}\n\n' for i, (a, b, line) in enumerate(cues)), encoding='utf-8')
    print(out.name, f'{out.stat().st_size // 1024}KB', f'{t:.1f}秒', '（確認用の無音）' if dry else '')


def main():
    args = sys.argv[1:]
    dry = '--dry' in args
    out_dir = Path(args[args.index('--out') + 1]) if '--out' in args else OUT_DIR
    ffmpeg = shutil.which('ffmpeg') or next((Path.home() / 'AppData/Local/Microsoft/WinGet/Packages').glob('Gyan.FFmpeg*/*/bin/ffmpeg.exe'), None)
    if not ffmpeg:
        sys.exit('ffmpeg が見つからない')
    make(str(ffmpeg), out_dir, dry)


if __name__ == '__main__':
    main()
