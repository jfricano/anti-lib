// Finds a public page and cover image for each anti-library item, using keyless public APIs:
// Open Library for books (Google Books fills missing covers; Open Library also dates them), Wikipedia for films and TV (iTunes fills
// missing posters). Music uses Wikipedia for the link and Deezer
// for artwork, then MusicBrainz and the Cover Art Archive for anything still missing.
// Results are cached in data/lookups.json so each title is looked up once.
// Usage: node scripts/lookup.mjs [--retry]   (--retry re-checks titles with no match)
import { readFile, writeFile, mkdir, access, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

const dataDir = path.join(root, 'data');
const cacheFile = path.join(dataDir, 'lookups.json');
const UA = 'jfricano-antilibrary/1.0 (https://github.com/jfricano/anti-lib)';

export const lookupKey = (listId, item) => `${listId}|${item.t}|${item.c || ''}`;

export async function readLookups() {
  try { return JSON.parse(await readFile(cacheFile, 'utf8')); } catch { return {}; }
}

// Each thread's stops in order, with what a thread page needs from their rows (credit, shelf, link, cover) and the
// step line, so a thread page reads data/threads.json ({ <list id>: [{id, name, why, stops}] }) instead of a whole
// list. Written after the rows have their links and covers, by the importer and again by the lookups.
export function threadStops(lists, rows) {
  const out = {};
  for (const list of lists) {
    if (!list.threads?.length || !rows[list.id]) continue;
    out[list.id] = list.threads.map(({ id, name, why }) => ({ id, name, why,
      stops: rows[list.id].filter(item => item.th?.[id]).sort((a, b) => a.th[id][0] - b.th[id][0])
        .map(({ t, c, y, w, s, d, l, i, th }) => Object.fromEntries(Object.entries({ t, c, y, w, s, d, l, i, step: th[id][1] }).filter(([, v]) => v !== undefined && v !== ''))) }));
  }
  return out;
}

// Copies cached links (l), images (i), and MusicBrainz details for music onto items in place:
// the Discogs page becomes the link, with genres (k) and a Rate Your Music page (r) alongside.
// Books with no cover from Open Library or Wikipedia take one from Google Books.
export function applyLookups(listId, items, lookups) {
  for (const item of items) {
    const hit = lookups[lookupKey(listId, item)], details = lookups[detailsKey(listId, item)];
    delete item.l; delete item.i; delete item.k; delete item.r;
    if (hit?.l) item.l = hit.l;
    if (hit?.i) item.i = hit.i;
    if (details?.discogs) item.l = details.discogs;
    // Music links go to AllMusic in place of Wikipedia: an artist's discography, or the album's page.
    const allmusic = lookups[allmusicKey(listId, item)];
    if (allmusic && (item.f?.includes('path') || !item.l || item.l.includes('wikipedia.org'))) item.l = allmusic;
    if (details?.genres?.length) item.k = details.genres;
    if (details?.rym) item.r = details.rym;
    if (details?.imdb) item.l = details.imdb;
    if (listId === 'films' && pinOf(item)) item.l = `https://www.imdb.com/title/${pinOf(item)}/`;
    if (details?.poster) item.i = details.poster;
    if (details?.cover && !item.i) item.i = details.cover;
    if (details?.link && !item.l) item.l = details.link;
    // Book titles link to Goodreads; without a Goodreads page the page falls back to a Goodreads search.
    if (listId === 'books' && goodreadsKey(item) in lookups) {
      if (lookups[goodreadsKey(item)]) item.l = lookups[goodreadsKey(item)]; else delete item.l;
    }
    // A book's year comes from book-years.json; Open Library's year only fills a book the file leaves undated.
    // Compared on the first full run, Open Library's first_publish_year was off by more than two years for a
    // quarter of the books (often a recent edition or translation), so it can't overrule the file.
    const published = listId === 'books' && lookups[yearKey(item)]?.y;
    if (published && item.y == null) item.y = published;
  }
  return items;
}
// Artist path records take the same links and covers as albums, without genres. The artist's name links to their
// AllMusic page, found when the artist was a row on the albums list.
export function applyPathLookups(paths, lookups) {
  for (const p of paths) {
    for (const record of applyLookups('albums', p.records, lookups)) { delete record.k; delete record.r; }
    const allmusic = lookups[allmusicKey('albums', { t: p.artist })];
    if (allmusic) p.g = allmusic.replace(/\/discography$/, ''); else delete p.g;
    applyPhoto(p, 'albums', lookups);
  }
  return paths;
}
// The person's photo (ph) is the one saved in data/photos, with its Commons credit, when it is still the photo the
// path asks for.
const WHO = { albums: 'artist', books: 'author', films: 'director' };
const photoKey = (listId, p) => `${listId}-photo|${p[WHO[listId]]}`;
function applyPhoto(p, listId, lookups) {
  const photo = lookups[photoKey(listId, p)];
  delete p.ph;
  if (photo?.file && p.photo !== false && (!p.photo?.file || photo.file === p.photo.file)) {
    const by = p.photo?.by || photo.by;
    p.ph = { f: `photos/${WHO[listId]}s/${p.id}.${photo.ext || 'jpg'}`, w: photo.w, h: photo.h, ...(by && { by }), ...(photo.lic && { lic: photo.lic }),
      u: photo.u, ...(p.photo?.pos && { pos: p.photo.pos }) };
  }
}
// Author path books and director path films on the list take the link and cover of their row (a work read inside a
// collection takes the collection's); the rest are looked up as titles of their own list.
export function applyAuthorPathLookups(paths, lookups, rows, listId = 'books') {
  rows = new Map(rows.map(item => [`${item.t}|${item.c || ''}`, item]));
  for (const p of paths) for (const record of p.records) {
    const row = rows.get(`${record.v || record.t}|${record.c}`);
    if (!row) { applyLookups(listId, [record], lookups); delete record.k; delete record.r; continue; }
    delete record.l; delete record.i;
    if (row.l) record.l = row.l;
    if (row.i) record.i = row.i;
  }
  for (const p of paths) applyPhoto(p, listId, lookups);
  return paths;
}
// Bump a list's version when its details lookup changes, so every title is looked up again.
const DETAILS_VERSION = { films: 2 };
const goodreadsKey = item => `books-goodreads|${item.t}|${item.c || ''}`;
export const yearKey = item => `books-year|${item.t}|${item.c || ''}`;
const allmusicKey = (listId, item) => `${listId}-allmusic|${item.t}|${item.c || ''}`;
const detailsKey = (listId, item) => `${listId}-details${DETAILS_VERSION[listId] || ''}|${item.t}|${item.c || ''}`;

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/^\s*(the|a|an)\s+/, '').replace(/\s+/g, ' ').trim();
const short = s => fold(String(s || '').split(/[:;]/)[0]);
const sameTitle = (a, b) => {
  const [x, y] = [short(a), short(b)];
  return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) > 6 && (x.startsWith(y) || y.startsWith(x))));
};
// Albums need the whole title: the prefix leeway above matched The Velvet Underground to The Velvet Underground & Nico,
// Tin Machine II to Tin Machine and A Love Supreme: Live in Seattle to A Love Supreme. A longer title only passes when
// the extra words name an edition (remastered, deluxe, 2009, 50th anniversary, vol. 1).
const EDITION = /^(remaster(ed|s)?|deluxe|super|edition|expanded|anniversary|version|mono|stereo|bonus|tracks?|reissue|special|legacy|collector|collectors|s|\d{4}|\d+(st|nd|rd|th)|vol|volume|1|one|i)$/;
const sameAlbum = (a, b) => {
  const [x, y] = [fold(a), fold(b)].sort((p, q) => p.length - q.length);
  if (!x || !y) return false;
  if (x === y) return true;
  return y.startsWith(`${x} `) && y.slice(x.length).trim().split(' ').every(w => EDITION.test(w));
};
const surname = name => fold(String(name || '').split(/\s*(?:&|,| and )\s*/)[0]).split(' ').filter(w => !/^(jr|sr|ii|iii)$/.test(w)).at(-1) || '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(url, headers = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } }).catch(() => null);
    if (response?.ok) return response.json();
    if (response && response.status < 500 && response.status !== 429) throw Error(`${response.status} ${url}`);
    const wait = Number(response?.headers.get('retry-after'));
    await sleep(wait ? wait * 1000 + 250 : 1500 * 2 ** attempt);
  }
  throw Error(`Gave up on ${url}`);
}

async function openLibrary(item, params) {
  const { docs = [] } = await getJson(`https://openlibrary.org/search.json?${params}`);
  const matches = docs.filter(d => sameTitle(d.title, item.t));
  const exact = matches.filter(d => short(d.title) === short(item.t));
  const doc = exact[0] || matches[0];
  if (!doc) return null;
  const cover = (exact.find(d => d.cover_i) || matches.find(d => d.cover_i))?.cover_i;
  return { s: 'openlibrary', l: `https://openlibrary.org${doc.key}`, ...(cover && { i: `https://covers.openlibrary.org/b/id/${cover}-M.jpg` }) };
}

// Year lookups go to Open Library one a second, so a full first run stays polite.
let yearQueue = Promise.resolve();
const yearGet = url => (yearQueue = yearQueue.then(() => sleep(1000)).then(() => getJson(url)));
// The first publication year Open Library gives the book's work: the work the cover lookup matched if it found one,
// otherwise the best title match by the same author.
async function bookYear(item, lookups) {
  const title = item.t.replace(/\(.*?\)/g, '').split(':')[0].trim();
  const author = item.c && !/various|anonymous|et al/i.test(item.c) ? surname(item.c) : '';
  const fields = 'key,title,first_publish_year';
  const { docs = [] } = await yearGet(`https://openlibrary.org/search.json?${new URLSearchParams({ title, ...(author && { author }), limit: '8', fields })}`);
  const work = /^https:\/\/openlibrary\.org(\/works\/OL\d+W)$/.exec(lookups[lookupKey('books', item)]?.l || '')?.[1];
  const matches = docs.filter(d => sameTitle(d.title, item.t) && d.first_publish_year);
  const doc = docs.find(d => d.key === work && d.first_publish_year) || matches.find(d => short(d.title) === short(item.t)) || matches[0];
  return doc ? { y: doc.first_publish_year, k: doc.key } : null;
}

async function book(item) {
  const title = item.t.replace(/\(.*?\)/g, '').split(':')[0].trim();
  const fields = 'key,title,author_name,cover_i';
  const author = item.c && !/various|anonymous|et al/i.test(item.c) ? surname(item.c) : '';
  // The author filter runs on Open Library's side, which also knows names written in other scripts.
  const hit = await openLibrary(item, new URLSearchParams({ title, ...(author && { author }), limit: '8', fields }))
    || await openLibrary(item, new URLSearchParams({ q: `${title} ${item.c || ''}`, limit: '8', fields }));
  if (hit?.i) return hit;
  const wiki = await wikipedia(`${title} ${item.c || ''} book`, p => sameTitle(p.title, item.t) &&
    /book|novel|novella|essay|poem|poetry|treatise|memoir|collection|play|text|work|dialogue|epic|scripture|manifesto|autobiography|biography|non-fiction/i.test(p.description || ''));
  return hit ? { ...hit, ...(wiki?.i && { i: wiki.i }) } : wiki;
}

async function wikipedia(query, accept, fallback = () => null) {
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrsearch: query, gsrlimit: '6',
    prop: 'pageimages|description', piprop: 'thumbnail', pithumbsize: '400', pilicense: 'any', redirects: '1', origin: '*' });
  const { query: result } = await getJson(`https://en.wikipedia.org/w/api.php?${params}`);
  const page = (result?.pages || []).sort((a, b) => a.index - b.index).find(accept) || fallback();
  if (!page) return null;
  return { s: 'wikipedia', l: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, ...(page.thumbnail && { i: page.thumbnail.source }) };
}
const nearYear = (text, year) => [year - 1, year, year + 1].some(y => text.includes(String(y)));
// Wikipedia descriptions often leave out the year, so a page naming the right year wins and a
// plain title match is the fallback.
// Pages about a film's soundtrack or score, or an unmade film of the same name, are not the film.
const NOT_FILM = /soundtrack|score|album|song|cancell?ed|unproduced|unmade|unfinished/i;
export const wrongFilmPage = link => NOT_FILM.test(decodeURIComponent(String(link || '').split('/wiki/')[1] || '').match(/\(([^)]*)\)$/)?.[1] || '');
async function film(item) {
  // Short titles must match exactly (Dead Man is not Dead Man Walking), and a description that names
  // a director has to name this one.
  const titleOk = p => item.t.length > 20 ? sameTitle(p.title, item.t) : short(p.title) === short(item.t);
  const names = fold(item.c).split(' ').filter(w => w.length > 3);
  const directorOk = p => !/ by /i.test(p.description || '') || !names.length || names.some(w => fold(p.description).includes(w));
  const isFilm = p => titleOk(p) && directorOk(p) && /film|documentary|miniseries|series|anime|movie/i.test(p.description || '') &&
    !NOT_FILM.test(p.description || '') && !NOT_FILM.test(p.title.match(/\(([^)]*)\)$/)?.[1] || '');
  let pick = null;
  const hit = await wikipedia(`${item.t} ${item.y || ''} film`, p => {
    if (!isFilm(p)) return false;
    const dated = !item.y || nearYear(`${p.title} ${p.description}`, item.y);
    const otherYear = /\b(18|19|20)\d\d\b/.test(`${p.title} ${p.description}`);
    if (dated) return true;
    if (!otherYear && !pick) pick = p;
    return false;
  }, () => pick);
  return hit;
}

// TV shows: a Wikipedia page described as a series, preferring one that names the start year.
async function tv(item) {
  const isShow = p => sameTitle(p.title, item.t) && /television|tv|series|sitcom|miniseries|anime|show|sketch|docuseries|serial|programme/i.test(p.description || '');
  let pick = null;
  return wikipedia(`${item.t} ${item.y || ''} TV series`, p => {
    if (!isShow(p)) return false;
    if (!item.y || nearYear(`${p.title} ${p.description}`, item.y)) return true;
    pick ??= p;
    return false;
  }, () => pick);
}

function wikipediaAlbum(item) {
  if (item.f?.includes('path')) {
    return wikipedia(item.t, p => sameTitle(p.title, item.t) &&
      /band|musician|singer|rapper|composer|group|songwriter|artist|duo|pianist|saxophonist|trumpeter|guitarist|producer|DJ|ensemble|orchestra|poet|conductor|vocalist/i.test(p.description || ''));
  }
  const artist = surname(item.c);
  const musical = /album|soundtrack|compilation|\bEP\b|recording|record|live|composition|symphony|concerto|opera|requiem|ballet|suite|sonata|oratorio|mass|score|work by/i;
  let pick = null, subtitled = null;
  return wikipedia(`${item.t} ${item.c || ''} album`, p => {
    const d = p.description || '';
    if (!musical.test(d)) return false;
    const byArtist = !artist || fold(d).includes(artist) || p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(artist);
    if (!sameAlbum(p.title, item.t)) {
      // A page that only adds a subtitle (Free Jazz: A Collective Improvisation, Otis Blue/Otis Redding Sings Soul) is
      // the last resort, after every page with the whole title.
      if (!subtitled && byArtist && fold(p.title.split(/\s*[:,/]\s*/)[0]) === fold(item.t)) subtitled = p;
      return false;
    }
    if (byArtist) return true;
    // A description without any artist ("14th studio album") is a fallback, never one naming someone else.
    if (!pick && !/\bby\b/i.test(d) && !/\(.*\)/.test(p.title.replace(/\((album|EP|soundtrack)\)/i, ''))) pick = p;
    return false;
  }, () => pick || subtitled);
}

async function deezer(kind, q) {
  const result = await getJson(`https://api.deezer.com/search/${kind}?${new URLSearchParams({ q, limit: '8' })}`);
  if (result.error) throw Error(`Deezer: ${result.error.message || result.error.type}`);
  return result.data || [];
}

async function deezerArt(item) {
  if (item.f?.includes('path')) {
    const match = (await deezer('artist', item.t)).filter(a => sameTitle(a.name, item.t)).sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0];
    return match && !/\/artist\/\//.test(match.picture_medium) ? { l: match.link, i: match.picture_medium } : null;
  }
  const artist = surname(item.c);
  const q = item.c ? `artist:"${item.c.split(/\s*(?:&| and |,)\s*/)[0]}" album:"${item.t.split(':')[0]}"` : item.t;
  const match = (await deezer('album', q)).find(a => sameAlbum(a.title, item.t) && (!artist || fold(a.artist?.name).includes(artist)));
  return match && !/\/cover\/\//.test(match.cover_medium) ? { l: match.link, i: match.cover_medium } : match ? { l: match.link } : null;
}

// MusicBrainz asks for at most one request per second.
let musicbrainzQueue = Promise.resolve();
const musicbrainz = url => (musicbrainzQueue = musicbrainzQueue.then(() => sleep(1100)).then(() => getJson(url)));

async function musicbrainzArt(item) {
  const path = item.f?.includes('path');
  const q = path ? `artist:"${item.t}"` : `releasegroup:"${item.t.split(':')[0]}"${item.c ? ` AND artist:"${item.c.split(/\s*(?:&| and |,)\s*/)[0]}"` : ''}`;
  const kind = path ? 'artist' : 'release-group';
  const result = await musicbrainz(`https://musicbrainz.org/ws/2/${kind}/?${new URLSearchParams({ query: q, fmt: 'json', limit: '5' })}`);
  const rows = result[path ? 'artists' : 'release-groups'] || [];
  const match = rows.find(r => r.score >= 85 && (path ? sameTitle(r.name, item.t) : sameAlbum(r.title, item.t)));
  if (!match) return null;
  const hit = { l: `https://musicbrainz.org/${kind}/${match.id}` };
  if (!path) {
    const cover = `https://coverartarchive.org/release-group/${match.id}/front-250`;
    const response = await fetch(cover, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA } }).catch(() => null);
    if (response?.ok) hit.i = cover;
  }
  return hit;
}

// The Wikipedia page is the better link; Deezer has the more complete artwork; MusicBrainz fills gaps.
async function album(item) {
  const quiet = promise => promise.catch(error => { console.warn(error.message); return null; });
  const [wiki, art] = await Promise.all([wikipediaAlbum(item), quiet(deezerArt(item))]);
  let link = wiki?.l || art?.l, image = art?.i || wiki?.i, source = wiki ? 'wikipedia' : art ? 'deezer' : '';
  if (!image || !link) {
    const brainz = await quiet(musicbrainzArt(item));
    if (brainz) { link ||= brainz.l; image ||= brainz.i; source ||= 'musicbrainz'; }
  }
  return link || image ? { s: source, ...(link && { l: link }), ...(image && { i: image }) } : null;
}

// MusicBrainz knows each album's Discogs master page (every pressing grouped together), its
// Rate Your Music page and its genres.
async function musicbrainzDetails(item) {
  const path = item.f?.includes('path'), kind = path ? 'artist' : 'release-group';
  const q = path ? `artist:"${item.t}"` : `releasegroup:"${item.t.split(':')[0]}"${item.c ? ` AND artist:"${item.c.split(/\s*(?:&| and |,)\s*/)[0]}"` : ''}`;
  const result = await musicbrainz(`https://musicbrainz.org/ws/2/${kind}/?${new URLSearchParams({ query: q, fmt: 'json', limit: '5' })}`);
  const rows = (result[path ? 'artists' : 'release-groups'] || []).filter(r => r.score >= 85 && (path ? sameTitle(r.name, item.t) : sameAlbum(r.title, item.t)));
  const match = rows.find(r => path || r['primary-type'] === 'Album') || rows[0];
  if (!match) return null;
  const detail = await musicbrainz(`https://musicbrainz.org/ws/2/${kind}/${match.id}?inc=url-rels+genres&fmt=json`);
  const urls = (detail.relations || []).map(r => r.url?.resource || '');
  const discogs = urls.find(u => /discogs\.com\/(master|artist|release)\//.test(u));
  const rym = urls.find(u => /rateyourmusic\.com\//.test(u));
  const genres = (detail.genres || []).sort((a, b) => b.count - a.count).slice(0, 3).map(g => g.name);
  return { mb: `https://musicbrainz.org/${kind}/${match.id}`, ...(discogs && { discogs }), ...(rym && { rym }), genres };
}

// Google Books as the last resort for a book cover (and the link, if nothing else matched). Keyless calls share
// a quota that shared runners usually exhaust, so an optional GOOGLE_BOOKS_API_KEY secret gives it its own. After
// three rate-limited titles in a row it is skipped for the rest of the run; those titles are retried next run.
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';
let googleMisses = 0;
async function googleBooks(item) {
  if (googleMisses >= 3) throw Error(`Skipped Google Books for ${item.t}: rate-limited`);
  const title = item.t.replace(/\(.*?\)/g, '').split(':')[0].trim();
  const author = item.c && !/various|anonymous|et al/i.test(item.c) ? surname(item.c) : '';
  const q = `intitle:"${title}"${author ? ` inauthor:${author}` : ''}`;
  let items;
  try {
    ({ items = [] } = await getJson(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, maxResults: '8', printType: 'books', ...(GOOGLE_KEY && { key: GOOGLE_KEY }) })}`));
    googleMisses = 0;
  } catch (error) {
    if (++googleMisses === 3) console.warn('Google Books keeps refusing requests; skipping it for the rest of this run.');
    throw Error(error.message.replace(/([?&]key=)[^&]+/, '$1…'));
  }
  const volume = items.map(v => v.volumeInfo || {}).find(v => sameTitle(v.title, item.t) && (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail));
  if (!volume) return null;
  const cover = (volume.imageLinks.thumbnail || volume.imageLinks.smallThumbnail).replace(/^http:/, 'https:').replace(/&edge=curl/, '');
  const link = (volume.canonicalVolumeLink || volume.infoLink || '').replace(/^http:/, 'https:');
  return { cover, ...(link.startsWith('https://') && { link }) };
}

// Apple's iTunes Search, keyless, as the fallback for film and TV posters (and the link, if Wikipedia
// had no page). It allows about 20 requests a minute, so requests are spaced out.
let itunesQueue = Promise.resolve();
const itunesGet = url => (itunesQueue = itunesQueue.then(() => sleep(3200)).then(() => getJson(url)));
const itunes = (entity, field) => async item => {
  const { results = [] } = await itunesGet(`https://itunes.apple.com/search?${new URLSearchParams({ term: item.t, media: entity === 'movie' ? 'movie' : 'tvShow', entity, limit: '10', country: 'US' })}`);
  const near = r => !item.y || !r.releaseDate || Math.abs(Number(r.releaseDate.slice(0, 4)) - item.y) <= 1;
  const hit = results.find(r => sameTitle(r[field], item.t) && r.artworkUrl100 && near(r)) || results.find(r => sameTitle(r[field], item.t) && r.artworkUrl100);
  if (!hit) return null;
  const link = hit.trackViewUrl || hit.collectionViewUrl || hit.artistViewUrl || '';
  return { cover: hit.artworkUrl100.replace('100x100bb', '400x400bb'), ...(link.startsWith('https://') && { link }) };
};

// Films link to IMDb (the ID comes from Wikidata through the film's Wikipedia page), with posters
// from TMDB and then OMDb. Both need a free API key, read from the TMDB_API_KEY and OMDB_API_KEY
// environment variables (repository secrets in the workflow). Without keys, posters fall back to
// Wikipedia and iTunes.
const TMDB_KEY = process.env.TMDB_API_KEY || '', OMDB_KEY = process.env.OMDB_API_KEY || '';
// IMDb IDs checked by hand, by title, year and director, for films the Wikipedia search gets wrong
// or that share a title (and sometimes a year) with another film on the list.
export const IMDB_PINS = {
  'Dune|1984|David Lynch': 'tt0087182', 'Terminator 2: Judgment Day|1991|James Cameron': 'tt0103064',
  'Pride & Prejudice|2005|Joe Wright': 'tt0414387', 'The Tree of Life|2011|Terrence Malick': 'tt0478304',
  '1917|2019|Sam Mendes': 'tt8579674', 'Mandy|2018|Panos Cosmatos': 'tt6998518',
  'Election|1999|Alexander Payne': 'tt0126886', 'Election|2005|Johnnie To': 'tt0434008',
  'Dead Man|1995|Jim Jarmusch': 'tt0112817', 'Dead Man Walking|1995|Tim Robbins': 'tt0112818',
};
const pinOf = item => IMDB_PINS[`${item.t}|${item.y || ''}|${item.c || ''}`];
async function imdbId(item, lookups) {
  if (pinOf(item)) return pinOf(item);
  const wiki = lookups[lookupKey('films', item)]?.l || '';
  const title = decodeURIComponent(wiki.split('/wiki/')[1] || '').replace(/_/g, ' ');
  if (!title) return '';
  const { entities = {} } = await getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', sites: 'enwiki', titles: title, props: 'claims', format: 'json' })}`);
  const claim = Object.values(entities)[0]?.claims?.P345?.[0]?.mainsnak?.datavalue?.value;
  return /^tt\d+$/.test(claim || '') ? claim : '';
}
async function tmdbPoster(item, imdb) {
  const auth = { Authorization: `Bearer ${TMDB_KEY}` };
  let hit;
  if (imdb) hit = (await getJson(`https://api.themoviedb.org/3/find/${imdb}?external_source=imdb_id`, auth)).movie_results?.[0];
  if (!hit) {
    const { results = [] } = await getJson(`https://api.themoviedb.org/3/search/movie?${new URLSearchParams({ query: item.t, ...(item.y && { year: String(item.y) }) })}`, auth);
    hit = results.find(r => sameTitle(r.title, item.t) || sameTitle(r.original_title, item.t));
  }
  return hit?.poster_path ? `https://image.tmdb.org/t/p/w342${hit.poster_path}` : '';
}
async function omdbPoster(item, imdb) {
  const params = imdb ? { i: imdb } : { t: item.t, ...(item.y && { y: String(item.y) }), type: 'movie' };
  const result = await getJson(`https://www.omdbapi.com/?${new URLSearchParams({ ...params, apikey: OMDB_KEY })}`);
  return /^https:\/\//.test(result.Poster || '') ? result.Poster : '';
}
async function filmDetails(item, lookups) {
  const imdb = await imdbId(item, lookups).catch(() => '');
  let poster = '';
  if (TMDB_KEY) poster = await tmdbPoster(item, imdb).catch(() => '');
  if (!poster && OMDB_KEY) poster = await omdbPoster(item, imdb).catch(() => '');
  const fallback = !poster && !lookups[lookupKey('films', item)]?.i ? await itunes('movie', 'trackName')(item).catch(() => null) : null;
  return { ...(imdb && { imdb: `https://www.imdb.com/title/${imdb}/` }), ...(poster && { poster }), ...(fallback?.cover && { cover: fallback.cover }),
    ...(!TMDB_KEY && !OMDB_KEY && { noKeys: true }) };
}

// AllMusic for music links: the AllMusic ID Wikidata keeps for the title's Wikipedia page (P1728 for an artist,
// P1729 for an album), fifty pages a request, else an AllMusic search. Artist links open the discography.
const allmusicSearch = (item, artist) => `https://www.allmusic.com/search/${artist ? 'artists' : 'albums'}/${encodeURIComponent(artist ? item.t : [item.t, item.c].filter(Boolean).join(' '))}`;
async function allmusicLinks(items, lookups) {
  const pageOf = item => decodeURIComponent((lookups[lookupKey('albums', item)]?.l || '').split('en.wikipedia.org/wiki/')[1] || '').replace(/_/g, ' ').split('#')[0];
  const found = {};
  const titles = [...new Set(items.map(pageOf).filter(Boolean))];
  for (let n = 0; n < titles.length; n += 50) {
    const { entities = {} } = await getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', sites: 'enwiki', titles: titles.slice(n, n + 50).join('|'), props: 'claims|sitelinks', sitefilter: 'enwiki', format: 'json' })}`);
    for (const entity of Object.values(entities)) {
      const title = entity.sitelinks?.enwiki?.title;
      const id = property => entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
      if (title) found[title] = { artist: id('P1728'), album: id('P1729') };
    }
  }
  for (const item of items) {
    const artist = item.f?.includes('path'), ids = found[pageOf(item)] || {};
    const id = artist ? ids.artist : ids.album;
    lookups[allmusicKey('albums', item)] = artist && /^mn\d+$/.test(id || '') ? `https://www.allmusic.com/artist/${id}/discography`
      : !artist && /^mw\d+$/.test(id || '') ? `https://www.allmusic.com/album/${id}`
      : allmusicSearch(item, artist);
  }
}

// Photos for the path pages: the Commons file the path names (photo.file in lists/artist-paths.json and the others),
// else the image Wikidata keeps for the person's Wikipedia page (P18). Each is saved once to
// data/photos/<artists|authors|directors>/<id>.jpg (or .png, for a PNG on Commons) at up to 1280 pixels wide and
// 1000 high, so the page doesn't load it from Commons, with the author and license the page credits. A credit that
// Commons words awkwardly can be set by hand (photo.by).
const plain = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, '').replace(/\s+/g, ' ').trim();
// "Photograph by Jay Handler (Q123) https://…" → "Jay Handler"; "Unknown author Unknown author" → "Unknown author".
const credit = text => plain(text).replace(/https?:\/\/\S+/g, '').replace(/\((Q\d+|photographer)\)/gi, '').replace(/ from [^;]*/, '').replace(/^(photographer|photo(graph)?( by)?)\s*[-:]?\s*/i, '')
  .replace(/^(.+?) \1$/, '$1').replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();
async function pathPhotos(listId, paths, lookups, retry) {
  let failed = 0;
  const dir = path.join(dataDir, 'photos', `${WHO[listId]}s`);
  await mkdir(dir, { recursive: true });
  const saved = async (id, ext = 'jpg') => access(path.join(dir, `${id}.${ext}`)).then(() => true, () => false);
  for (const p of paths) {
    if (p.photo === false) continue;
    const key = photoKey(listId, p), cached = lookups[key], wanted = p.photo?.file, name = p[WHO[listId]];
    if (cached && (wanted ? cached.file === wanted : cached.auto) && (cached.file ? await saved(p.id, cached.ext) : !retry)) continue;
    try {
      let file = wanted;
      if (!file) {
        // An artist's Wikipedia page is the one found for their row on the albums list; anyone else's is their name.
        const link = listId === 'albums' ? lookups[lookupKey('albums', { t: name })]?.l || '' : '';
        const page = link ? decodeURIComponent(link.split('en.wikipedia.org/wiki/')[1] || '').replace(/_/g, ' ').split('#')[0] : name;
        const { entities = {} } = page ? await getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', sites: 'enwiki', titles: page, props: 'claims', format: 'json' })}`) : {};
        file = Object.values(entities)[0]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      }
      if (!file) { lookups[key] = { auto: true }; continue; }
      const { query = {} } = await getJson(`https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', titles: `File:${file}`,
        prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '1280', iiurlheight: '1000', iiextmetadatafilter: 'LicenseShortName|Artist|Credit', format: 'json' })}`);
      const info = Object.values(query.pages || {})[0]?.imageinfo?.[0];
      if (!info?.thumburl || !/jpeg|png/.test(info.mime)) throw Error(`no usable image for ${name}: ${file}`);
      // Commons' image server turns away bursts (429), so a refused download waits and tries again.
      let response;
      for (const wait of [0, 10, 30, 60]) {
        if (wait) await new Promise(done => setTimeout(done, wait * 1000));
        response = await fetch(info.thumburl, { headers: { 'User-Agent': UA } });
        if (response.status !== 429) break;
      }
      if (!response.ok) throw Error(`${response.status} for ${info.thumburl}`);
      const ext = /\.png$/i.test(new URL(info.thumburl).pathname) ? 'png' : 'jpg';
      await writeFile(path.join(dir, `${p.id}.${ext}`), Buffer.from(await response.arrayBuffer()));
      const meta = info.extmetadata || {};
      const by = credit(meta.Artist?.value) || credit(meta.Credit?.value);
      lookups[key] = { file, ...(!wanted && { auto: true }), ...(ext === 'png' && { ext }), w: info.thumbwidth, h: info.thumbheight,
        ...(by && { by: by.length > 80 ? `${by.slice(0, 79).trim()}…` : by }),
        ...(meta.LicenseShortName?.value && { lic: plain(meta.LicenseShortName.value) }), u: info.descriptionurl };
      console.log(`photo: ${name}: ${file}`);
    } catch (error) { failed++; console.warn(error.message); }
  }
  // A photo whose person no longer has a path, or that a new photo replaced, is dropped.
  const keep = new Set(paths.map(p => `${p.id}.${lookups[photoKey(listId, p)]?.ext || 'jpg'}`));
  for (const file of await readdir(dir)) if (!keep.has(file)) await unlink(path.join(dir, file));
  return failed;
}

// A book's Goodreads page: the Goodreads ID Open Library keeps for the matched work, or for a book matched on
// Wikipedia, the one Wikidata keeps (P2969). Open Library, Wikipedia and Google Books still supply the covers.
async function goodreads(item, lookups) {
  const link = lookups[lookupKey('books', item)]?.l || '';
  const work = /^https:\/\/openlibrary\.org(\/works\/OL\d+W)$/.exec(link)?.[1];
  if (work) {
    const search = async params => (await getJson(`https://openlibrary.org/search.json?${new URLSearchParams({ ...params, fields: 'key,id_goodreads', limit: '20' })}`)).docs || [];
    // Look the work up by its key, and failing that by title and author, keeping only the same work.
    let doc = (await search({ q: `key:"${work}"` })).find(d => d.key === work);
    doc ??= (await search({ q: `${item.t.replace(/\(.*?\)/g, '').split(':')[0].trim()} ${item.c || ''}` })).find(d => d.key === work);
    const id = doc?.id_goodreads?.find(g => /^\d+$/.test(g));
    return id ? `https://www.goodreads.com/book/show/${id}` : null;
  }
  const page = decodeURIComponent(link.split('en.wikipedia.org/wiki/')[1] || '').replace(/_/g, ' ').split('#')[0];
  if (!page) return null;
  const { entities = {} } = await getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', sites: 'enwiki', titles: page, props: 'claims', format: 'json' })}`);
  const id = Object.values(entities)[0]?.claims?.P2969?.[0]?.mainsnak?.datavalue?.value;
  return /^\d+$/.test(id || '') ? `https://www.goodreads.com/book/show/${id}` : null;
}

const FINDERS = { books: book, films: film, tv, albums: album };
// Second sources: MusicBrainz details for every album; Google Books and iTunes only fill missing covers.
const DETAILS = { albums: musicbrainzDetails, books: googleBooks, films: filmDetails, tv: itunes('tvSeason', 'artistName') };
const noCover = list => (item, lookups) => !lookups[lookupKey(list, item)]?.i;
// Films are re-checked once poster keys are added, if an earlier run had none.
const NEEDS = { books: noCover('books'), tv: noCover('tv'),
  films: (item, lookups) => (TMDB_KEY || OMDB_KEY) && lookups[detailsKey('films', item)]?.noKeys };
const LIMITS = { books: 2, films: 4, tv: 4, albums: 3 };
// Album matches and MusicBrainz details found before sameAlbum carry no mark, so each is looked up once more and
// replaced unless that lookup fails (then it is tried again next run). Bump this to re-check every album after a
// matching change.
const ALBUM_MATCH = 2;
const unchecked = (item, hit) => !item.f?.includes('path') && Boolean(hit) && hit.v !== ALBUM_MATCH;
const marked = (listId, item, hit) => listId === 'albums' && hit && !item.f?.includes('path') ? { ...hit, v: ALBUM_MATCH } : hit;

// Looks up every item of one list that isn't cached yet; returns how many requests failed.
async function lookUpList(listId, items, lookups, retry, saveSoon) {
  const find = FINDERS[listId];
  // A film matched to its soundtrack or an unmade namesake is looked up again, details and all.
  const stale = item => listId === 'films' && (wrongFilmPage(lookups[lookupKey('films', item)]?.l) ||
    (pinOf(item) && !lookups[detailsKey('films', item)]?.imdb?.includes(pinOf(item))));
  for (const item of items.filter(stale)) {
    if (wrongFilmPage(lookups[lookupKey('films', item)]?.l)) delete lookups[lookupKey('films', item)];
    delete lookups[detailsKey('films', item)];
  }
  const todo = items.filter(item => { const key = lookupKey(listId, item); return !(key in lookups) || (retry && !lookups[key]) ||
    (listId === 'albums' && unchecked(item, lookups[key])); });
  console.log(`${listId}: looking up ${todo.length} of ${items.length}`);
  let next = 0, failed = 0;
  await Promise.all(Array.from({ length: LIMITS[listId] }, async () => {
    while (next < todo.length) {
      const item = todo[next++], key = lookupKey(listId, item);
      try {
        const before = lookups[key]?.l, hit = marked(listId, item, await find(item));
        lookups[key] = hit;
        // The AllMusic page comes from the Wikipedia page, so a different page means finding it again.
        if (listId === 'albums' && before && hit?.l !== before) delete lookups[allmusicKey(listId, item)];
      }
      catch (error) { failed++; console.warn(error.message); }
      await saveSoon();
    }
  }));
  const details = DETAILS[listId];
  if (details) {
    const needs = NEEDS[listId] || (() => true), key = item => detailsKey(listId, item);
    const rest = listId === 'films'
      ? items.filter(item => !(key(item) in lookups) || needs(item, lookups) || (retry && !lookups[key(item)]))
      : items.filter(item => needs(item, lookups) && (!(key(item) in lookups) || (retry && !lookups[key(item)]) ||
        (listId === 'albums' && unchecked(item, lookups[key(item)]))));
    console.log(`${listId}: fetching details for ${rest.length}`);
    for (const item of rest) {
      try { lookups[detailsKey(listId, item)] = marked(listId, item, await details(item, lookups)); }
      catch (error) { failed++; console.warn(error.message); }
      await saveSoon();
    }
  }
  if (listId === 'books') {
    const rest = items.filter(item => !(goodreadsKey(item) in lookups) || (retry && !lookups[goodreadsKey(item)]));
    console.log(`books: finding Goodreads pages for ${rest.length}`);
    let next = 0;
    await Promise.all(Array.from({ length: LIMITS.books }, async () => {
      while (next < rest.length) {
        const item = rest[next++];
        try { lookups[goodreadsKey(item)] = await goodreads(item, lookups); }
        catch (error) { failed++; console.warn(error.message); }
        await saveSoon();
      }
    }));
  }
  if (listId === 'books') {
    const rest = items.filter(item => !(yearKey(item) in lookups) || (retry && !lookups[yearKey(item)]));
    console.log(`books: finding first publication years for ${rest.length}`);
    let next = 0;
    await Promise.all(Array.from({ length: LIMITS.books }, async () => {
      while (next < rest.length) {
        const item = rest[next++];
        try { lookups[yearKey(item)] = await bookYear(item, lookups); }
        catch (error) { failed++; console.warn(error.message); }
        await saveSoon();
      }
    }));
  }
  if (listId === 'albums') {
    const rest = items.filter(item => !(allmusicKey(listId, item) in lookups) || (retry && lookups[allmusicKey(listId, item)].includes('/search/')));
    console.log(`albums: finding AllMusic pages for ${rest.length}`);
    try { await allmusicLinks(rest, lookups); } catch (error) { failed++; console.warn(error.message); }
  }
  return failed;
}

async function run() {
  const retry = process.argv.includes('--retry');
  const lookups = await readLookups();
  const lists = JSON.parse(await readFile(path.join(dataDir, 'lists.json'), 'utf8'));
  let saved = Date.now();
  const save = () => writeFile(cacheFile, JSON.stringify(Object.fromEntries(Object.entries(lookups).sort())));
  const saveSoon = async () => { if (Date.now() - saved > 30000) { saved = Date.now(); await save(); } };
  const rows = {};
  for (const list of lists) {
    const file = path.join(dataDir, `${list.id}.json`);
    if (!FINDERS[list.id]) {
      console.log(`No lookup source for ${list.id}`);
      if (list.threads?.length) rows[list.id] = JSON.parse(await readFile(file, 'utf8'));
      continue;
    }
    const items = JSON.parse(await readFile(file, 'utf8'));
    const failed = await lookUpList(list.id, items, lookups, retry, saveSoon);
    await writeFile(file, JSON.stringify(applyLookups(list.id, items, lookups)));
    rows[list.id] = items;
    const found = items.filter(item => item.l).length, covers = items.filter(item => item.i).length;
    console.log(`${list.id}: ${found} linked, ${covers} with covers, ${failed} requests failed`);
  }
  await writeFile(path.join(dataDir, 'threads.json'), JSON.stringify(threadStops(lists, rows)));
  // Records on the artist paths are looked up as albums, so a record that is also on the list shares its result.
  const pathsFile = path.join(dataDir, 'paths.json');
  const paths = await readFile(pathsFile, 'utf8').then(JSON.parse, () => null);
  if (paths) {
    const records = paths.flatMap(p => p.records);
    console.log('Artist paths:');
    const failed = await lookUpList('albums', records, lookups, retry, saveSoon) + await pathPhotos('albums', paths, lookups, retry);
    await writeFile(pathsFile, JSON.stringify(applyPathLookups(paths, lookups)));
    console.log(`paths: ${records.filter(r => r.l).length} linked, ${records.filter(r => r.i).length} with covers, ${failed} requests failed`);
  }
  // Books on the author paths and films on the director paths that aren't on their list are looked up as titles of
  // that list; the steps share their rows' results.
  for (const [name, listId] of [['author-paths.json', 'books'], ['director-paths.json', 'films']]) {
    const file = path.join(dataDir, name);
    const rowPaths = await readFile(file, 'utf8').then(JSON.parse, () => null);
    if (!rowPaths) continue;
    const records = rowPaths.flatMap(p => p.records), rows = JSON.parse(await readFile(path.join(dataDir, `${listId}.json`), 'utf8'));
    console.log(`${name.replace('.json', '').replace('-', ' ')}:`);
    const listed = new Set(rows.map(item => `${item.t}|${item.c || ''}`));
    const failed = await lookUpList(listId, records.filter(r => !listed.has(`${r.v || r.t}|${r.c}`)), lookups, retry, saveSoon) +
      await pathPhotos(listId, rowPaths, lookups, retry);
    await writeFile(file, JSON.stringify(applyAuthorPathLookups(rowPaths, lookups, rows, listId)));
    console.log(`${name}: ${records.filter(r => r.l).length} linked, ${records.filter(r => r.i).length} with covers, ${failed} requests failed`);
  }
  await save();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
