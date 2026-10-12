// Applies the marks in an anti-library issue body to data/progress.json.
// The page writes the marks as a ```json block: { "<list id>": { "<title>|<creator>": "YYYY-MM-DD", null or "remove" } }.
// "remove" records the title in data/removed.json (with the date) and the importer leaves it out from then on.
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
const removedFile = path.join(dataDir, 'removed.json');
let progress = {}, removed = {};
try { progress = JSON.parse(await readFile(file, 'utf8')); } catch {}
try { removed = JSON.parse(await readFile(removedFile, 'utf8')); } catch {}
const today = new Date().toISOString().slice(0, 10);

let changed = 0;
for (const [listId, entries] of Object.entries(marks)) {
  if (!lists.has(listId) || typeof entries !== 'object' || !entries) throw Error(`Unknown list ${JSON.stringify(listId)}`);
  for (const [key, value] of Object.entries(entries)) {
    if (typeof key !== 'string' || key.length > 400 || !key.includes('|')) throw Error(`Bad title key ${JSON.stringify(key)}`);
    if (value === 'remove') {
      removed[listId] ??= {};
      removed[listId][key] = today;
      delete progress[listId]?.[key];
      changed++;
      continue;
    }
    if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw Error(`Bad date for ${key}`);
    progress[listId] ??= {};
    if (value) progress[listId][key] = value; else delete progress[listId][key];
    changed++;
  }
}
const sorted = data => Object.fromEntries(Object.entries(data).sort().map(([id, entries]) => [id, Object.fromEntries(Object.entries(entries).sort())]));
await writeFile(file, JSON.stringify(sorted(progress), null, 1) + '\n');
if (Object.keys(removed).length) await writeFile(removedFile, JSON.stringify(sorted(removed), null, 1) + '\n');
console.log(`Applied ${changed} marks`);
