#!/usr/bin/env bash
# 5本を一括で作る。先に scripts/download.sh で各本編を input/ に取得しておく
set -euo pipefail
cd "$(dirname "$0")"
mk(){ scripts/make_short.sh "input/$1.mp4" "$2" "$3" "output/$1_$4.mp4" "$5" "$6"; }
mk Ugi9uZc-uBE 00:05:26.68 00:06:15.23 0326 "副業の手順は" "30年後に使えない"
mk Ugi9uZc-uBE 00:08:56.48 00:09:36.63 0536 "人に教えると" "記憶に残りやすい"
mk JOIvZfHKRaM 00:02:12.00 00:02:51.75 0132 "お金は奪われても" "知恵は奪われない"
mk 9bydDdrKsW4 00:03:01.56 00:03:47.59 0181 "人は疑問を持った" "分野しか伸びない"
mk KGUf2s1E-V0 00:10:25.04 00:11:09.39 0625 "10円を気にしない癖" "大金でも続く"
