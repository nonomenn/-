#!/usr/bin/env python3
"""元動画の「切り替わり」の時刻を検出して input/<名前>.cuts に保存する。
  ・画面全体のカット(シーンが変わる時刻)
  ・下部の字幕バーの文字が入れ替わる時刻(文が切り替わる時刻。文字起こしの秒数より正確)
切り抜きの開始・終了を、この時刻に合わせて、前後のシーン・前後の文が映り込むのを防ぐ。
使い方: find_cuts.py input/xxx.mp4"""
import re, subprocess, sys
src=sys.argv[1]
def run(vf):
    p=subprocess.run(["ffmpeg","-nostdin","-i",src,"-vf",vf,"-an","-f","null","-"],capture_output=True,text=True)
    return [float(x) for x in re.findall(r"pts_time:([0-9.]+)",p.stderr)]
whole=run("scale=320:-2,select='gt(scene,0.12)',showinfo")
band=run("crop=iw:ih*0.11:0:ih*0.89,scale=320:-2,select='gt(scene,0.06)',showinfo")
allv=sorted(set(round(t,3) for t in whole+band))
out=[]
for t in allv:
    if not out or t-out[-1]>=0.12: out.append(t)
open(src.rsplit(".",1)[0]+".cuts","w").write("\n".join(f"{t:.3f}" for t in out)+"\n")
print(src,len(whole),"cuts +",len(band),"caption changes ->",len(out))
