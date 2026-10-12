import csv, re, collections, sys
src, out = sys.argv[1], sys.argv[2]
import os
fmt={}
for l in open(os.path.join(os.path.dirname(os.path.abspath(src)),'tv_format.txt'),encoding='utf-8'):
    if l.startswith('#') or not l.strip(): continue
    t,a,m,nb=l.rstrip('\n').split('|'); fmt[t]=(a,m,nb)
ext={}
for l in open(os.path.join(os.path.dirname(os.path.abspath(src)),'tv_extent.txt'),encoding='utf-8'):
    if l.startswith('#') or not l.strip(): continue
    t,h,w=l.rstrip('\n').split('|'); ext[t]=(h,w)
FRINGE={'Closer to Truth','The Power of Myth','The Midnight Gospel'}
shelves=[]; cur=None; sec=''
for line in open(src, encoding='utf-8'):
    line=line.rstrip('\n')
    if not line.strip(): continue
    if line.startswith('## '):
        cur={'name':line[3:],'blurb':'','rows':[]}; shelves.append(cur); sec=''
    elif line.startswith('@ '): cur['blurb']=line[2:]
    elif line.startswith('### '): sec=line[4:]
    else:
        t,run,cr,net,flag,note=line.split('|')
        cur['rows'].append(dict(title=t,run=run,year=run[:4],creator=cr,network=net,flag=flag,note=note,section=sec))
allt={r['title'] for s in shelves for r in s['rows']}; bad=set(fmt)-allt; assert not bad, bad
bade=set(ext)-allt; assert not bade, bade
missing2=[r['title'] for s in shelves for r in s['rows'] if r['flag'] in ('*','S') and r['title'] not in ext]; assert not missing2, missing2
missing=[r['title'] for s in shelves for r in s['rows'] if r['flag'] in ('*','S') and r['title'] not in fmt]; assert not missing, missing
titles=collections.Counter(r['title'] for s in shelves for r in s['rows'])
dups=[t for t,c in titles.items() if c>1]; assert not dups, dups
n=sum(len(s['rows']) for s in shelves); seen=sum(r['flag']=='S' for s in shelves for r in s['rows'])
with open(f'{out}/tv.csv','w',newline='',encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['shelf','section','title','year','run','creator','network','start_here','note','watched','axis','move','neighbor','tags','hours','watch'])
    for s in shelves:
        for r in s['rows']:
            w.writerow([s['name'],r['section'],r['title'],r['year'],r['run'],r['creator'],r['network'],'yes' if r['flag']=='*' else '',r['note'],'yes' if r['flag']=='S' else '',*fmt.get(r['title'],('','','')),'Respectful Fringe' if r['title'] in FRINGE else '',*ext.get(r['title'],('',''))])
def slug(x): return re.sub(r'[^a-z0-9 -]','',x.lower()).replace(' ','-')
L=['# The Anti-Library: TV','',f'*{n-seen} series to explore, plus the {seen} I grew up on, jason\'s list · October 2026*','',
'This is the television wing of my anti-library. It starts from my core (Seinfeld, The Simpsons, Curb, House, Nathan Fielder, the Gilligan shows, The Sopranos, Six Feet Under, Tim Robinson, and the Nick at Nite canon) and works outward along the lines those shows draw: cringe and anti-comedy, the writers\'-room sitcom, prestige drama, brilliant misanthropes, and then the ideas from my reading list (consciousness, time, faith, death, the absurd).','',
'**How to use it.** Shelf 0 is what I\'ve already seen, kept as the compass. Shelf 1 is the short list: the nearest neighbors to that core. After that, each shelf marks its best entry points with ★. Each show appears once. Tick the box when a series leaves the anti-library. A spreadsheet version (`tv.csv`) sits next to this file for sorting and tracking.','',
'**Style axis, move and neighbor.** Every core show and every ★ pick says where it sits between lean (spare, quiet, deadpan) and maximal (dense, layered, overflowing), and names the one move that defines it. Each ★ pick also names its neighbor: the show I\'ve already seen that it argues with or completes, or, where the real neighbor is on another list, a book, film or record (marked Books:, Films:, Albums:). Each ★ pick and core show also says roughly how many hours it costs and how much of it to watch: all of it, certain seasons, one season, or a few episodes. Nonfiction that takes consciousness-first or mythic ideas seriously carries a *Respectful Fringe* tag, so it can sit beside the science without the list taking sides.','',
'**From the film list.** The series that used to sit on the Films list\'s "Long-Form Screen Novels" shelf (Twin Peaks, The Wire, Berlin Alexanderplatz, Severance, Cosmos and the rest) now live here, on the shelves where they fit.','','## Shelves','']
for s in shelves: L.append(f"- [{s['name']}](#{slug(s['name'])}) · {len(s['rows'])} series")
for s in shelves:
    L+=['',f"## {s['name']}",'',f"*{s['blurb']}*",'']; last=''
    for r in s['rows']:
        if r['section']!=last: L+=['' if L[-1] else None, f"### {r['section']}", ''] if True else []; last=r['section']
        box='[x]' if r['flag']=='S' else '[ ]'; star='★ ' if r['flag']=='*' else ''
        line=f"- {box} {star}**{r['title']}** ({r['run']}) · {r['creator']} · {r['network']}"
        if r['note']: line+=f" — {r['note']}"
        if r['title'] in fmt:
            a,m,nb=fmt[r['title']]; extra=f"*{a.capitalize()}: {m}.*"
            if nb: extra+=f" Neighbor: *{nb}*."
            if r['title'] in ext:
                h,w=ext[r['title']]; extra+=f" About {h} hours" + (f", {w}." if w else ".")
            line+=f"<br>{extra}" if False else f" {extra}"
        if r['title'] in FRINGE: line+=" `Respectful Fringe`"
        L.append(line)
L=[x for x in L if x is not None]
open(f'{out}/tv.md','w',encoding='utf-8').write(re.sub(r'\n{3,}','\n\n','\n'.join(L))+'\n')
print(n, seen, sum(r['flag']=='*' for s in shelves for r in s['rows']))
for s in shelves: print(len(s['rows']), s['name'])
