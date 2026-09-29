#!/usr/bin/env bash
# 1本作る(場面つなぎ→縦型化→概要欄txt→ログ追記)
# 使い方: scripts/build.sh <キー(input/<キー>.mp4)> <出力名> <YouTube動画ID> "<開始秒> <終了秒>[|<開始秒> <終了秒>...]" "<本編タイトル>" "<見出し1>" "<見出し2>" ["<見出し3>"] ["#追加タグ"]
set -euo pipefail
cd "$(dirname "$0")/.."
K="$1"; N="$2"; YT="$3"; SEGS="$4"; TITLE="$5"; shift 5
H=(); TAG=""
for a in "$@"; do case "$a" in \#*) TAG="$a";; *) H+=("$a");; esac; done
IFS='|' read -r -a S <<< "$SEGS"
mkdir -p output
scripts/concat_clips.sh "input/$K.mp4" "input/_$N.mp4" "${S[@]}" >/dev/null
D="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "input/_$N.mp4")"
scripts/make_short.sh "input/_$N.mp4" 0 "$D" "output/$N.mp4" "${H[@]}" >/dev/null
rm -f "input/_$N.mp4"
FIRST="$(echo "${S[0]}" | cut -d' ' -f1 | cut -d. -f1)"
HEAD_ONE="$(printf "%s" "${H[@]}")"
cat > "output/$N.txt" <<E
$HEAD_ONE

▶ 本編動画(この続きはこちら)
https://youtu.be/$YT?t=$FIRST

#ユダヤ #ユダヤ人 #ビジネス ${TAG:-#お金} #shorts
E
mmss(){ python3 -c "s=float('$1');print('%02d:%02d'%(s//60,s%60))"; }
RANGE=""; for s in "${S[@]}"; do set -- $s; RANGE+="$(mmss $1)〜$(mmss $2) + "; done
LAB="$(IFS=/; echo "${H[*]}")"
echo "| $(date +%F) | $TITLE | https://youtu.be/$YT | ${RANGE% + } | $LAB | output/$N.mp4 | https://youtu.be/$YT?t=$FIRST |  |" >> log/shorts_log.md
echo "OK output/$N.mp4 ($(python3 -c "print(round($D+3,1))")s)"
