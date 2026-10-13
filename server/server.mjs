// The anti-library's cover store: a small file server on Railway, shaped like Personal Treasury's private service.
// It serves cover thumbnails (c/) and the original files they were cut from (o/) from a volume, and accepts uploads
// from the "Store covers" workflow, which does all the downloading. The server itself never calls out, so Railway's
// Serverless setting can put it to sleep between visits. See README.md beside this file.
import { timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readdir, rename, stat, unlink } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const DIR = process.env.STORE_DIR || '/data';
const PORT = Number(process.env.PORT) || 8080;
const KEY = process.env.STORE_WRITE_KEY || '';
const MAX_BYTES = 40 * 1024 * 1024;
// Files are named by the page's 8-character code for the cover's source URL (scripts/short-key.mjs).
const NAME = /^[A-Za-z0-9_-]{8}\.(webp|jpg|png|gif)$/;
const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };
const FOLDERS = ['c', 'o'];

const COMMON = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

function send(res, status, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...COMMON,
    'Cache-Control': 'no-store',
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    ...headers,
  });
  res.end(res.req.method === 'HEAD' ? undefined : text);
}

function authorized(req) {
  const given = Buffer.from(req.headers.authorization || '');
  const wanted = Buffer.from(`Bearer ${KEY}`);
  return KEY.length >= 32 && given.length === wanted.length && timingSafeEqual(given, wanted);
}

async function serveFile(req, res, folder, name) {
  const file = path.join(DIR, folder, name);
  let info;
  try { info = await stat(file); } catch { return send(res, 404, 'Not found', { 'Cache-Control': 'public, max-age=300' }); }
  // A name is never reused for different content, so browsers and caches may keep a file for a year.
  res.writeHead(200, {
    ...COMMON,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': TYPES[name.split('.').pop()],
    'Content-Length': info.size,
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// Writes to a temporary file first, so a reader never sees half an image.
async function saveFile(req, res, folder, name) {
  if (!authorized(req)) return send(res, 401, 'Unauthorized');
  if (Number(req.headers['content-length']) > MAX_BYTES) return send(res, 413, 'Too large');
  const file = path.join(DIR, folder, name), temp = `${file}.${process.pid}.${Date.now()}.part`;
  const handle = await open(temp, 'w');
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BYTES) throw Object.assign(Error('Too large'), { status: 413 });
      await handle.write(chunk);
    }
    await handle.close();
    if (!size) throw Object.assign(Error('Empty body'), { status: 400 });
    await rename(temp, file);
  } catch (err) {
    await handle.close().catch(() => {});
    await unlink(temp).catch(() => {});
    return send(res, err.status || 500, err.status ? err.message : 'Could not save');
  }
  send(res, 201, { saved: `${folder}/${name}`, bytes: size });
}

// The names already stored, so the workflow uploads only what's missing.
async function listFiles(res) {
  const out = {};
  for (const folder of FOLDERS) out[folder] = (await readdir(path.join(DIR, folder))).filter(n => NAME.test(n)).sort();
  send(res, 200, out);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://store');
    const [, folder, name, extra] = url.pathname.split('/');
    if (url.pathname === '/healthz') return send(res, 200, { status: 'ok' });
    if (url.pathname === '/files.json' && (req.method === 'GET' || req.method === 'HEAD')) return listFiles(res);
    if (FOLDERS.includes(folder) && NAME.test(name || '') && extra === undefined) {
      if (req.method === 'GET' || req.method === 'HEAD') return serveFile(req, res, folder, name);
      if (req.method === 'PUT') return saveFile(req, res, folder, name);
      return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD, PUT' });
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...COMMON, 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '86400' });
      return res.end();
    }
    send(res, 404, 'Not found');
  } catch {
    if (!res.headersSent) send(res, 500, 'Server error');
    else res.destroy();
  }
});

for (const folder of FOLDERS) await mkdir(path.join(DIR, folder), { recursive: true });
if (KEY.length < 32) console.warn('STORE_WRITE_KEY is missing or shorter than 32 characters, so uploads are turned off.');
server.listen(PORT, '0.0.0.0', () => console.log(`Cover store serving ${DIR} on port ${PORT}`));
