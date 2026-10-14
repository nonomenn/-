#!/usr/bin/env bash
# ギガファイル便にアップロードしてダウンロードURLを表示する(保存期間 LIFETIME 日、既定30)
# 1回に送れるサイズに上限があるので、CHUNK_MB ごとに分けて送る
# 使い方: scripts/upload_gigafile.sh <ファイル>
set -euo pipefail
F="${1:?ファイル}"; L="${LIFETIME:-30}"; MB="${CHUNK_MB:-50}"; J="$(mktemp)"; D="$(mktemp -d)"
trap 'rm -rf "$J" "$J.html" "$D"' EXIT
curl -sS -c "$J" -b "$J" https://gigafile.nu/ -o "$J.html"
S=$(grep -oE 'var server = "[^"]+"' "$J.html" | cut -d'"' -f2)
ID=$(python3 -c "import uuid;print(uuid.uuid4().hex)")
# 大きいファイルでも容量を食わないよう、1つずつ切り出して送る(送ったら消す)
SZ=$(stat -c %s "$F"); B=$((MB*1024*1024)); N=$(( (SZ + B - 1) / B ))
for ((i=0; i<N; i++)); do
  dd if="$F" of="$D/p" bs=1M skip=$((i*MB)) count=$MB status=none
  for try in 1 2 3 4; do
    R=$(curl -sS -b "$J" -c "$J" -F "id=$ID" -F "name=$(basename "$F")" -F "chunk=$i" -F "chunks=$N" -F "lifetime=$L" \
      -F "file=@$D/p;filename=blob;type=application/octet-stream" "https://$S/upload_chunk.php") && \
      echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(0) if d.get('status')==0 else sys.exit(1)" && break
    [ $try = 4 ] && { echo "失敗: chunk $i $R" >&2; exit 1; }; sleep $((2**try))
  done
  rm -f "$D/p"
done
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['url'],d['delkey'])"
