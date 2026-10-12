# Anti-library

Jason's anti-library: big, organized lists of the books, films, TV and albums he hasn't gotten to yet (after Umberto Eco's unread library, as Nassim Taleb tells it), plus what he has already read, watched or heard that shaped him. The long lists are the horizon; a small core shelf of books is the Senecan counterweight, the few to reread for life. This repository holds the lists and the data pipeline. The page that shows them lives in the portfolio site at [jasonfricano.com/antilibrary](https://jasonfricano.com/antilibrary/) ([jfricano/personal-portfolio](https://github.com/jfricano/personal-portfolio), `site/antilibrary/`).

This repository is public, and has to stay public for the page to read it. Digests (long private write-ups of single titles) live in a separate private repository and never come here.

## Layout

- `lists/`: the source lists, edited by hand. `anti-library.json` (books), `movies.csv` (films), `tv.csv` (TV), `music.csv` (albums). Columns and conventions are in [docs/lists.md](docs/lists.md).
- `lists/threads/<list>.json`: threads, about fifteen named paths per list through titles already on it (books, films and albums so far). See [Threads](#threads).
- `lists/artist-paths.json`: listening orders for the artists on the albums list. Format in [docs/artist-paths.md](docs/artist-paths.md).
- `data/`: generated JSON the page reads: `lists.json` (the lists, their flags and threads), `<list>.json`, `paths.json` (artist paths) and the lookup cache `lookups.json`. Don't edit it by hand. `progress.json`, `removed.json` and `tags.json` are written only by the Progress workflow from owner-mode issues.
- `scripts/import.mjs`: normalizes `lists/` into `data/<list>.json`, `data/lists.json` and `data/paths.json`.
- `scripts/lookup.mjs`: finds a public page, cover and (for albums) genres for each title and artist-path record, cached in `data/lookups.json`.
- `scripts/progress.mjs`: applies owner-mode marks to `data/progress.json`, removals to `data/removed.json` and tag toggles to `data/tags.json`.
- `docs/`: the list conventions, artist paths, the reading path, the book digest format, the roadmap, the [guide for the Anti-Library Builder](docs/BUILDER-GUIDE.md), and `research/` (the proposal passes, cuts, archive, design review and list sources behind the lists).

## Changing a list

Additions and edits to the lists happen here, never from the page. Edit files in `lists/` on a branch off `main` and open a pull request with `lists/` changes only; Jason merges. The **Rebuild data** workflow runs only on `main` (a rebuild on a PR branch would conflict with `main`'s data): after a merge it runs the importer and the lookups and commits the new `data/` to `main`. The workflow commits the imported lists before the lookups start, so new titles and artist paths show up at once; their covers follow in a later commit, which can take a while because MusicBrainz allows one request a second. To run it yourself:

```sh
npm run import    # lists/ -> data/
npm run lookup    # links and covers for new titles (needs open network access)
```

Each list is one entry in `LISTS` at the top of `scripts/import.mjs` (source file, column names, flags). A new list is one more entry there; the page picks it up from `lists.json`.

Every list has a primary source and at least one fallback, all keyless public APIs:

| List | Primary | Fallback |
| --- | --- | --- |
| Books | Goodreads link (its ID from Open Library, or from Wikidata for a book matched on Wikipedia); cover from Open Library | Wikipedia, then Google Books for a missing cover; a Goodreads search when there is no Goodreads page |
| Films | IMDb link (via Wikidata) and TMDB poster. A match has to name the film's director as well as its title; a short list of IMDb IDs checked by hand covers films the search gets wrong | OMDb poster, then Wikipedia and iTunes |
| TV | Wikipedia (link and image) | iTunes for a missing image |
| Albums | MusicBrainz (Discogs link and genres) with Deezer and Wikipedia artwork | Cover Art Archive for missing artwork |
| Music links | AllMusic (artist discography or album page, via the AllMusic IDs on Wikidata), except where Discogs matched an album | AllMusic search |

A title with no match at all links to a search on the list's site instead. The page never links to Rate Your Music (the lookup cache may still hold the address MusicBrainz returns, but nothing shows it).

Film posters from TMDB and OMDb need free API keys, stored as the repository secrets `TMDB_API_KEY` (TMDB's API read access token) and `OMDB_API_KEY`. Without them the workflow still runs and uses the keyless sources. An optional `GOOGLE_BOOKS_API_KEY` secret gives Google Books, the last-resort book cover source, its own quota; keyless calls from GitHub's runners are usually rate-limited, so without it the workflow skips Google Books once it refuses three titles in a row. Keys stay in GitHub Actions; the page never sees them. Run the workflow by hand with **retry** to re-check titles that had no match. A run checks out the branch head and resumes from the last run's lookups, so pushing during a run is safe, and a cancelled run keeps what it found.

## Shelves

Each list is organized into numbered shelves, starting from zero: books open with "00. The Anti-Library's Own Charter", films with "00. Start Here: The Vonnegut Frequency", albums with "00. Start here: the bridge" and TV with "0. The Core". On the page, shelves start folded, so a list opens as its table of contents. Shelves belong to one list; the cross-list shelves the lists once had (writing about music, writing about TV) were dissolved on 2026-10-12, and the soundtrack cabinet stayed on as an albums shelf. Books are also grouped into parts, from a prologue on reading and not reading to "VI. The Other Canon", the famous titles kept at arm's length.

## Threads

A thread is a named path through titles already on one list, in order, with a line on why each stop comes where it does ("who learned from whom"). Each `lists/threads/<list>.json` is an array of `{id, name, why, items: [{t, c, step}]}` in path order; `t` and `c` must match the list's title and creator exactly. The importer tags each stop with `th: {<thread id>: [position, step]}` and lists the threads (with stop counts) in `lists.json`; stops that match no title are reported and skipped. On the page, the Thread menu shows one thread's titles in path order with each stop's line. Threads only ever point at titles; adding a thread never adds a title.

## Artist paths

Rows on the albums list marked "Artist path" (shelf 01, "Artists to go deep on") get a page each with a suggested listening order: a door record, then the records that make the study complete, with the minor ones shown on a timeline as skipped. The records on each path's main line are also rows on the albums list, right after the artist's row; the importer adds them, so `music.csv` doesn't list them. Not every artist on the list gets a path. The orders live in `lists/artist-paths.json` and are drafts that keep being filled in. See [docs/artist-paths.md](docs/artist-paths.md).

## How the page reads this

The portfolio page fetches `data/*.json` from `https://raw.githubusercontent.com/jfricano/anti-lib/main/data/` when it loads, so whatever is on `main` here is what the page shows, a few minutes after it lands (GitHub caches raw files for about five minutes). Changing a list never needs a portfolio deploy. Data on other branches isn't shown until it merges.

## Owner mode

Owner mode on the page (`/antilibrary/?owner=on`, not linked anywhere) lets Jason mark and remove titles that are already on the lists. It never adds titles; those come through a pull request here. Changes wait in his browser until he sends them, which opens a prefilled issue in this repository titled "Anti-library: update N titles". When Jason opens it, the **Progress** workflow applies it on `main` and closes the issue. Issues from anyone else are ignored, and the page holds no credentials.

What owner mode can change:

- **Fully read, Fully watched or Fully heard** (the wording follows the list) crosses a title off. Crossed-off is the only progress the public ever sees. Dates go to `data/progress.json`, keyed `"<title>|<creator>"`.
- **Digested** shows on titles that have a digest, when the browser also holds the digests key. It and the fully-read mark on those titles are kept in the private digests repository, not here; a book comes off the public list when it is digested or fully read, while a film, show or album comes off only when it is fully watched or heard, since a digest doesn't stand in for it.
- **Formative**, the one flag marked `ownerToggle` in `scripts/import.mjs`, is a checkbox on each book. The workflow records each change in `data/tags.json` and the importer applies it over the source list. Every other tag is edited in the source lists. (There is no "Reading now" mark any more; it was dropped on 2026-10-12.)
- **Remove** records the title in `data/removed.json` with the date and rebuilds the lists without it. The importer keeps leaving it out even if a working copy of a list still has it; deleting its line from `removed.json` brings it back.
- **Heard on artist paths.** Each album on an artist's path page has a Heard box. It is the same mark as Fully heard on that album's row in the list, and lands in `progress.json` under `albums`. The artist's own row counts as fully heard once every album on the path's main line is heard, and can't be ticked by itself.
