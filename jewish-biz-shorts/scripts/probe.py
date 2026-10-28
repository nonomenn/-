# 区間の境目を確認: python3 scripts/probe.py <キー> <秒> [<秒>...]
# 各秒について: 近くのカット位置・前後の音量(50ms刻み)・テロップのコマ画像(scratchpadのprobe.png)
import sys, subprocess, numpy as np
from PIL import Image
k = sys.argv[1]; ts = [float(x) for x in sys.argv[2:]]
src = f'input/{k}.mp4'
cuts = [float(x) for x in open(f'input/{k}.cuts').read().split()]
ims = []
for t in ts:
    near = [round(c, 3) for c in cuts if abs(c - t) < 1.2]
    a = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t - 0.5), "-t", "1.0", "-i", src, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout, np.int16).astype(float)
    r = [int(np.sqrt((a[j:j + 800] ** 2).mean())) for j in range(0, len(a), 800)]
    print(f"{t}: cuts {near}\n   rms(-0.5..+0.5) {r}")
    for dt in (-0.3, 0.3):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(max(0, t + dt)), "-i", src, "-frames:v", "1", "-vf", "scale=480:270", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        ims.append(Image.frombytes('RGB', (480, 270), raw))
W = Image.new('RGB', (960, 270 * len(ts)))
for i, im in enumerate(ims): W.paste(im, ((i % 2) * 480, (i // 2) * 270))
W.save('/tmp/claude-0/-home-user--/86c13346-0993-5d4b-84bf-ba851624c66c/scratchpad/probe.png')
