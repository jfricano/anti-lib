import csv, re, sys, collections
src, outdir = sys.argv[1], sys.argv[2]
shelves=[]; cur=None; sub=None
for line in open(src):
    line=line.rstrip('\n')
    if not line.strip(): continue
    if line.startswith('# '):
        t,_,d=line[2:].partition(' :: '); t=f'{len(shelves)+1}. {t}'; cur={'title':t,'desc':d,'subs':[]}; shelves.append(cur); sub={'title':None,'items':[]}; cur['subs'].append(sub); continue
    if line.startswith('## '):
        sub={'title':line[3:],'items':[]}; cur['subs'].append(sub); continue
    star=line.startswith('!'); line=line.lstrip('!')
    parts=[x.strip() for x in line.split('|')]+['']*6
    t,y,d,n,nb,tag=parts[:6]
    sub['items'].append(dict(title=t,year=y,dir=d,note=n,nb=nb,tag=tag,star=star,xref='(see ' in t))
seen=collections.Counter(); 
for sh in shelves:
    for s in sh['subs']:
        for i in s['items']:
            if not i['xref']: seen[(i['title'].lower(),i['year'])]+=1
d=[k for k,v in seen.items() if v>1]
print('DUPES',d)
total=sum(seen.values()); print('TOTAL',total)
for sh in shelves:
    print(sh['title'], sum(1 for s in sh['subs'] for i in s['items'] if not i['xref']))
def anchor(t): return re.sub(r'[^a-z0-9 -]','',t.lower()).replace(' ','-')
L=[]
L.append('# The Anti-Library: Movies\n')
L.append(f"*{total} films to explore · October 2026*\n")
L.append("This is the film wing of my anti-library. It starts from the two film books on my shelf, **Roger Ebert's Four-Star Reviews 1967–2007** and **Taschen's Best Movies of the 90s**, and extrapolates from my reading list: Vonnegut first, then the books I want to read, then the ideas behind them (philosophy, consciousness, physics, the absurd).\n")
L.append("**How to use it.** Each shelf opens with ★ picks, the best place to start. Many films are adaptations of books on my reading list, so they pair up: the film as a way into the book, or a second artist's reading of it afterward. A box gets ticked when a film leaves the anti-library. Films that belong on more than one shelf appear once, with a *see also* pointer elsewhere. A spreadsheet version (`movies.csv`) sits next to this file.\n")
L.append("**Shaped by my taste.** Shelf 2, *My Wheelhouse*, is built around Tarantino, Scorsese, Apocalypse Now, The Matrix, buddy-action comedies and the 1994–2003 golden era, with a section just for 1999. Shelf 3 covers the best of each genre, plus music films from my music list. The documentaries shelf has more Herzog and companions to Man on Wire and Mindwalk. TV lives on its own list.\n")
L.append("**Three conventions, shared with the book list.** Every ★ pick has a *shelf neighbor* line: the one book, film or show already in the anti-library that it argues with or completes. A few documentaries carry a `respectful fringe` tag, so consciousness-first and psychedelic films can sit beside the skeptical ones without the list taking a side. Every film digest places the film on the lean-to-maximal axis (Bresson and Ozu at one pole, Fellini and Tarantino at the other) and names its one defining move, as laid out in `movie-digest-format.md`.\n")
L.append("**About the two seed books.** The Ebert and 90s shelves were built from the books' spines, not their contents, so they hold films that live in that territory rather than a transcription of either book.\n")
L.append('## Shelves\n')
for sh in shelves:
    n=sum(1 for s in sh['subs'] for i in s['items'] if not i['xref'])
    L.append(f"- [{sh['title']}](#{anchor(sh['title'])}) · {n} films")
L.append('')
for sh in shelves:
    L.append(f"## {sh['title']}\n"); L.append(f"*{sh['desc']}*\n")
    for s in sh['subs']:
        if not s['items']: continue
        if s['title']: L.append(f"### {s['title']}\n")
        for i in s['items']:
            if i['xref']:
                L.append(f"- *{i['title']} ({i['year']})*"); continue
            star='★ ' if i['star'] else ''
            note=f" — {i['note']}" if i['note'] else ''
            tag=f" `{i['tag']}`" if i['tag'] else ''
            L.append(f"- [ ] {star}**{i['title']}** ({i['year']}) · {i['dir']}{tag}{note}")
            if i['nb']: L.append(f"  - *Shelf neighbor:* {i['nb']}")
        L.append('')
open(f'{outdir}/movies.md','w').write('\n'.join(L))
with open(f'{outdir}/movies.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['shelf','section','title','year','director','start_here','note','watched','shelf_neighbor','tag'])
    for sh in shelves:
        for s in sh['subs']:
            for i in s['items']:
                if not i['xref']: w.writerow([sh['title'],s['title'] or '',i['title'],i['year'],i['dir'],'yes' if i['star'] else '',i['note'],'',i['nb'],i['tag']])
