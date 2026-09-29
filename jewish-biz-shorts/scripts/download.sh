#!/usr/bin/env bash
# 使い方: scripts/download.sh <YouTube URL>
set -euo pipefail
URL="${1:?YouTubeのURLを指定してください}"
cd "$(dirname "$0")/.."
yt-dlp \
  -f "bv*[height<=1080]+ba/b" --merge-output-format mp4 \
  --write-subs --write-auto-subs --sub-langs "ja" --convert-subs srt \
  --write-info-json \
  -o "input/%(id)s.%(ext)s" "$URL"
echo "保存先: input/ (動画 .mp4 / 字幕 .ja.srt / 情報 .info.json)"
