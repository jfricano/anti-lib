"""One-off: merge Part 2 of proposed-additions-tv.md into tv_data.txt (run 2026-10-11, jason greenlit all tiers)."""
import re, sys, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(os.path.dirname(here))
prop = open(os.path.join(root, 'proposed-additions-tv.md'), encoding='utf-8').read()
part2 = prop.split('## Part 2')[1].split('## Part 3')[0]

# default shelf per Part 2 subsection letter
DEFAULT = {'A': '2', 'B': '2', 'C': '2', 'D': '17', 'E': '1', 'F': '3', 'G': '5', 'H': '5', 'I': '4',
           'J': '11|Britain and Ireland', 'K': None, 'L': '16', 'M': '14'}
SHELF_NAMES = {
    '1': "1. Start Here: Next Door to the Core", '2': "2. Cringe, Anti-Comedy & Social Experiments",
    '3': "3. The Writers' Room Sitcom", '4': "4. Animation for Grown-Ups", '5': "5. Prestige Drama: The Long Novels",
    '6': "6. Detectives, Doctors & Brilliant Misanthropes", '7': "7. Mind, Time & Reality", '8': "8. God, Death & Meaning",
    '9': "9. Sketch & Surreal", '10': "10. Classic TV: Nick at Nite and Before", '11': "11. British, Irish & Commonwealth Comedy",
    '12': "12. World TV", '13': "13. Limited Series & TV Novels", '14': "14. Documentary & Nonfiction TV",
    '15': "15. TGIF & Saturday Mornings", '16': "16. Kids' TV That Built the Taste", '17': "17. Stand-Up & Talk: Comedy as Philosophy",
}
O = {}  # title -> 'shelf' or 'shelf|section'
def place(shelf, *titles):
    for t in titles: O[t] = shelf
place('1', "It's Garry Shandling's Show", 'Atlanta', 'Northern Exposure')
place('1|Vonnegut on Television', 'Between Time and Timbuktu', 'Who Am I This Time?', "Kurt Vonnegut's Monkey House", 'Harrison Bergeron', 'Displaced Person')
place('9', 'Fridays', "Andy's Funhouse / The Andy Kaufman Special", 'The Characters', 'Stella', 'Documentary Now!', 'Late Night with Conan O\'Brien', 'Look Around You', 'Cunk on Earth', 'Sifl & Olly')
place('17', 'Comedians in Cars Getting Coffee')
place('11|Canada, Australia and New Zealand', 'This Hour Has 22 Minutes', 'The Newsroom', 'The Red Green Show', 'The Games', 'Utopia', 'Rake', 'Degrassi Junior High', 'Orphan Black', 'Fisk', "Aunty Donna's Big Ol' House of Fun", 'Wilfred', 'Taskmaster')
place('3', 'Police Squad!', 'The Grinder', 'Trial & Error', 'Roseanne', 'My So-Called Life', 'Bob', 'Andy Richter Controls the Universe', 'Bakersfield P.D.', 'Silicon Valley', 'Horace and Pete', 'The Other Two', 'High Fidelity', 'Shrinking', 'Bored to Death', 'Mozart in the Jungle', 'The Bernie Mac Show', 'Parker Lewis Can\'t Lose', 'Married... with Children')
place('15', 'Dinosaurs', 'ALF')
place('7', 'Quantum Leap', 'Dispatches from Elsewhere', 'Nowhere Man', 'American Gothic', 'Eerie, Indiana', 'Firefly', 'Sapphire & Steel')
place('8', 'Wonderfalls', 'Midnight Mass', 'Evil', 'Good Omens', 'Miracle Workers', 'Joan of Arcadia')
place('13', 'The Plot Against America', 'House of Cards', 'State of Play', 'Red Riding', 'Blue Remembered Hills', 'Threads', 'GBH')
place('14', 'Couples Therapy')
place('12|France and Belgium', 'En thérapie', 'Kaamelott', 'Au service de la France', "L'Effondrement", 'Bref.', 'Hippocrate', 'Un village français', 'Les Shadoks', 'Baron Noir', 'Hotel Beau Séjour')
place('2', 'Web Therapy')
place('6', 'Nurse Jackie')
place('12|Japan: Anime', 'Welcome to the N.H.K.', 'Steins;Gate', 'Puella Magi Madoka Magica', 'Planetes', 'Mononoke', 'Space Dandy', 'Kids on the Slope', 'Devilman Crybaby', 'Mob Psycho 100', 'Vinland Saga', 'Pop Team Epic', 'Aggretsuko', 'Nichijou', 'Texhnolyze')
place('16', 'Clarissa Explains It All', 'Animaniacs', 'Invader Zim', 'Hey Arnold!')
place('12|Scandinavia', 'Klovn', 'Real Humans', 'Lilyhammer', 'Beforeigners')
place('12|Germany, Austria and Italy', 'Stromberg', 'Boris', 'Inspector Montalbano', 'Esterno Notte', 'M – Son of the Century', 'Kottan ermittelt', 'Kir Royal', 'Generation War', 'Unorthodox', 'Tatort', 'La Piovra', '1992 / 1993 / 1994', 'Braunschlag')
place('12|Eastern Europe and Russia', 'Alternatywy 4', 'Top lista nadrealista', 'The Meeting Place Cannot Be Changed', 'Umbre')
place('12|Latin America and Spain', '30 Coins', 'Crematorio', 'Patria', 'Los Simuladores', 'El Chavo del Ocho', "Nobody's Looking", 'Club de Cuervos', 'El Marginal', 'Narcos', 'Money Heist')
place('12|Israel', 'Our Boys', 'Arab Labor', 'Srugim', 'Autonomies')
place('12|Japan: Live Action', 'Hibana: Spark', 'Giri/Haji', 'Tokyo Vice', 'Sanctuary')
place('12|India', 'Delhi Crime', 'The Family Man', 'Made in Heaven')
place('12|China, Taiwan and Hong Kong', 'Nirvana in Fire', 'The Longest Day in Chang\'an')
place('12|Africa', 'Shaka Zulu', 'Yizo Yizo', 'Iwájú')
place('14|Film on Television', 'The Story of Film: An Odyssey', 'A Personal Journey with Martin Scorsese Through American Movies', 'My Voyage to Italy', 'Siskel & Ebert', 'Hollywood')
place('14|Music on Television', 'Night Music', 'Austin City Limits', 'Later... with Jools Holland', 'The Old Grey Whistle Test', 'Classic Albums', 'Soundbreaking', 'The Beatles Anthology', 'Long Strange Trip', 'Hip-Hop Evolution', 'Behind the Music', 'MTV Unplugged', 'Soul Train', 'The Midnight Special', '1971: The Year That Music Changed Everything', 'Song Exploder', 'Country Music')
SKIP = {'Bluey'}
SEEN = {'Dinosaurs', 'ALF'}
STAR_EXTRA = {'Roseanne', 'Rubicon', 'Dispatches from Elsewhere', 'Police Squad!', 'Look Around You', 'Inspector Montalbano',
              'Night Music', 'Classic Albums', 'Midnight Mass', 'Couples Therapy', 'The Wonder Years', 'The Adventures of Pete & Pete'}
TITLE_FIX = {'A Charlie Brown Christmas': 'The Peanuts Specials'}

creators = {}
for line in open(os.path.join(here, 'creators.txt'), encoding='utf-8'):
    if '=' in line:
        t, c = line.rstrip('\n').split('=', 1); creators[t] = c

FIRST = [("Your physics shelf's", "My physics shelf's"), ('your shelf', 'my shelf'), ("you've probably seen", "I've probably seen"),
         ('you probably saw it', 'I probably saw it'), ('you were the right age', 'I was the right age'), ('you were the age', 'I was the age'),
         ('You saw it.', 'I saw it.'), ('you saw it', 'I saw it'), ("You've likely seen some.", "I've likely seen some."),
         ('your Robert Anton Wilson shelf', 'my Robert Anton Wilson shelf'), ('your generation', 'my generation'),
         ('your deepest thread', 'my deepest thread'), ('your Watts shelf', 'my Watts shelf'), ('on your shelf', 'on my shelf')]

rows = {}  # shelf key -> list of lines
letter = None
pat = re.compile(r'^- (★+) \*\*(.+?)\*\*(?: and the Peanuts specials)? \(([^)]+)\)(?: · ([^.]+?))?\. ?(.*)$')
for line in part2.splitlines():
    m = re.match(r'^### ([A-M])\.', line)
    if m: letter = m.group(1); continue
    m = pat.match(line)
    if not m: continue
    stars, title, run, net, note = m.groups()
    title = TITLE_FIX.get(title, title)
    if title in SKIP: continue
    for a, b in FIRST: note = note.replace(a, b)
    note = re.sub(r'\*Respectful Fringe\*;? ?', '', note).strip()
    run = run.replace('-', '–')
    dest = O.get(title) or DEFAULT[letter]
    if dest is None: sys.exit(f'no shelf for {title}')
    shelf, _, section = dest.partition('|')
    flag = '*' if (len(stars) == 3 or title in STAR_EXTRA) else ''
    if title in SEEN: flag = 'S'
    cr = creators.get(title, '')
    if not cr: print('no creator:', title)
    rows.setdefault((shelf, section), []).append(f"{title}|{run}|{cr}|{net or ''}|{flag}|{note}")

# splice into tv_data.txt
data = open(os.path.join(here, 'tv_data.txt'), encoding='utf-8').read().rstrip('\n').split('\n')
out = []; cur = None; cursec = ''; pending = {}
def flush_shelf(shelf):
    for (s, sec), lst in list(rows.items()):
        if s == shelf:
            if sec and sec != cursec: out.append(f'### {sec}')
            out.extend(lst); del rows[(s, sec)]
def flush_section(shelf, sec):
    if (shelf, sec) in rows: out.extend(rows.pop((shelf, sec)))
i = 0
while i < len(data):
    line = data[i]
    if line.startswith('## '):
        if cur: flush_section(cur, cursec); flush_shelf(cur)
        cur = line[3:].split('.')[0]; cursec = ''
    elif line.startswith('### '):
        flush_section(cur, cursec); cursec = line[4:]
    out.append(line); i += 1
flush_section(cur, cursec); flush_shelf(cur)
for n in ('16', '17'):
    blurb = {'16': "The shows of childhood that carry the same DNA as the core: backstage vaudeville, suburban melancholy, science in a kitchen, a dog reading the classics.",
             '17': "Stand-up and talk that does philosophical work: Carlin, Pilkington, Pryor, Wright, Lee. The Comedy as Philosophy shelf, on screen."}[n]
    out += ['', f'## {SHELF_NAMES[n]}', f'@ {blurb}']
    flush_shelf(n)
assert not rows, rows
open(os.path.join(here, 'tv_data.txt'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('merged')
