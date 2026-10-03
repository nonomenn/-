#!/usr/bin/env python3
"""決まった型から外れていないかを自動でチェックする(1回目のチェック)。
2回目のチェックは、ここで書き出すコマ画像(output/qa/)を自分の目で見て行う。
使い方: python3 scripts/qa_check.py <開始番号> <終了番号>
問題が1つでもあれば終了コード1。"""
import sys, os, re, json, glob, subprocess, urllib.request, urllib.parse, warnings, unicodedata
warnings.filterwarnings("ignore")
from PIL import Image, ImageDraw

a, b = int(sys.argv[1]), int(sys.argv[2])
BANNED = ["強すぎる", "ヤバい", "やばい", "すごい", "凄い"]
errs, warns = [], []
oembed_cache = {}

def probe(f):
    j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", f]))
    v = [s for s in j["streams"] if s["codec_type"] == "video"][0]
    has_a = any(s["codec_type"] == "audio" for s in j["streams"])
    return int(v["width"]), int(v["height"]), v["r_frame_rate"], float(j["format"]["duration"]), has_a

def frame(f, t, crop=None):
    vf = ["-vf", crop] if crop else []
    p = "/tmp/_qa.png"
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", f"{max(t,0):.3f}", "-i", f, "-frames:v", "1", *vf, p])
    return Image.open(p).convert("RGB").copy()

def gold_ratio(im):
    px = im.getdata(); n = 0
    for r, g, b_ in px:
        if r > 170 and 120 < g < 230 and b_ < 140 and r - b_ > 70: n += 1
    return n / len(px)

def white_ratio(im):
    px = im.getdata()
    return sum(1 for r, g, b_ in px if r > 230 and g > 230 and b_ > 230) / len(px)

def oembed_title(url):
    vid = re.search(r"youtu\.be/([\w-]+)", url)
    if not vid: return None
    vid = vid.group(1)
    if vid not in oembed_cache:
        try:
            q = urllib.parse.quote(f"https://youtu.be/{vid}", safe="")
            with urllib.request.urlopen(f"https://www.youtube.com/oembed?url={q}&format=json", timeout=20) as r:
                oembed_cache[vid] = json.load(r)["title"]
        except Exception as e:
            oembed_cache[vid] = f"取得失敗({e})"
    return oembed_cache[vid]

log = open("log/shorts_log.md", encoding="utf8").read().split("\n")
rows = {}
for r in [l for l in log if l.startswith("| 20")]:
    c = [x.strip() for x in r.strip("|").split("|")]
    n = c[5].replace("output/", "").replace(".mp4", "")
    rows[n] = c

os.makedirs("output/qa", exist_ok=True)
num = lambda f: int(re.match(r"\d+", os.path.basename(f)).group())
files = sorted((f for f in glob.glob("output/[0-9]*_*.mp4") if a <= num(f) <= b), key=num)
for f in files:
    n = os.path.basename(f)[:-4]; tag = n.split("_")[0]
    def E(m): errs.append(f"{n}: {m}")
    def W(m): warns.append(f"{n}: {m}")
    # 形式
    w, h, fr, dur, has_a = probe(f)
    if (w, h) != (1080, 1920): E(f"解像度が {w}x{h}(1080x1920のはず)")
    if fr not in ("30/1",): E(f"フレームレートが {fr}(30のはず)")
    if not has_a: E("音声がない")
    if not (40 <= dur <= 53): E(f"長さが {dur:.1f}秒(終了カード込みで40〜53秒のはず)")
    # レイアウト(中盤のコマ)
    mid = frame(f, min(5, dur / 2))
    if gold_ratio(mid.crop((70, 1346, 1010, 1466))) < 0.3: E("CTA帯(本編はコメント欄から)が見当たらない")
    head = mid.crop((0, 250, 1080, 690))
    if white_ratio(head) < 0.01 or gold_ratio(head) < 0.02: E("見出し(白文字+金の帯)が見当たらない")
    if gold_ratio(mid.crop((0, 712, 1080, 720))) < 0.3: E("動画の金縁が見当たらない")
    # 冒頭が真っ黒(暗転・黒背景の演出)だと最初の3秒の引きが死ぬ
    first = frame(f, 0.05).crop((0, 716, 1080, 1324)).convert("L")
    if sum(first.getdata()) / (first.width * first.height) < 20: E("冒頭が真っ黒(暗転)。人が映っている所から始めること")
    # 終了カード(最後の1秒)
    end = frame(f, dur - 1.0)
    area = end.crop((0, 720, 1080, 1320))
    if gold_ratio(area) < 0.01 or white_ratio(area) < 0.005: E("終了カード(続きは/本編は/コメント欄から)が見当たらない")
    # 一瞬だけ映るシーン(本編部分のみ)
    tmp = "/tmp/_qa_body.mp4"
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", f, "-t", f"{dur-3:.3f}", "-vf", "crop=1080:608:0:716", "-an", "-c:v", "libx264", "-preset", "ultrafast", tmp])
    if subprocess.run(["python3", "scripts/check_short.py", tmp], capture_output=True).returncode != 0:
        W("0.5秒未満だけ映るシーンあり → 画像で元動画の演出か確認すること")
    # 冒頭・末尾0.3秒以内のテロップ切り替わり(字幕帯より上の吹き出し等は find_cuts で拾えない)
    for t0, where in ((0, "冒頭"), (dur - 3.3, "末尾")):
        raw = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-ss", f"{t0:.3f}", "-i", f, "-t", "0.3",
                              "-vf", "crop=1080:330:0:994,scale=160:48,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
        fr = [raw[i:i + 160 * 48] for i in range(0, len(raw) - 160 * 48 + 1, 160 * 48)]
        jumps = [sum(abs(x - y) for x, y in zip(fr[i], fr[i - 1])) / len(fr[i]) for i in range(1, len(fr))]
        if jumps and max(jumps) > 12:
            W(f"{where}0.3秒以内でテロップ/画面が切り替わる → 前後の文のテロップが映っていないか画像で確認すること")
    # ログ・概要欄
    c = rows.get(n)
    if not c: E("ログに行がない"); continue
    heads = c[4].split("/")
    if len(heads) > 3: E("見出しが4行以上")
    for bw in BANNED:
        if bw in c[4]: E(f"見出しに中身のない言葉「{bw}」")
    if not os.path.exists(f"output/{n}.txt"): E("概要欄のtxtがない")
    else:
        t = open(f"output/{n}.txt", encoding="utf8").read()
        if "youtu.be/" not in t: W("概要欄の本編URLが未確定(要確認)")
    if c[2].startswith("http"):
        got = oembed_title(c[2])
        norm = lambda x: re.sub(r"[#＃].*$", "", unicodedata.normalize("NFKC", x or "")).strip()
        if norm(got) != norm(c[1]): E(f"本編URLのタイトルがログと違う: YouTube「{got}」/ ログ「{c[1]}」")
    else:
        W("本編URLが未確定")
    # 2回目チェック用のコマ画像(冒頭・末尾・継ぎ目)
    ts = [0.0, 0.15, dur - 3.4, dur - 3.15, dur - 3.04, dur - 1.0]
    ims = [frame(f, t, "crop=1080:608:0:716,scale=270:-1") for t in ts]
    sheet = Image.new("RGB", (270 * len(ims), ims[0].height + 16), (30, 30, 30))
    ImageDraw.Draw(sheet).text((4, 2), f"{n}  " + " ".join(f"{t:.2f}" for t in ts), fill=(255, 255, 0))
    for i, im in enumerate(ims): sheet.paste(im, (i * 270, 16))
    sheet.save(f"output/qa/{tag}.png")

print(f"チェック対象: {len(files)}本({a:02d}〜{b:02d})")
for m in errs: print("NG  ", m)
for m in warns: print("要確認", m)
print("結果:", "OK" if not errs else f"NG {len(errs)}件")
print("2回目のチェック: output/qa/*.png を目で見て、冒頭・末尾に別シーンや文の途中切れがないか確認すること")
sys.exit(1 if errs else 0)
