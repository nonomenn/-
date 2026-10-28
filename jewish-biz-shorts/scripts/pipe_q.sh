#!/usr/bin/env bash
# キュー(キー ドライブID 本数)をダウンロード(/dev/shm/q11)→文字起こし→カット検出まで順に進める。何度回してもよい
cd "$(dirname "$0")/.."; D=/dev/shm/q11; mkdir -p $D
while read k id n; do
  f=$D/$k.mp4
  if [ ! -s "$f" ] || ! ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" >/dev/null 2>&1; then
    curl -sS -L -o "$f.part" "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t" && mv "$f.part" "$f"
  fi
  ln -sfn "$f" input/$k.mp4
  [ -s input/$k.tsv ] || scripts/ingest_drive.sh $k $id
  [ -s input/$k.cuts ] || python3 scripts/find_cuts.py input/$k.mp4
  echo "READY $k $(date +%H:%M)"
done < "${1:-input/q11.txt}"
echo PIPE_DONE
