// Copies every cover the lists use into the cover store on Railway (server/): the original file, and a 256px-wide
// WebP thumbnail that the page shows. Only covers the store doesn't have yet are downloaded, so after the first run
// this takes seconds. Each file is named by shortKey(source URL), the same code the page computes, so the page needs
// no extra data to find a cover's copy.
//
//   STORE_URL=https://... STORE_WRITE_KEY=... node scripts/store.mjs [--limit N]
//
// Needs sharp (`npm install --no-save sharp@0.35.5`). Without STORE_URL it explains and does nothing.
import { appendFileSync, readFileSync } from 'node:fs';
import { shortKey } from './short-key.mjs';

const BASE = (process.env.STORE_URL || '').replace(/\/+$/, '');
const KEY = process.env.STORE_WRITE_KEY || '';
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity;
const FILES = ['books', 'films', 'albums', 'tv', 'paths', 'author-paths', 'director-paths'];
const WIDTH = 256;
const MAX_BYTES = 20 * 1024 * 1024;
const AGENT = 'anti-lib cover store (https://jasonfricano.com/antilibrary; github.com/jfricano/anti-lib)';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

if (!BASE || !KEY) {
  console.log('STORE_URL or STORE_WRITE_KEY is not set, so there is no cover store to fill yet.');
  process.exit(0);
}
const { default: sharp } = await import('sharp');

// Every cover URL in the built data: list rows and path steps keep theirs in "i".
function covers() {
  const urls = new Set();
  const walk = v => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) k === 'i' && typeof x === 'string' ? /^https:\/\//.test(x) && urls.add(x) : walk(x);
  };
  for (const f of FILES) walk(JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), 'utf8')));
  return [...urls];
}

async function put(name, body, type) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}/${name}`, { method: 'PUT', body, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': type } })
      .catch(() => ({ ok: false, status: 503 }));
    if (res.ok) return;
    // A sleeping store can answer its first request with a 502 while it wakes up.
    if (attempt >= 4 || res.status < 500) throw Object.assign(Error(`store said ${res.status} for ${name}`), { store: true });
    await new Promise(r => setTimeout(r, 3000 * attempt));
  }
}

async function copy(url) {
  const code = shortKey(url);
  const res = await fetch(url, { headers: { 'User-Agent': AGENT }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw Error(`source said ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const original = Buffer.from(await res.arrayBuffer());
  if (original.length > MAX_BYTES) throw Error(`source file is ${(original.length / 1e6).toFixed(1)} MB`);
  // Trust the file's own format over the header (some hosts send octet-stream).
  const format = (await sharp(original).metadata()).format;
  const ext = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' }[format] || EXT[type];
  if (!ext) throw Error(`not an image (${type || 'no type'})`);
  const thumb = await sharp(original, { animated: false }).rotate().resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: 78 }).toBuffer();
  await put(`o/${code}.${ext}`, original, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  // The thumbnail goes last: the page looks only for c/, so a cover counts as stored once its thumbnail is there.
  await put(`c/${code}.webp`, thumb, 'image/webp');
  return { original: original.length, thumb: thumb.length };
}

async function stored() {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}/files.json`).catch(() => null);
    if (res?.ok) return new Set((await res.json()).c);
    if (attempt >= 5) throw Error(`The store at ${BASE} did not answer (${res ? res.status : 'no response'}).`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
}

const all = covers();
const have = await stored();
const absent = all.filter(u => !have.has(`${shortKey(u)}.webp`));
const missing = absent.slice(0, LIMIT);
console.log(`${all.length} covers in the lists, ${all.length - absent.length} already stored, copying ${missing.length}.`);

// A few at a time from each host, so no image host sees more than a gentle trickle.
const failed = [];
let storeErrors = 0, done = 0, bytes = { original: 0, thumb: 0 };
const queue = [...missing];
async function worker() {
  for (let url; (url = queue.shift()); ) {
    try {
      const size = await copy(url);
      bytes.original += size.original; bytes.thumb += size.thumb;
    } catch (err) {
      failed.push(`${url}: ${err.message}`);
      if (err.store) storeErrors++;
    }
    if (++done % 100 === 0) console.log(`  ${done} of ${missing.length}`);
    await new Promise(r => setTimeout(r, 250));
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const mb = n => (n / 1e6).toFixed(1);
const summary = [
  `Copied ${missing.length - failed.length} of ${missing.length} missing covers (${mb(bytes.original)} MB of originals, ${mb(bytes.thumb)} MB of thumbnails).`,
  ...(failed.length ? [`${failed.length} could not be copied; the page keeps loading those from their original host:`, ...failed.slice(0, 50).map(f => `- ${f}`)] : []),
];
console.log(summary.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
// A source that's down or a stale link is expected and only reported; the store refusing uploads is a real error.
if (storeErrors) process.exit(1);
