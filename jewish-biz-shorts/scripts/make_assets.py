#!/usr/bin/env python3
"""テロップ等を透過PNG(1080x1920)で書き出す。Premiere Proでもそのまま重ねられる。
使い方: make_assets.py <出力フォルダ> "<見出し1>" ["<見出し2>" ["<見出し3>"]]
出力: telop.png(見出し) / cta_comment.png(本編はコメント欄から) / endcard.png(終了カード) / frame.png(動画の金縁) / bg_black.png(背景)
レイアウト(1080x1920, デザインB 黒×金): 見出し y262〜 / 動画枠 y716〜1324 (1080x608) / CTA y1346〜1466
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1080,1920
FONT=os.path.join(os.path.dirname(__file__),"..","fonts","ZenKakuGothicNew-Black.ttf")
GOLD1=(246,220,140); GOLD2=(196,150,52); BLACK=(10,10,10); WHITE=(255,255,255)
VY,VH=716,608
def font(s): return ImageFont.truetype(FONT,s)
def vgrad(w,h,c1,c2):
    im=Image.new("RGB",(w,h)); d=ImageDraw.Draw(im)
    for y in range(h):
        t=y/max(h-1,1); d.line([(0,y),(w,y)],fill=tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3)))
    return im
def center(d,text,f,cy_top,fill,cx=W//2):
    l,t,r,b=f.getbbox(text); d.text((cx-(r-l)//2-l,cy_top-t),text,font=f,fill=fill)
def pill(base,x,y,w,h,text,f,tcolor=BLACK):
    m=Image.new("L",(w,h),0); ImageDraw.Draw(m).rounded_rectangle([0,0,w-1,h-1],h//2,fill=255)
    sh=Image.new("RGBA",(w,h),(0,0,0,0)); sh.paste((0,0,0,160),mask=m); sh=sh.filter(ImageFilter.GaussianBlur(8)); base.paste(sh,(x,y+8),sh)
    base.paste(vgrad(w,h,GOLD1,GOLD2),(x,y),m)
    d=ImageDraw.Draw(base); l,t,r,b=f.getbbox(text); d.text((x+w//2-(r-l)//2-l,y+h//2-(b-t)//2-t),text,font=f,fill=tcolor)

def telop(lines):
    n=len(lines); size=104
    while size>50:
        f=font(size); ws=[f.getbbox(t)[2]-f.getbbox(t)[0] for t in lines]
        if max(ws[:-1] or [0])<=980 and ws[-1]+56<=1040: break
        size-=2
    f=font(size); lh=int(size*1.35)
    im=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    y0=262
    for i,t in enumerate(lines[:-1]):
        # 影(視認性)
        sh=Image.new("RGBA",(W,H),(0,0,0,0)); ImageDraw.Draw(sh).text((0,0),"",font=f)
        center(d,t,f,y0+i*lh,WHITE)
    t=lines[-1]; l,tt,r,b=f.getbbox(t); w=r-l+56; h=int(size*1.18); x=W//2-w//2; y=y0+(n-1)*lh-6
    m=Image.new("L",(w,h),0); ImageDraw.Draw(m).rounded_rectangle([0,0,w-1,h-1],14,fill=255)
    im.paste(vgrad(w,h,GOLD1,GOLD2),(x,y),m)
    d.text((W//2-(r-l)//2-l,y+h//2-(b-tt)//2-tt),t,font=f,fill=BLACK)
    return im
def cta():
    im=Image.new("RGBA",(W,H),(0,0,0,0)); pill(im,70,1346,940,120,"本編はコメント欄から →",font(72)); return im
def endcard():
    im=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rectangle([0,VY,W,VY+VH-1],fill=BLACK+(255,))
    d.text((0,0),"",font=font(10))
    center(d,"続きは",font(62),VY+74,WHITE)
    center(d,"本編は",font(120),VY+170,WHITE)
    l,t,r,b=font(112).getbbox("コメント欄から →"); g=vgrad(r-l+8,b-t+8,GOLD1,GOLD2)
    mk=Image.new("L",g.size,0); ImageDraw.Draw(mk).text((4-l,4-t),"コメント欄から →",font=font(112),fill=255); im.paste(g,(W//2-g.width//2,VY+340),mk)
    return im
def frame():
    im=Image.new("RGBA",(W,H),(0,0,0,0)); ImageDraw.Draw(im).rectangle([0,VY-2,W-1,VY+VH+1],outline=GOLD2+(255,),width=6); return im

if __name__=="__main__":
    out=sys.argv[1]; lines=[x for x in sys.argv[2:5] if x]
    os.makedirs(out,exist_ok=True)
    telop(lines).save(f"{out}/telop.png"); cta().save(f"{out}/cta_comment.png"); endcard().save(f"{out}/endcard.png"); frame().save(f"{out}/frame.png")
    Image.new("RGB",(W,H),BLACK).save(f"{out}/bg_black.png"); print("assets:",out)
