# Anti-library

Jason's anti-library: big, organized lists of the books, films, TV and albums he hasn't gotten to yet (after Umberto Eco's unread library, as Nassim Taleb tells it), plus what he has already read, watched or heard that shaped him. The long lists are the horizon; a small core shelf of books is the Senecan counterweight, the few to reread for life. This repository holds the lists and the data pipeline. The page that shows them lives in the portfolio site at [jasonfricano.com/antilibrary](https://jasonfricano.com/antilibrary/) ([jfricano/personal-portfolio](https://github.com/jfricano/personal-portfolio), `site/antilibrary/`).

This repository is public, and has to stay public for the page to read it. Digests (long private write-ups of single titles) live in a separate private repository and never come here.

## Layout

- `lists/`: the source lists, edited by hand. `anti-library.json` (books), `movies.csv` (films), `tv.csv` (TV), `music.csv` (albums). Columns and conventions are in [docs/lists.md](docs/lists.md).
- `lists/threads/<list>.json`: threads, about fifteen named paths per list through titles already on it (books, films and albums so far). See [Threads](#threads).
- `lists/artist-paths.json`: listening orders for the artists on the albums list. Format in [docs/artist-paths.md](docs/artist-paths.md).
- `lists/author-paths.json`: reading orders for some of the authors on the books list. Format in [docs/author-paths.md](docs/author-paths.md).
- `lists/director-paths.json`: viewing orders for some of the directors on the films list. Format in [docs/director-paths.md](docs/director-paths.md).
- `data/`: generated JSON the page reads: `lists.json` (the lists, their flags and threads), `<list>.json`, `paths.json` (artist paths), `author-paths.json` (author paths), `director-paths.json` (director paths), `threads.json` (each thread's stops in order, for the thread pages) and the lookup cache `lookups.json`. Don't edit it by hand. `progress.json`, `removed.json` and `tags.json` are written only by the Progress workflow from owner-mode issues.
- `scripts/import.mjs`: normalizes `lists/` into `data/<list>.json`, `data/lists.json`, `data/paths.json`, `data/author-paths.json` and `data/director-paths.json`.
- `scripts/lookup.mjs`: finds a public page, cover and (for albums) genres for each title and artist-path record, cached in `data/lookups.json`.
- `scripts/progress.mjs`: applies owner-mode marks to `data/progress.json`, removals to `data/removed.json` and tag toggles to `data/tags.json`.
- `scripts/store.mjs`: copies every cover into the cover store (see [Cover store](#cover-store)).
- `server/`: the cover store itself, a small file server on Railway. Setup in [server/README.md](server/README.md).
- `docs/`: the list conventions, artist, author and director paths, the reading path, the book digest format, the roadmap, the [guide for the Anti-Library Builder](docs/BUILDER-GUIDE.md), and `research/` (the proposal passes, cuts, archive, design review and list sources behind the lists).

## Changing a list

Additions and edits to the lists happen here, never from the page. Edit files in `lists/` on a branch off `main` and open a pull request with `lists/` changes only; Jason merges. The **Rebuild data** workflow runs only on `main` (a rebuild on a PR branch would conflict with `main`'s data): after a merge it runs the importer and the lookups and commits the new `data/` to `main`. The workflow commits the imported lists before the lookups start, so new titles and paths show up at once; their covers follow in a later commit, which can take a while because MusicBrainz allows one request a second. To run it yourself:

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
| Albums | MusicBrainz (Discogs link and genres) with Deezer and Wikipedia artwork. A match needs the whole title, give or take edition words like *Remastered* or *Deluxe*, so *The Velvet Underground* never takes the cover of *The Velvet Underground & Nico* | Cover Art Archive for missing artwork |
| Music links | AllMusic (artist discography or album page, via the AllMusic IDs on Wikidata), except where Discogs matched an album | AllMusic search |

A title with no match at all links to a search on the list's site instead. The page never links to Rate Your Music (the lookup cache may still hold the address MusicBrainz returns, but nothing shows it).

Film posters from TMDB and OMDb need free API keys, stored as the repository secrets `TMDB_API_KEY` (TMDB's API read access token) and `OMDB_API_KEY`. Without them the workflow still runs and uses the keyless sources. An optional `GOOGLE_BOOKS_API_KEY` secret gives Google Books, the last-resort book cover source, its own quota; keyless calls from GitHub's runners are usually rate-limited, so without it the workflow skips Google Books once it refuses three titles in a row. Keys stay in GitHub Actions; the page never sees them. Run the workflow by hand with **retry** to re-check titles that had no match. A run checks out the branch head and resumes from the last run's lookups, so pushing during a run is safe, and a cancelled run keeps what it found.

## Shelves

Each list is organized into numbered shelves, starting from zero: books open with "00. The Anti-Library's Own Charter", films with "00. Start Here: The Vonnegut Frequency", albums with "00. Start here: the bridge" and TV with "0. The Core". On the page, shelves start folded, so a list opens as its table of contents. Shelves belong to one list; the cross-list shelves the lists once had (writing about music, writing about TV) were dissolved on 2026-10-12, and the soundtrack cabinet stayed on as an albums shelf. Books are also grouped into parts, from a prologue on reading and not reading to "VI. The Other Canon", the famous titles kept at arm's length.

## Threads

A thread is a named path through titles already on one list, in order, with a line on why each stop comes where it does ("who learned from whom"). Each `lists/threads/<list>.json` is an array of `{id, name, why, items: [{t, c, step}]}` in path order; `t` and `c` must match the list's title and creator exactly. The importer tags each stop with `th: {<thread id>: [position, step]}` and lists the threads (with stop counts) in `lists.json`; stops that match no title are reported and skipped. The importer also writes `data/threads.json`, each thread's stops in order with their credit, shelf, link, cover and step line. On the page, every thread in the Threads aside above the shelves opens its own page, `thread.html?list=<list>&t=<thread id>`, the way artist, author and director paths do. Threads only ever point at titles; adding a thread never adds a title.

## Artist paths

Paths are an aside, not a shelf: they have no shelf number and no rows on the lists, and the page shows them in an unnumbered Paths aside above each list's shelves ([docs/lists.md](docs/lists.md#paths-are-an-aside)).

Some artists on the albums list get a page each with a suggested listening order: a door record, then the records that make the study complete, with the minor ones shown on a timeline as skipped. Each record on a path's main line points at an album filed once on its own shelf in `music.csv`; the path never holds a second copy. Not every artist on the list gets a path. The orders live in `lists/artist-paths.json`. See [docs/artist-paths.md](docs/artist-paths.md).

## Author paths

Some authors on the books list get a reading path of their own, built the same way: a door book, then the books that make the study feel complete, with the rest of the bibliography shown on a timeline as skipped. Each step points at a book filed once on its shelf in `anti-library.json` (or, for a work read inside a collection, at that collection). There is no author row; every book by a path author gets an "Author path" button under the author's name, and the page is `author.html?a=<slug>` on the site. Ten authors have one: Vonnegut, Nietzsche, Philip K. Dick, Pynchon, Dostoevsky, Robert Anton Wilson, Camus, Kafka, David Foster Wallace and Bukowski. The orders live in `lists/author-paths.json`. See [docs/author-paths.md](docs/author-paths.md).

## Director paths

Some directors on the films list get a viewing path, built like the author paths: a door film, then the films that make the study feel complete, with the rest of the filmography on a timeline as skipped. Each step points at a film filed once on its shelf in `movies.csv`. There is no director row; every film by a path director gets a "Director path" button under the director's name, and the page is `director.html?a=<slug>` on the site. The director's name on the page links to IMDb. Eighteen directors have one, from Tarantino (in my own order: Pulp Fiction, Reservoir Dogs, then as he made them) and Scorsese to Bong Joon-ho and Park Chan-wook. The orders live in `lists/director-paths.json`. See [docs/director-paths.md](docs/director-paths.md).

## How the page reads this

The portfolio page fetches `data/*.json` from `https://raw.githubusercontent.com/jfricano/anti-lib/main/data/` when it loads, so whatever is on `main` here is what the page shows, a few minutes after it lands (GitHub caches raw files for about five minutes). Changing a list never needs a portfolio deploy. Data on other branches isn't shown until it merges.

## Cover store

Covers are found on outside hosts (Open Library, TMDB, Wikimedia, Deezer, Cover Art Archive, iTunes) and their links are kept in `data/`. The cover store keeps a copy of each: the largest version its host offers (Open Library's large size, TMDB's original poster, Deezer's 1000px, Cover Art Archive's full scan, the Wikimedia file itself, and so on) and a 256px-wide WebP thumbnail made from it, on a small Railway service built from `server/`. After every "Rebuild data" run on `main`, the "Store covers" workflow copies any cover the store doesn't have yet. Each file is named by `shortKey` of its source link (`scripts/short-key.mjs`), the same code the page already computes, so the page finds a cover's copy without any extra data and falls back to the original link if the store doesn't have it or is asleep.

The links in `data/` stay the source of truth: the store only ever holds copies, and can be rebuilt from scratch by running the workflow by hand. Until the `STORE_URL` and `STORE_WRITE_KEY` secrets are set, the workflow does nothing.

## Owner mode

Owner mode on the page (`/antilibrary/?owner=on`, not linked anywhere) lets Jason mark and remove titles that are already on the lists. It never adds titles; those come through a pull request here. Changes wait in his browser until he sends them, which opens a prefilled issue in this repository titled "Anti-library: update N titles". When Jason opens it, the **Progress** workflow applies it on `main` and closes the issue. Issues from anyone else are ignored, and the page holds no credentials.

What owner mode can change:

- **Fully read, Fully watched or Fully heard** (the wording follows the list) crosses a title off. Crossed-off is the only progress the public ever sees. Dates go to `data/progress.json`, keyed `"<title>|<creator>"`.
- **Digested** shows on titles that have a digest, when the browser also holds the digests key. It and the fully-read mark on those titles are kept in the private digests repository, not here; a book comes off the public list when it is digested or fully read, while a film, show or album comes off only when it is fully watched or heard, since a digest doesn't stand in for it.
- **Formative**, the one flag marked `ownerToggle` in `scripts/import.mjs`, is a checkbox on each book. The workflow records each change in `data/tags.json` and the importer applies it over the source list. Every other tag is edited in the source lists. (There is no "Reading now" mark any more; it was dropped on 2026-10-12.)
- **Remove** records the title in `data/removed.json` with the date and rebuilds the lists without it. The importer keeps leaving it out even if a working copy of a list still has it; deleting its line from `removed.json` brings it back.
- **Heard on artist paths.** Each album on an artist's path page has a Heard box. It is the same mark as Fully heard on that album's row in the list, and lands in `progress.json` under `albums`. The artist counts as fully heard once every album on the path's main line is heard (their name is struck through in the Paths aside), and can't be ticked by itself.
- **Read on author paths.** Author path pages have no boxes; books are marked on the books list. A step counts once its book is crossed off there, and the author counts as fully read once every book on the path's main line is. That can't be ticked by itself either.
- **Watched on director paths.** The same as author paths: films are marked on the films list, and the director counts as fully watched once every film on the path's main line is.
