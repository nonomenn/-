# 文字起こし。途中で止まっても中途半端なファイルが残らないよう、完了してから <出力>.tsv にする
# 途中で止まった <出力>.tsv.part があれば、最後の行の終わりから続きを起こす(コンテナ再起動対策)
import sys, os, subprocess, tempfile
from faster_whisper import WhisperModel
src, out = sys.argv[1], sys.argv[2]
part = out + ".part"
off = 0.0
if os.path.exists(part):
    lines = [l for l in open(part, encoding="utf8").read().split("\n") if l.count("\t") == 2]
    open(part, "w", encoding="utf8").write("".join(l + "\n" for l in lines))
    if lines: off = float(lines[-1].split("\t")[1])
audio = src
if off > 0:
    audio = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", f"{off:.2f}", "-i", src, "-ac", "1", "-ar", "16000", audio], check=True)
m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
segs, _ = m.transcribe(audio, language="ja", vad_filter=True, beam_size=1)
with open(part, "a", encoding="utf8") as f:
    for s in segs:
        f.write(f"{s.start+off:.2f}\t{s.end+off:.2f}\t{s.text.strip()}\n"); f.flush()
if audio != src: os.remove(audio)
os.replace(part, out)
