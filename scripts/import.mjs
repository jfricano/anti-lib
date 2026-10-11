// Normalizes the source lists in lists/ into data/, which the portfolio page reads.
// Usage: node scripts/import.mjs [source-folder]   (defaults to lists/)
// A new list is one more entry in LISTS; sources that are missing are skipped.
// Links and covers already found by lookup.mjs are kept.
// Flags marked private only show in owner mode; privateFilter flags show as tags for everyone
// but can only be filtered on in owner mode.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath as toPath } from 'node:url';
import { readLookups, applyLookups } from './lookup.mjs';
const root = toPath(new URL('../', import.meta.url));

const LISTS = [
  {
    id: 'books', label: 'Books', noun: ['book', 'books'], source: 'anti-library.json',
    fields: { title: 'title', creator: 'author', group: 'part', shelf: 'section', note: 'hook', done: 'status' },
    doneValues: ['Read', 'Digested', 'Formative'],
    creatorLabel: 'Author', groupLabel: 'Part', shelfLabel: 'Section', doneLabel: 'Read',
    search: 'https://openlibrary.org/search?q=',
    flags: { core: { field: 'core', label: 'Core shelf' }, fringe: { field: 'fringe', label: 'Respectful fringe' }, owned: { field: 'owned', label: 'On my shelf' }, star: { field: 'star', label: 'Vonnegut frequency' },
      formative: { field: 'status', equals: 'Formative', label: 'Formative', privateFilter: true },
      reading: { field: 'status', equals: 'Reading', label: 'Reading now', privateFilter: true } },
  },
  {
    id: 'films', label: 'Films', noun: ['film', 'films'], source: 'movies.csv',
    fields: { title: 'title', creator: 'director', year: 'year', shelf: 'shelf', sub: 'section', note: 'note', done: 'watched' },
    creatorLabel: 'Director', shelfLabel: 'Shelf', doneLabel: 'Watched',
    search: 'https://www.imdb.com/find/?s=tt&q=',
    flags: { start: { field: 'start_here', label: 'Start here', private: true }, fringe: { field: 'tag', equals: 'respectful fringe', label: 'Respectful fringe' } },
  },
  {
    id: 'tv', label: 'TV', noun: ['show', 'shows'], source: 'tv.csv',
    fields: { title: 'title', creator: 'creator', year: 'year', shelf: 'shelf', sub: 'section', note: 'note', done: 'watched' },
    creatorLabel: 'Creator', shelfLabel: 'Shelf', doneLabel: 'Watched',
    search: 'https://en.wikipedia.org/w/index.php?search=', searchSuffix: 'TV series',
    flags: { start: { field: 'start_here', label: 'Start here', private: true }, fringe: { field: 'tags', equals: 'Respectful Fringe', label: 'Respectful fringe' } },
    // The run and network lead the note, since there is no column of their own on the page.
    transform: r => ({ ...r, note: [[r.run, r.network].filter(Boolean).join(', '), r.note].filter(Boolean).join('. ') }),
  },
  {
    id: 'albums', label: 'Albums', noun: ['album', 'albums'], source: 'music.csv',
    fields: { title: 'album', creator: 'artist', year: 'year', group: 'part', shelf: 'section', sub: 'subsection', note: 'note', done: 'status' },
    creatorLabel: 'Artist', groupLabel: 'Part', shelfLabel: 'Shelf', doneLabel: 'Heard', cover: 'square',
    search: 'https://www.discogs.com/search/?type=all&q=', listen: 'https://open.spotify.com/search/',
    flags: { start: { field: 'start_here', label: 'Start here', private: true }, path: { field: 'artist_path', label: 'Artist path' } },
    // Artist paths name an artist rather than an album; a few rows carry a whole entry in the artist column.
    transform(r) {
      if (r.album === '(artist path)') return { ...r, album: r.artist, artist: '', artist_path: 'yes' };
      if (!r.album && r.artist) {
        let artist = '', text = r.artist;
        const dash = text.split(' — ');
        if (dash.length > 1) [artist, text] = [dash[0], dash.slice(1).join(' — ')];
        const m = /^(.+?)\s*(soundtrack)?\s*\(([^)]*?(\d{4})[^)]*)\)\.?\s*(.*)$/.exec(text);
        if (m) return { ...r, album: m[1], artist, year: m[4], note: [m[2] && 'Soundtrack.', m[5]].filter(Boolean).join(' ') };
        const [title, ...rest] = text.split('. ');
        return { ...r, album: title, artist, note: rest.join('. ') };
      }
      return r;
    },
  },
];

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(Boolean));
  return body.map(r => Object.fromEntries(head.map((key, i) => [key.trim(), (r[i] ?? '').trim()])));
}

const truthy = value => value === true || /^(yes|y|x|true|1|✓|★|heard|read|watched|seen|done)$/i.test(String(value ?? '').trim());
const clean = value => String(value ?? '').replace(/\*/g, '').trim();

const sourceDir = process.argv[2] || path.join(root, 'lists');
const out = path.join(root, 'data');
await mkdir(out, { recursive: true });
const manifest = [];
const lookups = await readLookups();
for (const list of LISTS) {
  const file = path.join(sourceDir, list.source);
  try { await access(file); } catch { console.log(`Skipped ${list.id}: no ${list.source}`); continue; }
  const text = await readFile(file, 'utf8');
  const records = (list.source.endsWith('.json') ? JSON.parse(text) : parseCsv(text)).map(r => list.transform ? list.transform(r) : r);
  const { fields } = list;
  const items = records.filter(r => clean(r[fields.title])).map(r => {
    const item = { t: clean(r[fields.title]) };
    for (const [key, field] of [['c', fields.creator], ['y', fields.year], ['g', fields.group], ['s', fields.shelf], ['u', fields.sub], ['n', fields.note]]) {
      const value = field && clean(r[field]);
      if (value) item[key] = key === 'y' && /^\d+$/.test(value) ? Number(value) : value;
    }
    const flags = Object.entries(list.flags).filter(([, flag]) => flag.equals ? r[flag.field] === flag.equals : truthy(r[flag.field])).map(([key]) => key);
    if (flags.length) item.f = flags;
    if (fields.done && (list.doneValues ? list.doneValues.includes(r[fields.done]) : truthy(r[fields.done]))) item.d = 1;
    return item;
  });
  await writeFile(path.join(out, `${list.id}.json`), JSON.stringify(applyLookups(list.id, items, lookups)));
  const { source, fields: _, transform, doneValues, ...meta } = list;
  manifest.push({ ...meta, flags: Object.fromEntries(Object.entries(list.flags).map(([key, flag]) => [key, flag.label])),
    privateFlags: Object.keys(list.flags).filter(key => list.flags[key].private),
    privateFilters: Object.keys(list.flags).filter(key => list.flags[key].private || list.flags[key].privateFilter),
    hasYear: items.some(item => item.y), count: items.length });
  console.log(`Imported ${items.length} ${list.noun[1]}`);
}
await writeFile(path.join(out, 'lists.json'), JSON.stringify(manifest, null, 1) + '\n');
