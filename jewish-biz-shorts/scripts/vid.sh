#!/usr/bin/env bash
# 使い方: scripts/vid.sh <キー> → その元動画のYouTube ID(ログの本編タイトルとNFKC正規化で完全一致する行から)
cd "$(dirname "$0")/.."
python3 - "$1" <<'P'
import sys,re,unicodedata
n=lambda s: re.sub(r'\s','',unicodedata.normalize('NFKC',s))
k=sys.argv[1]
t=next(l.split(' ',1)[1].strip() for l in open('input/titles.txt') if l.startswith(k+' '))
for l in open('log/shorts_log.md'):
    c=[x.strip() for x in l.split('|')]
    if len(c)>4 and n(c[2])==n(t) and 'youtu.be/' in c[3]:
        print(c[3].split('youtu.be/')[1]); break
P
