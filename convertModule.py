import sys
import pathlib
import json

def importGraphe(a):
    d={}
    d['pos']=a[0]
    d['edges']=a[1]
    d['oriented']=False
    d['discover']=False
    d['dist']=True
    d['mode']='map'
    return d

for fn in sys.argv[1:]:
    p=pathlib.Path(fn)
    out=p.with_suffix('.json')
    with open(p, 'r') as f:
        s=f.read()
    d=eval(s)
    with open(out, 'w') as f:
        json.dump(d, f)
