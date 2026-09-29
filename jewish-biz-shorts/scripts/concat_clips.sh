#!/usr/bin/env bash
# 複数の名場面を1本につなぐ。使い方: concat_clips.sh <input.mp4> <output.mp4> "<開始> <終了>" "<開始> <終了>" ...
# 例: scripts/concat_clips.sh input/a.mp4 output/tmp_a.mp4 "196.0 242.5" "980 1010"
# できた動画を make_short.sh の入力にする(開始 0、終了=長さ)
set -euo pipefail
IN="${1:?入力}"; OUT="${2:?出力}"; shift 2
F=""; C=""; i=0
for seg in "$@"; do
  set -- $seg; S="$1"; E="$2"
  F+="[0:v]trim=start=$S:end=$E,setpts=PTS-STARTPTS,fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v$i];[0:a]atrim=start=$S:end=$E,asetpts=PTS-STARTPTS,aresample=48000[a$i];"
  C+="[v$i][a$i]"; i=$((i+1))
done
mkdir -p "$(dirname "$OUT")"
ffmpeg -loglevel error -y -i "$IN" -filter_complex "${F}${C}concat=n=$i:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset fast -c:a aac "$OUT"
echo "出力: $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")秒)"
