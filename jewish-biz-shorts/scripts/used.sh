#!/usr/bin/env bash
# 使い方: scripts/used.sh <キー>  → その元動画で使った区間と見出し
cd "$(dirname "$0")/.."; T=$(grep "^$1 " input/titles.txt | head -1 | cut -d' ' -f2- | cut -c1-15)
grep -F "$T" log/shorts_log.md | cut -d'|' -f3,5,6
