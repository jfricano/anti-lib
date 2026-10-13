# The lists

The four source lists in `lists/`, what their columns mean, and the conventions their notes follow. The importer (`scripts/import.mjs`, the `LISTS` table) is the authority on which column feeds which field on the page; this page explains them.

## Conventions for every list

- **Voice.** Notes are in my first person ("my shelf", "I know the early records"). Plain full sentences, no em dashes.
- **Shelves.** Numbered from zero (`00.` or `0.`), each belonging to one list. The first shelf is the way in ("Start Here", "The Core", "the bridge"). No shelf spans two lists.
- **Scope.** The lists are mostly the frontier, but they also hold what I've already read, watched or heard, marked as such, so the edge is drawn against what I know.
- **Style axis.** Where a work sits between lean (Hemingway's omissions, Camus, Carver) and maximal (Joyce, Pynchon, Infinite Jest): `lean`, `maximal`, `middle` or a short phrase.
- **Shelf neighbor.** A work I already own or have seen that this one argues with or completes.
- **Respectful fringe.** A tag for heterodox or consciousness-first work, shelved beside the skeptics on its own terms without the list taking a side.
- **Links.** Books link to Goodreads, films to IMDb, music to AllMusic or Discogs, TV to Wikipedia. Never Rate Your Music.
- **Title and creator are the key.** `"<title>|<creator>"` connects a row to its marks, threads, removals and digests, so changing either one detaches them. Fix a typo in all of those places together.
- **Additions come through a pull request** that changes `lists/` only. Owner mode on the page never adds titles.

## Books: `anti-library.json`

An array of objects.

| Field | Meaning |
| --- | --- |
| `part` | Part of the list, from "Prologue: Reading and Not Reading" to "VI. The Other Canon" |
| `section` | Numbered shelf, for example "01. The Vonnegut Frequency" |
| `title`, `author` | The key |
| `hook` | One-line note in my voice |
| `status` | `Anti-library`, `Read`, `Digested` or `Formative`. Read, Digested and Formative count as done; Formative can also be switched in owner mode. |
| `core` | One of the twelve on the core shelf, the rereads for life. The core shelf is meant to stay small. |
| `owned`, `shelf` | On my shelf, and where: `["Apple Books", "Physical"]` |
| `star` | Vonnegut frequency: close to Slaughterhouse-Five in feel |
| `fringe` | Respectful fringe |
| `axis`, `neighbor` | Style axis and shelf neighbor |
| `added`, `from_section` | When a title joined, and the shelf it moved from after a reshuffle |

## Films: `movies.csv`

`shelf, section, title, year, director, start_here, note, watched, shelf_neighbor, tag`

- `section` is a sub-shelf within a shelf. `director` is the creator, and the lookup checks it when matching IMDb.
- `start_here` (`yes`) is a private flag, shown only in owner mode.
- `watched` (`yes`) marks a film as seen in the source; owner-mode marks go to `data/progress.json` instead.
- `tag` is `respectful fringe` or empty.
- Director paths (`lists/director-paths.json`, [director-paths.md](director-paths.md)) point at films here; there is no director row. Every film on a path's main line is an ordinary row, filed once on its proper shelf, and its `watched` mark is what counts on the path page too.

## TV: `tv.csv`

`shelf, section, title, year, run, creator, network, start_here, note, watched, axis, move, neighbor, tags, hours, watch`

- `run` and `network` lead the note on the page, since they have no column of their own.
- `watched` follows my own meaning of "seen": involved enough to feel and understand a show, not necessarily finished.
- `move` is the show's signature technique in a line. `hours` is the rough time to watch, and `watch` says how much (`all`, `episodes`, `seasons 1–3`).
- `tags` is `Respectful Fringe` or empty.

## Albums: `music.csv`

`part, section, subsection, artist, album, year, start_here, status, tag, neighbor, note`

- `status` is `heard` for records I know.
- `tag` groups records across shelves: `far shelf`, `literary`, `soundtrack` and others.
- Every album on an artist path's main line is an ordinary row here, filed once on its proper shelf (usually the canon by decade), and its `status` is what counts as heard on the path page too. There are no rows for the paths themselves.

## Paths are an aside

Artist paths (albums), author paths (books) and director paths (films) follow one rule. TV has no paths, by design. A path is an order through titles that already live on their own shelves, so it is never a shelf, never takes a shelf number and never has a row on the list. Its data lives only in `lists/<kind>-paths.json` (`artist-paths.json`, `author-paths.json`, `director-paths.json`), and every step must be a row on the list, which the importer checks. On the page, each list with paths shows them in one unnumbered "Paths" aside above its numbered shelves, folded like a shelf: a line on what paths are, a link to the index page, and every name with a path, struck through once that path is fully done. Each title by a path's artist, author or director links to the path under the name. The albums shelf "01. Artists to go deep on", which held 61 artist path rows, was removed on 2026-10-12 for this, and the albums shelves after it moved up one number (now 00 to 09).

## Threads

`lists/threads/<list>.json` holds about fifteen threads per list (books, films and albums so far): `{id, name, why, items: [{t, c, step}]}`, where `t` and `c` match the list exactly and `step` says why the stop comes where it does. A thread stays inside its list and only points at titles already there.
