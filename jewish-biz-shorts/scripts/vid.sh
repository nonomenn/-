#!/usr/bin/env bash
# 使い方: scripts/vid.sh <キー> → その元動画のYouTube ID(ログの本編タイトルと完全一致する行から)
cd "$(dirname "$0")/.."; T=$(grep "^$1 " input/titles.txt | head -1 | cut -d' ' -f2-)
awk -F'|' -v t="$T" '{gsub(/^ +| +$/,"",$3); gsub(/^ +| +$/,"",$4); if($3==t && $4 ~ /youtu.be/){sub(/.*youtu.be\//,"",$4); print $4; exit}}' log/shorts_log.md
