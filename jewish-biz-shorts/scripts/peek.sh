#!/usr/bin/env bash
# 出来上がったショートの指定秒(省略時は冒頭と終了カード直前)のコマを横に並べて1枚の画像にする
# 使い方: scripts/peek.sh <番号> [秒...]  → $PEEK_OUT(既定 /tmp/peek.png)
cd "$(dirname "$0")/.."; f=$(ls output/$1_*.mp4 | head -1); O=${PEEK_OUT:-/tmp/peek.png}; shift
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
T=("0.3" "$@" "$(python3 -c "print(round($d-3.4,2))")"); D=$(mktemp -d); i=0; args=()
for t in "${T[@]}"; do ffmpeg -v error -y -ss $t -i "$f" -frames:v 1 -vf scale=240:-1 $D/$i.png; args+=(-i $D/$i.png); i=$((i+1)); done
ffmpeg -v error -y "${args[@]}" -filter_complex hstack=$i "$O"; rm -rf $D
