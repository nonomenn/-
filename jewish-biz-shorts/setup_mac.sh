#!/usr/bin/env bash
# Macで1回だけ実行: ./setup_mac.sh   (Homebrewが無ければ https://brew.sh を先に入れる)
set -euo pipefail
brew install ffmpeg yt-dlp python
python3 -m pip install --user pillow faster-whisper
echo "OK。動画取得: scripts/download.sh <URL> / 作成: scripts/make_short.sh ..."
