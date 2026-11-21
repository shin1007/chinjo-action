# X に投稿する紹介動画（MP4・音声つき）を作る。絵は scripts/make-howto-gif.py の X用のコマをそのまま使う。
# 音声は VOICEVOX（https://voicevox.hiroshiba.jp/）のエンジンで作る。先にエンジンを起動しておくこと
#   （VOICEVOX を開くか、vv-engine/run.exe を実行。http://localhost:50021 で待ち受ける）。
# ffmpeg も要る（winget install Gyan.FFmpeg.Essentials）。
# 使う声は、規約に政治などの制限がないことを確かめたもの（docs/調査/宣伝動画の合成音声の規約.md）。
# どの声も「VOICEVOX:声の名前」のクレジットが要るので、画面の下に出し、投稿の文にも書く。
#   python scripts/make-promo-video.py            … 3つの声すべて
#   python scripts/make-promo-video.py goki       … 1つだけ
import importlib.util, json, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request, wave
from pathlib import Path
from PIL import ImageDraw

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('howto', ROOT / 'scripts' / 'make-howto-gif.py')
howto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(howto)

OUT_DIR = ROOT / 'docs' / '見本' / '紹介動画'
ENGINE = 'http://localhost:50021'
SCALE = 1.8  # 600×750 のコマを 1080×1350（X の縦長 4:5）に広げる

# 声：（ファイル名、話者のID、クレジット、話す速さ）。IDは http://localhost:50021/speakers で確かめられる
VOICES = {
    'goki': (27, 'VOICEVOX:後鬼', 1.15),              # 後鬼（人間ver.）規約 https://ついなちゃん.com/voicevox_terms/
    'no7': (30, 'VOICEVOX:No.7', 1.15),               # No.7（アナウンス）規約 https://voiceseven.com/
    'yurei': (102, 'VOICEVOX:ユーレイちゃん(CV:神崎零)', 1.15),  # 非商用のみ。規約 https://u-stella.co.jp/voicevox-ure-chan-tucumo-terms-of-use/
}

# コマごとの読み上げ。コマの文字をそのまま読まず、耳で聞いてわかる短い言い方にする。
# 金額は make-howto-gif.py の STEPS と合わせる（変えたらここも直す）
LINES = [
    '陳情書は、郵送でも出せます。5件で、およそ480円です。',
    'まず、サイトで、求めることと、出す先の議会を選びます。',
    'できたPDFを、USBメモリーかネットプリントで持ち出します。',
    'コンビニで印刷します。19枚で190円です。',
    '日付を手書きして、署名します。',
    '宛名と差出人を、切り取ります。',
    'クリアファイルにまとめて入れます。',
    '角2の封筒に、折らずに入れます。',
    '宛名をはって、270円の切手をはります。',
    '締め切りの1週間前には届くように、ポストへ。',
    '電子申請できる議会なら、印刷も切手も要りません。「権利を守る陳情アクション」で検索してください。',
]


def synth(text, speaker, speed, path):
    q = urllib.parse.urlencode({'text': text, 'speaker': speaker})
    query = json.load(urllib.request.urlopen(urllib.request.Request(f'{ENGINE}/audio_query?{q}', method='POST')))
    query['speedScale'] = speed
    query['postPhonemeLength'] = 0.25
    req = urllib.request.Request(f'{ENGINE}/synthesis?speaker={speaker}', data=json.dumps(query).encode(),
                                 headers={'Content-Type': 'application/json'})
    path.write_bytes(urllib.request.urlopen(req).read())
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def frames():
    size = howto.LAYOUTS['x']['size']
    out, total = [howto.cover(sum(s[3] for s in howto.STEPS), size)], 0
    for i, s in enumerate(howto.STEPS):
        total += s[3]
        out.append(howto.frame(i, total, s[4] in ('stamp', 'post'), size))
    out.append(howto.summary(total, size, 'url'))
    return out


def make(key, ffmpeg):
    speaker, credit, speed = VOICES[key]
    imgs = frames()
    assert len(imgs) == len(LINES), 'コマと読み上げの数が合わない'
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        parts = []
        for n, (im, line) in enumerate(zip(imgs, LINES)):
            sec = synth(line, speaker, speed, tmp / f'{n}.wav')
            hold = sec + (1.5 if n == len(LINES) - 1 else 0.35)  # 最後はアドレスを読み取れるよう少し残す
            im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), howto.Image.LANCZOS)
            d = ImageDraw.Draw(im)
            d.text((im.width - 16, im.height - 12), credit, font=howto.f(22, False), fill=howto.SUB, anchor='rb')
            im.save(tmp / f'{n}.png')
            seg = tmp / f'{n}.mp4'
            subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-loop', '1', '-i', tmp / f'{n}.png', '-i', tmp / f'{n}.wav',
                            '-af', 'apad', '-t', f'{hold:.2f}', '-r', '30', '-c:v', 'libx264', '-tune', 'stillimage',
                            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-b:a', '160k', seg], check=True)
            parts.append(seg)
        (tmp / 'list.txt').write_text(''.join(f"file '{p.as_posix()}'\n" for p in parts), encoding='utf-8')
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out = OUT_DIR / f'mail-howto-{key}.mp4'
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', tmp / 'list.txt',
                        '-c', 'copy', '-movflags', '+faststart', out], check=True)
    print(out.name, f'{out.stat().st_size // 1024}KB')


def main():
    ffmpeg = shutil.which('ffmpeg') or next((Path.home() / 'AppData/Local/Microsoft/WinGet/Packages').glob('Gyan.FFmpeg*/*/bin/ffmpeg.exe'), None)
    if not ffmpeg:
        sys.exit('ffmpeg が見つからない')
    for key in sys.argv[1:] or VOICES:
        make(key, str(ffmpeg))


if __name__ == '__main__':
    main()
