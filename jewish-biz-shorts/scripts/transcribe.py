# 文字起こし。途中で止まっても中途半端なファイルが残らないよう、完了してから <出力>.tsv にする
import sys, os
from faster_whisper import WhisperModel
m=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=4)
segs,_=m.transcribe(sys.argv[1],language="ja",vad_filter=True,beam_size=1)
part=sys.argv[2]+".part"
with open(part,"w",encoding="utf8") as f:
    for s in segs:
        f.write(f"{s.start:.2f}\t{s.end:.2f}\t{s.text.strip()}\n"); f.flush()
os.replace(part,sys.argv[2])
