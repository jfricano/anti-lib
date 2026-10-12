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

## TV: `tv.csv`

`shelf, section, title, year, run, creator, network, start_here, note, watched, axis, move, neighbor, tags, hours, watch`

- `run` and `network` lead the note on the page, since they have no column of their own.
- `watched` follows my own meaning of "seen": involved enough to feel and understand a show, not necessarily finished.
- `move` is the show's signature technique in a line. `hours` is the rough time to watch, and `watch` says how much (`all`, `episodes`, `seasons 1–3`).
- `tags` is `Respectful Fringe` or empty.

## Albums: `music.csv`

`part, section, subsection, artist, album, year, start_here, status, tag, neighbor, note`

- `status` is `heard` for records I know.
- `tag` groups records across shelves: `artist path`, `far shelf`, `literary`, `soundtrack` and others.
- An artist path row has `album` set to `(artist path)` and names the door and the path in its note. The importer turns it into a row for the artist, followed by a row for each album on the path's main line (those albums aren't listed in `music.csv`). The listening order lives in `lists/artist-paths.json` ([artist-paths.md](artist-paths.md)). Artists without a path just have their key albums as plain rows.

## Threads

`lists/threads/<list>.json` holds about fifteen threads per list (books, films and albums so far): `{id, name, why, items: [{t, c, step}]}`, where `t` and `c` match the list exactly and `step` says why the stop comes where it does. A thread stays inside its list and only points at titles already there.
