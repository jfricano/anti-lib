// Applies the marks in an anti-library issue body to data/progress.json.
// The page writes the marks as a ```json block: { "<list id>": { "<title>|<creator>": "YYYY-MM-DD", null or "remove" } }.
// "remove" records the title in data/removed.json (with the date) and the importer leaves it out from then on.
// An optional "tags" entry switches owner-toggle flags: { "tags": { "<list id>": { "<title>|<creator>": { "<flag>": true or false } } } },
// recorded in data/tags.json, which the importer applies over the source lists.
// A batch sent as one prefilled link comes compact instead, naming titles by short code (scripts/short-key.mjs):
// { "v": 2, "m": { "<list id>": { "<value>": "<codes>" } }, "t": { "<list id>": { "<flag>": { "1" or "0": "<codes>" } } } },
// where a value is a date, "remove" or "null"; it is expanded against data/<list id>.json before applying.
// Usage: ISSUE_BODY=... node scripts/progress.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath as toPath } from 'node:url';
import { expandCodes, shortKey } from './short-key.mjs';
const root = toPath(new URL('../', import.meta.url));

const dataDir = path.join(root, 'data');
const file = path.join(dataDir, 'progress.json');
const block = /```json\s*([\s\S]*?)```/.exec(process.env.ISSUE_BODY || '');
if (!block) throw Error('The issue has no ```json block of marks.');
let marks = JSON.parse(block[1]);
const manifest = JSON.parse(await readFile(path.join(dataDir, 'lists.json'), 'utf8'));
const lists = new Set(manifest.map(list => list.id));
const toggles = Object.fromEntries(manifest.map(list => [list.id, new Set(list.toggles || [])]));
if (marks.v === 2) marks = await expandCompact(marks);
async function expandCompact({ m = {}, t = {} }) {
  const codes = {};
  const keysFor = async listId => {
    if (!lists.has(listId)) throw Error(`Unknown list ${JSON.stringify(listId)}`);
    const items = codes[listId] ? [] : JSON.parse(await readFile(path.join(dataDir, `${listId}.json`), 'utf8'));
    codes[listId] ??= new Map(items.map(i => [shortKey(`${i.t}|${i.c || ''}`), `${i.t}|${i.c || ''}`]));
    return codes[listId];
  };
  const out = {};
  for (const [listId, groups] of Object.entries(m)) {
    const keys = await keysFor(listId);
    for (const [value, run] of Object.entries(groups)) for (const key of expandCodes(run, keys, listId)) (out[listId] ??= {})[key] = value === 'null' ? null : value;
  }
  for (const [listId, flags] of Object.entries(t)) {
    const keys = await keysFor(listId);
    for (const [flag, groups] of Object.entries(flags)) {
      for (const [on, run] of Object.entries(groups)) for (const key of expandCodes(run, keys, listId)) (((out.tags ??= {})[listId] ??= {})[key] ??= {})[flag] = on === '1';
    }
  }
  return out;
}
const removedFile = path.join(dataDir, 'removed.json'), tagsFile = path.join(dataDir, 'tags.json');
let progress = {}, removed = {}, tags = {};
try { progress = JSON.parse(await readFile(file, 'utf8')); } catch {}
try { removed = JSON.parse(await readFile(removedFile, 'utf8')); } catch {}
try { tags = JSON.parse(await readFile(tagsFile, 'utf8')); } catch {}
const badKey = key => typeof key !== 'string' || key.length > 400 || !key.includes('|');
const today = new Date().toISOString().slice(0, 10);

let changed = 0;
const { tags: tagMarks = {}, ...doneMarks } = marks;
for (const [listId, entries] of Object.entries(tagMarks)) {
  if (!lists.has(listId) || typeof entries !== 'object' || !entries) throw Error(`Unknown list ${JSON.stringify(listId)}`);
  for (const [key, flags] of Object.entries(entries)) {
    if (badKey(key) || typeof flags !== 'object' || !flags) throw Error(`Bad title key ${JSON.stringify(key)}`);
    for (const [flag, on] of Object.entries(flags)) {
      if (!toggles[listId].has(flag) || typeof on !== 'boolean') throw Error(`Bad tag ${JSON.stringify(flag)} for ${key}`);
      ((tags[listId] ??= {})[key] ??= {})[flag] = on;
      changed++;
    }
  }
}
for (const [listId, entries] of Object.entries(doneMarks)) {
  if (!lists.has(listId) || typeof entries !== 'object' || !entries) throw Error(`Unknown list ${JSON.stringify(listId)}`);
  for (const [key, value] of Object.entries(entries)) {
    if (badKey(key)) throw Error(`Bad title key ${JSON.stringify(key)}`);
    if (value === 'remove') {
      removed[listId] ??= {};
      removed[listId][key] = today;
      delete progress[listId]?.[key];
      delete tags[listId]?.[key];
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
if (Object.keys(tags).length) await writeFile(tagsFile, JSON.stringify(sorted(tags), null, 1) + '\n');
console.log(`Applied ${changed} marks`);
