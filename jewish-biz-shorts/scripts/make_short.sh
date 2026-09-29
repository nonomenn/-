#!/usr/bin/env bash
# 使い方: make_short.sh <input.mp4> <開始> <終了> <output.mp4> "<見出し1>" ["<見出し2>"]
set -euo pipefail
IN="${1:?入力動画}"; SS="${2:?開始 例 00:03:12}"; TO="${3:?終了}"
OUT="${4:?出力ファイル}"; T1="${5:?見出し1行目}"; T2="${6:-}"

# 日本語太字フォント(環境に合わせて FONT= で上書き)
FONT="${FONT:-/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc}"
[ -f "$FONT" ] || { echo "フォントが見つかりません: $FONT (FONT=... で指定)"; exit 1; }

NAVY="0x0B1F3A"; GOLD="0xD4AF37"
TMP="$(mktemp -d)"; trap "rm -rf $TMP" EXIT
printf "%s" "$T1" > "$TMP/t1.txt"
printf "%s" "$T2" > "$TMP/t2.txt"
printf "%s" "詳しい内容は本編動画へ ▶" > "$TMP/foot.txt"

DT="fontfile=$FONT:x=(w-text_w)/2"
VF="[0:v]scale=1080:608:force_original_aspect_ratio=decrease,setsar=1[v];\
[1:v][v]overlay=(W-w)/2:656:shortest=1,\
drawbox=x=90:y=440:w=900:h=6:color=$GOLD:t=fill,\
drawbox=x=90:y=1474:w=900:h=6:color=$GOLD:t=fill,\
drawtext=$DT:textfile=$TMP/t1.txt:fontsize=84:fontcolor=white:y=140:borderw=3:bordercolor=black,\
drawtext=$DT:textfile=$TMP/t2.txt:fontsize=84:fontcolor=$GOLD:y=260:borderw=3:bordercolor=black,\
drawtext=$DT:textfile=$TMP/foot.txt:fontsize=56:fontcolor=$GOLD:y=1650[out]"

mkdir -p "$(dirname "$OUT")"
ffmpeg -y -ss "$SS" -to "$TO" -i "$IN" \
  -f lavfi -i "color=c=$NAVY:s=1080x1920:r=30" \
  -filter_complex "$VF" -map "[out]" -map "0:a?" \
  -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -shortest "$OUT"
echo "出力: $OUT"
