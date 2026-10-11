// Finds a public page and cover image for each anti-library item, using keyless public APIs:
// Open Library for books (Google Books fills missing covers), Wikipedia for films and TV (iTunes fills
// missing posters). Music uses Wikipedia for the link and Deezer
// for artwork, then MusicBrainz and the Cover Art Archive for anything still missing.
// Results are cached in data/lookups.json so each title is looked up once.
// Usage: node scripts/lookup.mjs [--retry]   (--retry re-checks titles with no match)
import { readFile, writeFile } from 'node:fs/promises';
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
    if (details?.genres?.length) item.k = details.genres;
    if (details?.rym) item.r = details.rym;
    if (details?.imdb) item.l = details.imdb;
    if (details?.poster) item.i = details.poster;
    if (details?.cover && !item.i) item.i = details.cover;
    if (details?.link && !item.l) item.l = details.link;
  }
  return items;
}
// Bump a list's version when its details lookup changes, so every title is looked up again.
const DETAILS_VERSION = { films: 2 };
const detailsKey = (listId, item) => `${listId}-details${DETAILS_VERSION[listId] || ''}|${item.t}|${item.c || ''}`;

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/^\s*(the|a|an)\s+/, '').replace(/\s+/g, ' ').trim();
const short = s => fold(String(s || '').split(/[:;]/)[0]);
const sameTitle = (a, b) => {
  const [x, y] = [short(a), short(b)];
  return Boolean(x && y) && (x === y || (Math.min(x.length, y.length) > 6 && (x.startsWith(y) || y.startsWith(x))));
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
async function film(item) {
  const isFilm = p => sameTitle(p.title, item.t) && /film|documentary|miniseries|series|anime|movie/i.test(p.description || '');
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
  let pick = null;
  return wikipedia(`${item.t} ${item.c || ''} album`, p => {
    const d = p.description || '';
    if (!sameTitle(p.title, item.t) || !musical.test(d)) return false;
    if (!artist || fold(d).includes(artist) || p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(artist)) return true;
    // A description without any artist ("14th studio album") is a fallback, never one naming someone else.
    if (!pick && !/\bby\b/i.test(d) && !/\(.*\)/.test(p.title.replace(/\((album|EP|soundtrack)\)/i, ''))) pick = p;
    return false;
  }, () => pick);
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
  const match = (await deezer('album', q)).find(a => sameTitle(a.title, item.t) && (!artist || fold(a.artist?.name).includes(artist)));
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
  const match = rows.find(r => r.score >= 85 && sameTitle(path ? r.name : r.title, item.t));
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
  const rows = (result[path ? 'artists' : 'release-groups'] || []).filter(r => r.score >= 85 && sameTitle(path ? r.name : r.title, item.t));
  const match = rows.find(r => path || r['primary-type'] === 'Album') || rows[0];
  if (!match) return null;
  const detail = await musicbrainz(`https://musicbrainz.org/ws/2/${kind}/${match.id}?inc=url-rels+genres&fmt=json`);
  const urls = (detail.relations || []).map(r => r.url?.resource || '');
  const discogs = urls.find(u => /discogs\.com\/(master|artist|release)\//.test(u));
  const rym = urls.find(u => /rateyourmusic\.com\//.test(u));
  const genres = (detail.genres || []).sort((a, b) => b.count - a.count).slice(0, 3).map(g => g.name);
  return { mb: `https://musicbrainz.org/${kind}/${match.id}`, ...(discogs && { discogs }), ...(rym && { rym }), genres };
}

// Google Books, keyless, as the last resort for a book cover (and the link, if nothing else matched).
async function googleBooks(item) {
  const title = item.t.replace(/\(.*?\)/g, '').split(':')[0].trim();
  const author = item.c && !/various|anonymous|et al/i.test(item.c) ? surname(item.c) : '';
  const q = `intitle:"${title}"${author ? ` inauthor:${author}` : ''}`;
  const { items = [] } = await getJson(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, maxResults: '8', printType: 'books' })}`);
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
async function imdbId(item, lookups) {
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

const FINDERS = { books: book, films: film, tv, albums: album };
// Second sources: MusicBrainz details for every album; Google Books and iTunes only fill missing covers.
const DETAILS = { albums: musicbrainzDetails, books: googleBooks, films: filmDetails, tv: itunes('tvSeason', 'artistName') };
const noCover = list => (item, lookups) => !lookups[lookupKey(list, item)]?.i;
// Films are re-checked once poster keys are added, if an earlier run had none.
const NEEDS = { books: noCover('books'), tv: noCover('tv'),
  films: (item, lookups) => (TMDB_KEY || OMDB_KEY) && lookups[detailsKey('films', item)]?.noKeys };
const LIMITS = { books: 2, films: 4, tv: 4, albums: 3 };

async function run() {
  const retry = process.argv.includes('--retry');
  const lookups = await readLookups();
  const lists = JSON.parse(await readFile(path.join(dataDir, 'lists.json'), 'utf8'));
  let saved = Date.now();
  const save = () => writeFile(cacheFile, JSON.stringify(Object.fromEntries(Object.entries(lookups).sort())));
  for (const list of lists) {
    const find = FINDERS[list.id];
    if (!find) { console.log(`No lookup source for ${list.id}`); continue; }
    const file = path.join(dataDir, `${list.id}.json`);
    const items = JSON.parse(await readFile(file, 'utf8'));
    const todo = items.filter(item => { const key = lookupKey(list.id, item); return !(key in lookups) || (retry && !lookups[key]); });
    console.log(`${list.id}: looking up ${todo.length} of ${items.length}`);
    let next = 0, failed = 0;
    await Promise.all(Array.from({ length: LIMITS[list.id] }, async () => {
      while (next < todo.length) {
        const item = todo[next++];
        try { lookups[lookupKey(list.id, item)] = await find(item); }
        catch (error) { failed++; console.warn(error.message); }
        if (Date.now() - saved > 30000) { saved = Date.now(); await save(); }
      }
    }));
    const details = DETAILS[list.id];
    if (details) {
      const needs = NEEDS[list.id] || (() => true), key = item => detailsKey(list.id, item);
      const rest = list.id === 'films'
        ? items.filter(item => !(key(item) in lookups) || needs(item, lookups) || (retry && !lookups[key(item)]))
        : items.filter(item => needs(item, lookups) && (!(key(item) in lookups) || (retry && !lookups[key(item)])));
      console.log(`${list.id}: fetching details for ${rest.length}`);
      for (const item of rest) {
        try { lookups[detailsKey(list.id, item)] = await details(item, lookups); }
        catch (error) { failed++; console.warn(error.message); }
        if (Date.now() - saved > 30000) { saved = Date.now(); await save(); }
      }
    }
    await writeFile(file, JSON.stringify(applyLookups(list.id, items, lookups)));
    const found = items.filter(item => item.l).length, covers = items.filter(item => item.i).length;
    console.log(`${list.id}: ${found} linked, ${covers} with covers, ${failed} requests failed`);
  }
  await save();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
