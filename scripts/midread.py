import struct
def rd(path):
    d=open(path,'rb').read()
    assert d[:4]==b'MThd'
    _,fmt,ntrk,div=struct.unpack('>IHHH',d[4:14])
    p=14; trks=[]
    for _ in range(ntrk):
        assert d[p:p+4]==b'MTrk'
        n=struct.unpack('>I',d[p+4:p+8])[0]
        trks.append(d[p+8:p+8+n]); p+=8+n
    return div,trks
def vlq(b,p):
    v=0
    while True:
        c=b[p]; p+=1; v=(v<<7)|(c&0x7f)
        if not c&0x80: return v,p
def events(chunk):
    p=0;t=0;st=0;out=[]
    while p<len(chunk):
        d,p=vlq(chunk,p); t+=d
        c=chunk[p]
        if c<0x80: s=st
        else: s=c; p+=1; st=s if c<0xf0 else st
        if s==0xff:
            m=chunk[p]; p+=1; n,p=vlq(chunk,p); out.append((t,'meta',m,chunk[p:p+n])); p+=n
        elif s in (0xf0,0xf7):
            n,p=vlq(chunk,p); p+=n
        else:
            hi=s&0xf0
            n=1 if hi in (0xc0,0xd0) else 2
            args=chunk[p:p+n]; p+=n
            out.append((t,hi,args[0],args[1] if n>1 else 0))
    return out
def notes(chunk):
    """[(tick, pitch, vel, durticks)]"""
    ev=events(chunk); on={}; out=[]
    for e in ev:
        if e[1]==0x90 and e[3]>0: on.setdefault(e[2],[]).append((e[0],e[3]))
        elif e[1]==0x80 or (e[1]==0x90 and e[3]==0):
            l=on.get(e[2])
            if l:
                t0,v=l.pop(0); out.append((t0,e[2],v,e[0]-t0))
    out.sort(); return out
