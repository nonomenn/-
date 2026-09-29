#!/usr/bin/env bash
# 使い方: make_short.sh <input.mp4> <開始> <終了> <output.mp4> "<見出し1>" ["<見出し2>" ["<見出し3>"]]
# 開始/終了は 00:03:12 または 192.5(秒)。末尾に終了カードを END_SEC 秒つける
# 見出しは最大3行。最終行=金の帯に濃紺文字(キーフレーズ)、それ以外は白
set -euo pipefail
cd "$(dirname "$0")/.."
IN="${1:?入力動画}"; SS="${2:?開始 例 00:03:12}"; TO="${3:?終了}"
OUT="${4:?出力ファイル}"; T1="${5:?見出し1行目}"; T2="${6:-}"; T3="${7:-}"
END_SEC="${END_SEC:-3}"
FONT="${FONT:-fonts/ZenKakuGothicNew-Black.ttf}"
[ -f "$FONT" ] || { echo "フォントが見つかりません: $FONT (FONT=... で指定)"; exit 1; }

sec(){ python3 -c "import sys;p=[float(x) for x in sys.argv[1].split(':')];print(sum(v*60**i for i,v in enumerate(reversed(p))))" "$1"; }
DUR="$(python3 -c "print(round($(sec "$TO")-$(sec "$SS"),3))")"

NAVY="0x0B1F3A"; GOLD="0xE0B84C"
TMP="$(mktemp -d)"; trap "rm -rf $TMP" EXIT

# 見出しを行数に応じて詰める(最終行=金、他=白)
LINES=("$T1"); [ -n "$T2" ] && LINES+=("$T2"); [ -n "$T3" ] && LINES+=("$T3")
N=${#LINES[@]}; FS=118; LH=140; Y0=250
HEAD=""
for i in "${!LINES[@]}"; do
  printf "%s" "${LINES[$i]}" > "$TMP/h$i.txt"
  if [ "$i" -eq $((N-1)) ]; then  # 最終行=キーフレーズ: 金の帯+濃紺文字
    HEAD+="drawtext=fontfile=$FONT:x=(w-text_w)/2:textfile=$TMP/h$i.txt:fontsize=$FS:fontcolor=$NAVY:y=$((Y0+i*LH+6)):box=1:boxcolor=$GOLD:boxborderw=16,"
  else
    HEAD+="drawtext=fontfile=$FONT:x=(w-text_w)/2:textfile=$TMP/h$i.txt:fontsize=$FS:fontcolor=white:y=$((Y0+i*LH)):shadowcolor=black@0.75:shadowx=0:shadowy=7:borderw=2:bordercolor=black@0.55,"
  fi
done

printf "%s" "本編はコメント欄から →" > "$TMP/cta.txt"
printf "%s" "続きは" > "$TMP/e1.txt"
printf "%s" "本編は" > "$TMP/e2.txt"
printf "%s" "コメント欄から →" > "$TMP/e3.txt"

# レイアウト(YouTubeショートのUIを避ける): 上250pxと下420pxは空ける
# 見出し 250〜670 / 動画 1080x608 を y=700〜1308 / CTA帯 y=1338〜1450
CARD="enable='gte(t,$DUR)'"
VF="[0:v]scale=1080:608:force_original_aspect_ratio=decrease,setsar=1,tpad=stop_mode=clone:stop_duration=$END_SEC[v];\
[1:v][v]overlay=(W-w)/2:700:shortest=1,\
${HEAD}\
drawbox=x=60:y=1338:w=960:h=112:color=$GOLD:t=fill,\
drawtext=fontfile=$FONT:x=(w-text_w)/2:textfile=$TMP/cta.txt:fontsize=74:fontcolor=$NAVY:y=1338+(112-text_h)/2-4,\
drawbox=x=0:y=700:w=1080:h=608:color=$NAVY:t=fill:$CARD,\
drawtext=fontfile=$FONT:x=(w-text_w)/2:textfile=$TMP/e1.txt:fontsize=64:fontcolor=white:y=760:$CARD,\
drawtext=fontfile=$FONT:x=(w-text_w)/2:textfile=$TMP/e2.txt:fontsize=112:fontcolor=white:y=870:shadowcolor=black@0.75:shadowy=7:$CARD,\
drawtext=fontfile=$FONT:x=(w-text_w)/2:textfile=$TMP/e3.txt:fontsize=104:fontcolor=$GOLD:y=1020:shadowcolor=black@0.75:shadowy=7:$CARD[out]"

mkdir -p "$(dirname "$OUT")"
ffmpeg -loglevel error -y -ss "$SS" -t "$DUR" -i "$IN" \
  -f lavfi -i "color=c=$NAVY:s=1080x1920:r=30" \
  -filter_complex "$VF;[0:a]apad=pad_dur=$END_SEC[a]" -map "[out]" -map "[a]" \
  -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 192k -t "$(python3 -c "print($DUR+$END_SEC)")" "$OUT"
echo "出力: $OUT"
