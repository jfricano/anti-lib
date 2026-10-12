# Regenerate music.csv from music.md: python3 -I src/music_csv.py <anti-library dir>
import re,csv,sys,os
D=sys.argv[1]
md=open(os.path.join(D,'music.md')).read()
books=set(m.lower() for m in re.findall(r'\*\*(.+?)\*\*',open(os.path.join(D,'anti-library.md')).read()))
films=set(m.lower() for m in re.findall(r'\*\*(.+?)\*\*',open(os.path.join(D,'movies.md')).read()))
albums=set()
for l in md.splitlines():
    m=re.match(r'- \[[ x]\] (?:★ )?(.+?) — \*(.+?)\*',l)
    if m: albums.add(m.group(2).lower())
rows=[];part=sec=sub=''
for l in md.splitlines():
    if l.startswith('# Part'): part=l[2:]
    elif l.startswith('## '): sec=l[3:];sub=''
    elif l.startswith('### '): sub=l[4:]
    elif l.startswith('**') and l.endswith('**') and sec: sub=l.strip('*')
    elif l.startswith('**') and sec.startswith('7.') and l.split('**')[1].endswith('.'): sub=sub.split(' / ')[0]+' / '+l.split('**')[1].rstrip('.')
    m=re.match(r'- \[([ x])\] (★ )?(.+)',l)
    if not m: continue
    status='heard' if m.group(1)=='x' else ''
    star='yes' if m.group(2) else ''
    body=m.group(3)
    a=re.match(r'\*\*(.+?)\.\*\* (.*)',body)
    if a: artist,album,year,note=a.group(1),'(artist path)','',a.group(2)
    else:
        b=re.match(r'(.+?) — \*(.+?)\*\s*(?:\(([^)]*)\))?\.?\s*(.*)',body)
        if b: artist,album,year,note=b.group(1),b.group(2),b.group(3) or '',b.group(4).strip()
        else:
            c=re.match(r'\*(.+?)\*\s*(?:\(([^)]*)\))?\.?\s*(.*)',body)
            if c: artist,album,year,note='Various (soundtrack)' if re.search('soundtrack|1994–2003',sub) else 'Various',c.group(1),c.group(2) or '',c.group(3).strip()
            else: artist,album,year,note=body,'','',''
    tags=[]
    if sec.startswith('3.'): tags.append('literary')
    if sec.startswith('6.'): tags.append('far shelf')
    if sec.startswith('7.'): tags.append('connection')
    if album=='(artist path)': tags.append('artist path')
    if re.search(r'soundtrack|score|film',album+' '+note+' '+sub,re.I): tags.append('soundtrack')
    if re.search(r'\breads?\b|reading|spoken|recites|narrat',note+' '+album,re.I): tags.append('spoken word')
    neigh=[]
    for t in re.findall(r'\*(.+?)\*',note):
        tl=t.lower()
        if tl in books: neigh.append(t+' (book)')
        elif tl in films: neigh.append(t+' (film)')
        elif tl in albums and tl!=album.lower(): neigh.append(t+' (album)')
    rows.append([part,sec,sub,artist,album,year,star,status,'; '.join(dict.fromkeys(tags)),'; '.join(dict.fromkeys(neigh)),note])
with open(os.path.join(D,'music.csv'),'w',newline='') as f:
    w=csv.writer(f);w.writerow(['part','section','subsection','artist','album','year','start_here','status','tag','neighbor','note']);w.writerows(rows)
print('rows',len(rows),'tagged',sum(1 for r in rows if r[8]),'neighbors',sum(1 for r in rows if r[9]))
