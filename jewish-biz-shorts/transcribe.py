import sys
from faster_whisper import WhisperModel
m=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=4)
segs,_=m.transcribe(sys.argv[1],language="ja",vad_filter=True,beam_size=1)
with open(sys.argv[2],"w",encoding="utf8") as f:
    for s in segs:
        f.write(f"{s.start:.2f}\t{s.end:.2f}\t{s.text.strip()}\n"); f.flush()
