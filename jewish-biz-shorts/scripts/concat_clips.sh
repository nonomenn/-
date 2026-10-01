#!/usr/bin/env bash
# 複数の名場面を1本につなぐ。使い方: concat_clips.sh <input.mp4> <output.mp4> "<開始> <終了>" "<開始> <終了>" ...
# 例: scripts/concat_clips.sh input/a.mp4 output/tmp_a.mp4 "196.0 242.5" "980 1010"
# 開始・終了は input/<名前>.cuts(元動画のカット位置。scripts/find_cuts.py で作る)に自動で合わせる。
# 前後のシーンが一瞬映り込むのを防ぐため。cutsが無いときは自動で検出してから切る
set -euo pipefail
IN="${1:?入力}"; OUT="${2:?出力}"; shift 2
CUTS="${IN%.*}.cuts"
[ -f "$CUTS" ] || { echo "カット位置が未検出なので検出します: $CUTS" >&2; python3 "$(dirname "$0")/find_cuts.py" "$IN" >&2; }
[ -f "$CUTS" ] || { echo "カット位置を検出できませんでした。中止します" >&2; exit 1; }
SNAPPED=()
for seg in "$@"; do
  set -- $seg
  SNAPPED+=("$(python3 - "$CUTS" "$1" "$2" <<'P'
import sys,os
cuts=[float(x) for x in open(sys.argv[1]).read().split()] if os.path.exists(sys.argv[1]) else []
s,e=float(sys.argv[2]),float(sys.argv[3])
W=0.8   # この範囲内のカットに合わせる
R=0.4   # 端からこの範囲内にカットがあると、前後のシーンが映り込むので詰める
near=[c for c in cuts if abs(c-s)<=W]
if near: s=min(near,key=lambda c:abs(c-s))
else:
    inner=[c for c in cuts if s<c<=s+R]
    if inner: s=inner[-1]
near=[c for c in cuts if abs(c-e)<=W]
if near: e=min(near,key=lambda c:abs(c-e))-0.04
else:
    inner=[c for c in cuts if e-R<=c<e]
    if inner: e=inner[0]-0.04
print(f"{s:.3f} {e:.3f}")
P
)")
done
for i in "${!SNAPPED[@]}"; do echo "  区間$((i+1)): ${SNAPPED[$i]}" >&2; done
F=""; C=""; i=0
for seg in "${SNAPPED[@]}"; do
  set -- $seg; S="$1"; E="$2"
  F+="[0:v]trim=start=$S:end=$E,setpts=PTS-STARTPTS,fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v$i];[0:a]atrim=start=$S:end=$E,asetpts=PTS-STARTPTS,aresample=48000[a$i];"
  C+="[v$i][a$i]"; i=$((i+1))
done
mkdir -p "$(dirname "$OUT")"
ffmpeg -nostdin -loglevel error -y -i "$IN" -filter_complex "${F}${C}concat=n=$i:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset fast -c:a aac "$OUT"
echo "出力: $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")秒)"
