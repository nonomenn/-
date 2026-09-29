import re,sys
t=open(sys.argv[1],encoding='utf8').read().strip().split('\n\n')
out=[];seen=set()
for b in t:
    l=b.split('\n')
    if len(l)<3:continue
    m=re.match(r'(\d+):(\d+):(\d+)',l[1]);s=int(m[1])*3600+int(m[2])*60+int(m[3])
    x=l[-1].strip()
    if not x or x in seen or len(x)<3:continue
    seen.add(x);out.append((s,x))
res=[];cur=None;buf=''
for s,x in out:
    if cur is None or s-cur>=20:
        if buf:res.append(f"[{cur//60}:{cur%60:02d}]{buf}")
        cur=s;buf=''
    buf+=x
res.append(f"[{cur//60}:{cur%60:02d}]{buf}")
print('\n'.join(res))
