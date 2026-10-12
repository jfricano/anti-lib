// Normalizes the source lists in lists/ into data/, which the portfolio page reads.
// Usage: node scripts/import.mjs [source-folder]   (defaults to lists/)
// A new list is one more entry in LISTS; sources that are missing are skipped.
// Links and covers already found by lookup.mjs are kept.
// Flags marked private only show in owner mode; privateFilter flags show as tags for everyone
// but can only be filtered on in owner mode. Every other flag is a tag and a Show filter for everyone.
// Flags marked ownerToggle (only Formative) can be switched on or off per title in owner mode; those changes live in
// data/tags.json ({ "<list id>": { "<title>|<creator>": { "<flag>": true or false } } }) and win over the source.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath as toPath } from 'node:url';
import { readLookups, applyLookups, applyPathLookups, applyAuthorPathLookups } from './lookup.mjs';
const root = toPath(new URL('../', import.meta.url));

const LISTS = [
  {
    id: 'books', label: 'Books', noun: ['book', 'books'], source: 'anti-library.json',
    fields: { title: 'title', creator: 'author', group: 'part', shelf: 'section', note: 'hook', done: 'status' },
    doneValues: ['Read', 'Digested', 'Formative'],
    creatorLabel: 'Author', groupLabel: 'Part', shelfLabel: 'Section', doneLabel: 'Read',
    search: 'https://www.goodreads.com/search?q=',
    flags: { core: { field: 'core', label: 'Core shelf' }, fringe: { field: 'fringe', label: 'Respectful fringe' }, owned: { field: 'owned', label: 'On my shelf' }, star: { field: 'star', label: 'Vonnegut frequency' },
      formative: { field: 'status', equals: 'Formative', label: 'Formative', ownerToggle: true } },
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
const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const sourceDir = process.argv[2] || path.join(root, 'lists');

// Threads are named paths through titles already on a list (lists/threads/<id>.json). Each stop gets
// th: { <thread id>: [position, step note] }, so titles stay on their shelves, and the manifest lists the
// threads with their stop counts. Stops that no longer match a title are reported and skipped.
async function readThreads(id, items) {
  let threads;
  try { threads = JSON.parse(await readFile(path.join(sourceDir, 'threads', `${id}.json`), 'utf8')); } catch { return []; }
  const byKey = new Map(items.map(item => [`${item.t}|${item.c || ''}`, item]));
  return threads.map(thread => {
    let n = 0;
    for (const stop of thread.items) {
      const item = byKey.get(`${clean(stop.t)}|${clean(stop.c)}`);
      if (!item) { console.warn(`Thread "${thread.name}": no ${id} title "${stop.t}" by "${stop.c || ''}"`); continue; }
      (item.th ??= {})[thread.id] ??= [n++, stop.step || ''];
    }
    return { id: thread.id, name: thread.name, why: thread.why || '', count: n };
  }).filter(thread => thread.count);
}
const out = path.join(root, 'data');
await mkdir(out, { recursive: true });
const manifest = [];
let books = [];
const lookups = await readLookups();
// Titles the owner removed from the page stay out even when a working copy of a list still has them.
let removed = {};
try { removed = JSON.parse(await readFile(path.join(out, 'removed.json'), 'utf8')); } catch {}
let tags = {};
try { tags = JSON.parse(await readFile(path.join(out, 'tags.json'), 'utf8')); } catch {}
// Paths: a listening order for some of the albums list's artists (docs/artist-paths.md) and a reading order for some of
// the books list's authors (docs/author-paths.md). Records are checked here so a typo fails the rebuild instead of
// breaking the page.
// Each paths file names its people by the key the page reads: artist-paths.json has artists, author-paths.json authors.
const WHO = { 'artist-paths.json': 'artist', 'author-paths.json': 'author' };
const slug = s => fold(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function readPaths(name) {
  const file = path.join(sourceDir, name);
  try { await access(file); } catch { console.log(`Skipped ${name}: no such file`); return null; }
  return Object.entries(JSON.parse(await readFile(file, 'utf8'))).map(([who, entry]) => {
    const fail = message => { throw Error(`${name}, ${who}: ${message}`); };
    const records = (entry.records || []).map(r => {
      if (!clean(r.t) || !Number.isInteger(r.y)) fail(`every record needs a title and a year (${JSON.stringify(r)})`);
      if (r.in && !r.step) fail(`${r.t} names the book it's read in, so it needs a step`);
      const record = { t: clean(r.t), c: clean(r.by) || who, y: r.y };
      if (r.by) record.b = 1;
      if (r.step) record.p = r.step;
      if (r.in) record.v = clean(r.in);
      if (r.kind) record.w = clean(r.kind);
      if (r.heard || r.read) record.d = 1;
      if (r.note) record.n = clean(r.note);
      return record;
    });
    const steps = records.filter(r => r.p).map(r => r.p).sort((a, b) => a - b);
    if (!steps.length || steps.some((step, n) => step !== n + 1)) fail(`steps must run 1, 2, 3 with no gaps (found ${steps.join(', ') || 'none'})`);
    records.sort((a, b) => a.y - b.y || (a.p || 99) - (b.p || 99));
    const names = entry.names || who.split(' / ');
    const link = /^https:\/\/www\.goodreads\.com\//.test(entry.goodreads || '') ? { g: entry.goodreads } : {};
    return { id: slug(who), [WHO[name]]: who, ...(entry.about && { about: clean(entry.about) }), ...link, names, records };
  });
}
const paths = await readPaths('artist-paths.json');
const authorPaths = await readPaths('author-paths.json');
// A path points at albums filed once, on their own shelves in music.csv; it doesn't hold copies. Each step takes the
// list row's credit, so the path page and the list share one heard mark, and its heard state comes from that row.
// A step with no row on the list fails the rebuild. A row with no note of its own shows the step's note.
const loose = s => fold(s).replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '');
function linkPathAlbums(items) {
  for (const p of paths || []) {
    const names = new Set([p.artist, ...p.names].map(loose));
    for (const r of p.records.filter(r => r.p)) {
      const row = items.find(item => !item.f?.includes('path') && loose(item.t) === loose(r.t)
        && (names.has(loose(item.c || '')) || loose(item.c || '') === loose(r.c)));
      if (!row) throw Error(`artist-paths.json, ${p.artist}: step ${r.p}, ${r.t}, isn't on the albums list`);
      r.c = row.c || '';
      if (row.d) r.d = 1; else delete r.d;
      if (!row.n && r.n) row.n = r.n;
    }
  }
  return items;
}

// An author path works the same way over the books list: each step points at a book filed once in anti-library.json,
// so a step's read state is that row's, crossed off on the list. A step can name a work read inside a book on the list
// ("in", such as an essay in a collection); it then points at that book. A step with no row fails the rebuild. A book
// off the path that is on the list anyway is linked to its row the same way.
function linkPathRows(items, file, pathList) {
  const who = WHO[file];
  for (const p of pathList || []) {
    const names = new Set([p[who], ...p.names].map(loose));
    for (const r of p.records) {
      const row = items.find(item => loose(item.t) === loose(r.v || r.t) && names.has(loose(item.c || '')));
      if (!row && !r.p) continue;
      if (!row) throw Error(`${file}, ${p[who]}: step ${r.p}, ${r.v || r.t}, isn't on the list`);
      r.c = row.c || '';
      if (r.v) r.v = row.t; else r.t = row.t;
      if (row.d) r.d = 1; else delete r.d;
      if (!row.n && r.n) row.n = r.n;
    }
  }
  return items;
}

for (const list of LISTS) {
  const file = path.join(sourceDir, list.source);
  try { await access(file); } catch { console.log(`Skipped ${list.id}: no ${list.source}`); continue; }
  const text = await readFile(file, 'utf8');
  const records = (list.source.endsWith('.json') ? JSON.parse(text) : parseCsv(text)).map(r => list.transform ? list.transform(r) : r);
  const { fields } = list;
  let items = records.filter(r => clean(r[fields.title])).map(r => {
    const item = { t: clean(r[fields.title]) };
    for (const [key, field] of [['c', fields.creator], ['y', fields.year], ['g', fields.group], ['s', fields.shelf], ['u', fields.sub], ['n', fields.note]]) {
      const value = field && clean(r[field]);
      if (value) item[key] = key === 'y' && /^\d+$/.test(value) ? Number(value) : value;
    }
    const set = tags[list.id]?.[`${item.t}|${item.c || ''}`] || {};
    const flags = Object.entries(list.flags).filter(([key, flag]) => flag.ownerToggle && typeof set[key] === 'boolean' ? set[key]
      : flag.equals ? r[flag.field] === flag.equals : truthy(r[flag.field])).map(([key]) => key);
    if (flags.length) item.f = flags;
    if (fields.done && (list.doneValues ? list.doneValues.includes(r[fields.done]) : truthy(r[fields.done]))) item.d = 1;
    return item;
  });
  if (list.id === 'albums') items = linkPathAlbums(items);
  if (list.id === 'books') items = linkPathRows(items, 'author-paths.json', authorPaths);
  items = items.filter(item => !removed[list.id]?.[`${item.t}|${item.c || ''}`]);
  const threads = await readThreads(list.id, items);
  await writeFile(path.join(out, `${list.id}.json`), JSON.stringify(applyLookups(list.id, items, lookups)));
  if (list.id === 'books') books = items;
  const { source, fields: _, transform, doneValues, ...meta } = list;
  manifest.push({ ...meta, flags: Object.fromEntries(Object.entries(list.flags).map(([key, flag]) => [key, flag.label])),
    privateFlags: Object.keys(list.flags).filter(key => list.flags[key].private),
    privateFilters: Object.keys(list.flags).filter(key => list.flags[key].private || list.flags[key].privateFilter),
    toggles: Object.keys(list.flags).filter(key => list.flags[key].ownerToggle),
    hasYear: items.some(item => item.y), count: items.length, ...(threads.length && { threads }) });
  console.log(`Imported ${items.length} ${list.noun[1]}`);
}
await writeFile(path.join(out, 'lists.json'), JSON.stringify(manifest, null, 1) + '\n');

// Paths: written after the lists, since a step takes its credit (and, for books, its link and cover) from its row.
if (paths) {
  await writeFile(path.join(out, 'paths.json'), JSON.stringify(applyPathLookups(paths, lookups)));
  console.log(`Imported ${paths.length} artist paths`);
}
if (authorPaths) {
  await writeFile(path.join(out, 'author-paths.json'), JSON.stringify(applyAuthorPathLookups(authorPaths, lookups, books)));
  console.log(`Imported ${authorPaths.length} author paths`);
}
