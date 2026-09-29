# デザイン案のモック作成(候補の見た目確認用): python3 scripts/design_mock.py <frame.png> <out_dir>
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1080,1920
FR=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
GOTHIC="fonts/ZenKakuGothicNew-Black.ttf"; MINCHO="fonts/ShipporiMinchoB1-ExtraBold.ttf"
LINES=["リーダーの仕事は","引っ張ることだと","思っていませんか？"]
CTA="本編はコメント欄から"

def font(p,s): return ImageFont.truetype(p,s)
def vgrad(w,h,c1,c2):
    im=Image.new("RGB",(w,h)); d=ImageDraw.Draw(im)
    for y in range(h):
        t=y/(h-1); d.line([(0,y),(w,y)],fill=tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3)))
    return im
def gold_text_mask(text,f,pad=0):
    l,t,r,b=f.getbbox(text); w=r-l+pad*2; h=b-t+pad*2
    m=Image.new("L",(w,h),0); ImageDraw.Draw(m).text((pad-l,pad-t),text,font=f,fill=255); return m
def paste_grad_text(base,text,f,cx,y,c1,c2,shadow=True):
    m=gold_text_mask(text,f,4); g=vgrad(m.width,m.height,c1,c2)
    x=cx-m.width//2
    if shadow:
        sh=Image.new("RGBA",m.size,(0,0,0,0)); sh.paste((0,0,0,170),mask=m); sh=sh.filter(ImageFilter.GaussianBlur(6))
        base.paste(sh,(x,y+8),sh)
    base.paste(g,(x,y),m); return m.size
def text_center(d,text,f,cx,y,fill,stroke=0,sfill=None):
    l,t,r,b=f.getbbox(text); d.text((cx-(r-l)//2-l,y-t),text,font=f,fill=fill,stroke_width=stroke,stroke_fill=sfill)
def frame_img(radius=22):
    im=Image.open(FR).convert("RGB").resize((1080,608))
    return im
def rounded(im,r):
    m=Image.new("L",im.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,im.width-1,im.height-1],r,fill=255); im=im.convert("RGBA"); im.putalpha(m); return im
GOLD1=(246,220,140); GOLD2=(196,150,52)

def design_A():  # ROYAL NOIR: 明朝×金の細線×アウトラインCTA
    bg=vgrad(W,H,(6,10,20),(16,30,52)).convert("RGBA"); d=ImageDraw.Draw(bg)
    f=font(MINCHO,96)
    for i,t in enumerate(LINES[:2]): 
        text_center(d,t,f,W//2,272+i*146,(255,255,255),2,(0,0,0))
    paste_grad_text(bg,LINES[2],f,W//2,272+2*146,GOLD1,GOLD2)
    d.line([(150,232),(930,232)],fill=GOLD2,width=3); d.line([(150,688),(930,688)],fill=GOLD2,width=3)
    v=frame_img(); bg.paste(v,(0,716))
    d.rectangle([0,716,W,716+608],outline=GOLD2,width=4)
    fc=font(GOTHIC,66); d.rounded_rectangle([90,1352,990,1462],56,outline=GOLD1,width=5,fill=(8,14,26,230))
    text_center(d,CTA+"  →",fc,W//2,1352+22,GOLD1); return bg
def design_B():  # BLACK×GOLD BLOCK: 黒地×大きな白ゴシック×金ブロック
    bg=Image.new("RGBA",(W,H),(10,10,10,255)); d=ImageDraw.Draw(bg)
    f=font(GOTHIC,104)
    for i,t in enumerate(LINES[:2]): text_center(d,t,f,W//2,262+i*140,(255,255,255))
    l,t,r,b=f.getbbox(LINES[2]); w=r-l+56; h=122; x=W//2-w//2; y=262+2*140-6
    g=vgrad(w,h,GOLD1,GOLD2); m=Image.new("L",(w,h),0); ImageDraw.Draw(m).rounded_rectangle([0,0,w-1,h-1],14,fill=255); bg.paste(g,(x,y),m)
    text_center(d,LINES[2],f,W//2,y+6,(10,10,10))
    v=rounded(frame_img(),0); bg.paste(v,(0,716))
    d.rectangle([0,716,W,716+608],outline=GOLD2,width=6)
    fc=font(GOTHIC,72); g=vgrad(940,120,GOLD1,GOLD2); m=Image.new("L",(940,120),0); ImageDraw.Draw(m).rounded_rectangle([0,0,939,119],60,fill=255)
    sh=Image.new("RGBA",(940,120),(0,0,0,0)); sh.paste((0,0,0,160),mask=m); sh=sh.filter(ImageFilter.GaussianBlur(8)); bg.paste(sh,(70,1354),sh)
    bg.paste(g,(70,1346),m); text_center(d,CTA+" →",fc,W//2,1346+24,(10,10,10)); return bg
def design_C():  # DEEP NAVY×IVORY: 濃紺×白×金のキーワード+テーマタグ
    bg=vgrad(W,H,(9,26,52),(4,12,28)).convert("RGBA"); d=ImageDraw.Draw(bg)
    tag="ユダヤ流 チームづくり"; ft=font(GOTHIC,44); l,t,r,b=ft.getbbox(tag); tw=r-l+60
    d.rounded_rectangle([W//2-tw//2,240,W//2+tw//2,240+72],36,outline=GOLD1,width=4); text_center(d,tag,ft,W//2,240+12,GOLD1)
    f=font(GOTHIC,98)
    text_center(d,LINES[0],f,W//2,340,(250,247,238),0)
    text_center(d,LINES[1],f,W//2,340+124,(250,247,238),0)
    paste_grad_text(bg,LINES[2],f,W//2,340+2*124,GOLD1,GOLD2)
    
    v=rounded(frame_img(),26); mk=Image.new("RGBA",(W,H),(0,0,0,0)); 
    sh=Image.new("RGBA",(1000,600),(0,0,0,0)); sh.paste((0,0,0,200),mask=Image.new("L",(1000,600),255)); sh=sh.filter(ImageFilter.GaussianBlur(16))
    v2=frame_img().resize((1000,562)); vr=rounded(v2,26); bg.paste(sh,(40,782),sh); bg.paste(vr,(40,774),vr)
    ImageDraw.Draw(bg).rounded_rectangle([40,774,1040,1336],26,outline=(255,255,255,60),width=2)
    fc=font(GOTHIC,66); d.rounded_rectangle([120,1372,960,1484],56,fill=(250,247,238))
    text_center(d,CTA,fc,W//2-40,1372+20,(9,26,52)); d.ellipse([960-104,1372+16,960-24,1372+96],fill=GOLD2); d.polygon([(960-84,1372+56-4),(960-50,1372+56-4),(960-50,1372+42),(960-30,1372+56),(960-50,1372+70),(960-50,1372+56+8),(960-84,1372+56+8)],fill=(9,26,52)); return bg

for n,fn in (("A_ロイヤルノワール",design_A),("B_ブラック金ブロック",design_B),("C_ネイビーアイボリー",design_C)):
    fn().convert("RGB").save(f"{OUT}/design_{n}.png")
print("ok")
