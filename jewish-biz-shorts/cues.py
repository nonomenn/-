import re,sys
f,a,b=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
seen=None
for blk in open(f,encoding='utf8').read().strip().split('\n\n'):
    l=blk.split('\n')
    if len(l)<3:continue
    m=re.match(r'(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)',l[1])
    s=int(m[1])*3600+int(m[2])*60+int(m[3])+int(m[4])/1000
    e=int(m[5])*3600+int(m[6])*60+int(m[7])+int(m[8])/1000
    x=l[-1].strip()
    if e-s<0.1 or x==seen:continue
    seen=x
    if a<=s<=b:print(f"{s:7.2f}-{e:7.2f} {x}")
