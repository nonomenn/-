#!/usr/bin/env bash
# キュー(キー ドライブID 本数)の動画を /dev/shm/q10 に順にダウンロード(再起動で消えるので何度でも回せる)
cd "$(dirname "$0")/.."; mkdir -p /dev/shm/q10
while read k id n; do
  f=/dev/shm/q10/$k.mp4
  if [ ! -s "$f" ] || ! ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" >/dev/null 2>&1; then
    curl -sS -L -o "$f.part" "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t" && mv "$f.part" "$f"
  fi
  ln -sfn "$f" input/$k.mp4
  echo "GOT $k $(date +%H:%M)"
done < "${1:-input/q10.txt}"
echo FETCH_DONE
