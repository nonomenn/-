#!/usr/bin/env bash
# Googleドライブ(リンク共有)の動画を取得→文字起こし→読みやすいテキスト化。
# 使い方: scripts/ingest_drive.sh <キー> <ドライブのファイルID>   → input/<キー>.mp4 / .tsv / .txt
set -euo pipefail
cd "$(dirname "$0")/.."
K="$1"; ID="$2"
[ -f input/$K.mp4 ] || curl -sS -L -o input/$K.mp4 "https://drive.usercontent.google.com/download?id=$ID&export=download&confirm=t"
ffprobe -v error -show_entries format=duration -of csv=p=0 input/$K.mp4 >/dev/null
[ -f input/$K.tsv ] || { ffmpeg -nostdin -loglevel error -y -i input/$K.mp4 -vn -ac 1 -ar 16000 input/$K.wav; python3 scripts/transcribe.py input/$K.wav input/$K.tsv; rm -f input/$K.wav; }
python3 - "$K" <<'P'
import sys
k=sys.argv[1]
rows=[l.rstrip('\n').split('\t') for l in open(f'input/{k}.tsv',encoding='utf8')]
out=[];cur=None;buf=''
for s,e,t in rows:
    s=float(s)
    if cur is None or s-cur>=20:
        if buf: out.append(f"[{int(cur)}]{buf}")
        cur=s;buf=''
    buf+=t
out.append(f"[{int(cur)}]{buf}")
open(f'input/{k}.txt','w',encoding='utf8').write('\n'.join(out))
P
echo "done $K"
