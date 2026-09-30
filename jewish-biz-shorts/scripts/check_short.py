#!/usr/bin/env python3
"""つないだ動画に「一瞬だけ映るシーン(0.5秒未満)」が無いか確認する。あれば警告して終了コード1。
使い方: check_short.py <つないだ動画.mp4>"""
import re, subprocess, sys
f=sys.argv[1]
dur=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]).decode())
p=subprocess.run(["ffmpeg","-nostdin","-i",f,"-vf","scale=320:-2,select='gt(scene,0.12)',showinfo","-an","-f","null","-"],capture_output=True,text=True)
ts=[0.0]+[float(x) for x in re.findall(r"pts_time:([0-9.]+)",p.stderr)]+[dur]
bad=[(a,b) for a,b in zip(ts,ts[1:]) if b-a<0.5]
for a,b in bad: print(f"警告: {a:.2f}〜{b:.2f}秒に一瞬だけ映るシーン({b-a:.2f}秒)")
print("OK: 一瞬だけ映るシーンなし" if not bad else "要確認")
sys.exit(1 if bad else 0)
