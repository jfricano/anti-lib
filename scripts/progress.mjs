// Applies the marks in an anti-library issue body to data/progress.json.
// The page writes the marks as a ```json block: { "<list id>": { "<title>|<creator>": "YYYY-MM-DD" or null } }.
// Usage: ISSUE_BODY=... node scripts/progress.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath as toPath } from 'node:url';
const root = toPath(new URL('../', import.meta.url));

const dataDir = path.join(root, 'data');
const file = path.join(dataDir, 'progress.json');
const block = /```json\s*([\s\S]*?)```/.exec(process.env.ISSUE_BODY || '');
if (!block) throw Error('The issue has no ```json block of marks.');
const marks = JSON.parse(block[1]);
const lists = new Set(JSON.parse(await readFile(path.join(dataDir, 'lists.json'), 'utf8')).map(list => list.id));
let progress = {};
try { progress = JSON.parse(await readFile(file, 'utf8')); } catch {}

let changed = 0;
for (const [listId, entries] of Object.entries(marks)) {
  if (!lists.has(listId) || typeof entries !== 'object' || !entries) throw Error(`Unknown list ${JSON.stringify(listId)}`);
  for (const [key, value] of Object.entries(entries)) {
    if (typeof key !== 'string' || key.length > 400 || !key.includes('|')) throw Error(`Bad title key ${JSON.stringify(key)}`);
    if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw Error(`Bad date for ${key}`);
    progress[listId] ??= {};
    if (value) progress[listId][key] = value; else delete progress[listId][key];
    changed++;
  }
}
const sorted = Object.fromEntries(Object.entries(progress).sort().map(([id, entries]) => [id, Object.fromEntries(Object.entries(entries).sort())]));
await writeFile(file, JSON.stringify(sorted, null, 1) + '\n');
console.log(`Applied ${changed} marks`);
