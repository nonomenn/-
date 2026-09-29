#!/usr/bin/env bash
# 使い方: make_short.sh <input.mp4> <開始> <終了> <output.mp4> "<見出し1>" ["<見出し2>" ["<見出し3>"]]
# 開始/終了は 00:03:12 または 192.5(秒)。末尾に終了カードを END_SEC 秒つける
# テロップ等の透過PNGも <output>_assets/ に書き出す(Premiere Pro用素材)
set -euo pipefail
cd "$(dirname "$0")/.."
IN="${1:?入力動画}"; SS="${2:?開始}"; TO="${3:?終了}"; OUT="${4:?出力ファイル}"; shift 4
END_SEC="${END_SEC:-3}"
sec(){ python3 -c "import sys;p=[float(x) for x in sys.argv[1].split(':')];print(sum(v*60**i for i,v in enumerate(reversed(p))))" "$1"; }
DUR="$(python3 -c "print(round($(sec "$TO")-$(sec "$SS"),3))")"
AS="${OUT%.mp4}_assets"
python3 scripts/make_assets.py "$AS" "$@" >/dev/null
CARD="enable='gte(t,$DUR)'"
VF="[0:v]scale=1080:608:force_original_aspect_ratio=decrease,setsar=1,tpad=stop_mode=clone:stop_duration=$END_SEC[v];\
[1:v][v]overlay=(W-w)/2:716:shortest=1[a1];\
[a1][2:v]overlay=0:0[a2];[a2][3:v]overlay=0:0[a3];[a3][4:v]overlay=0:0[a4];\
[a4][5:v]overlay=0:0:$CARD[out]"
mkdir -p "$(dirname "$OUT")"
ffmpeg -loglevel error -y -ss "$SS" -t "$DUR" -i "$IN" \
  -f lavfi -i "color=c=0x0A0A0A:s=1080x1920:r=30" \
  -i "$AS/frame.png" -i "$AS/telop.png" -i "$AS/cta_comment.png" -i "$AS/endcard.png" \
  -filter_complex "$VF;[0:a]apad=pad_dur=$END_SEC[a]" -map "[out]" -map "[a]" \
  -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -t "$(python3 -c "print($DUR+$END_SEC)")" "$OUT"
echo "出力: $OUT / 素材: $AS"
