#!/usr/bin/env bash
# ギガファイル便にアップロードしてダウンロードURLを表示する(保存期間 LIFETIME 日、既定30)
# 使い方: scripts/upload_gigafile.sh <ファイル>
set -euo pipefail
F="${1:?ファイル}"; L="${LIFETIME:-30}"; J="$(mktemp)"
curl -sS -c "$J" -b "$J" https://gigafile.nu/ -o "$J.html"
S=$(grep -oE 'var server = "[^"]+"' "$J.html" | cut -d'"' -f2)
ID=$(python3 -c "import uuid;print(uuid.uuid4().hex)")
curl -sS -b "$J" -c "$J" -F "id=$ID" -F "name=$(basename "$F")" -F "chunk=0" -F "chunks=1" -F "lifetime=$L" \
  -F "file=@$F;filename=blob;type=application/octet-stream" "https://$S/upload_chunk.php" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['url'],d['delkey']) if d.get('status')==0 else sys.exit('失敗: '+str(d))"
rm -f "$J" "$J.html"
