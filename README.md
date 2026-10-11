# Anti-library

Jason's anti-library: the books, films, TV and albums he hasn't gotten to yet (after Umberto Eco's unread library, as Nassim Taleb tells it). This repository holds the lists and the data pipeline. The page that shows them lives in the portfolio site at [jasonfricano.com/antilibrary](https://jasonfricano.com/antilibrary/) ([jfricano/personal-portfolio](https://github.com/jfricano/personal-portfolio), `site/antilibrary/`).

## Layout

- `lists/`: the source lists, edited by hand. `anti-library.json` (books), `movies.csv` (films), `tv.csv` (TV), `music.csv` (albums).
- `data/`: generated JSON the page reads. Don't edit it, except `progress.json` through owner mode.
- `scripts/import.mjs`: normalizes `lists/` into `data/<list>.json` and `data/lists.json`.
- `scripts/lookup.mjs`: finds a public page, cover and (for albums) genres for each title, cached in `data/lookups.json`.
- `scripts/progress.mjs`: applies owner-mode marks to `data/progress.json`.
- `docs/`: the reading path and the digest format.

## Changing a list

Edit a file in `lists/` on a branch and push. The **Rebuild data** workflow runs the importer and the lookups and commits the new `data/` to the same branch. New titles take a while because MusicBrainz allows one request a second. To run it yourself:

```sh
npm run import    # lists/ -> data/
npm run lookup    # links and covers for new titles (needs open network access)
```

Each list is one entry in `LISTS` at the top of `scripts/import.mjs` (source file, column names, flags). A new list is one more entry there; the page picks it up from `lists.json`.

Every list has a primary source and at least one fallback, all keyless public APIs:

| List | Primary | Fallback |
| --- | --- | --- |
| Books | Open Library (link and cover) | Wikipedia, then Google Books for a missing cover |
| Films | Wikipedia (link and poster) | iTunes for a missing poster |
| TV | Wikipedia (link and image) | iTunes for a missing image |
| Albums | MusicBrainz (Discogs link, genres, Rate Your Music) with Deezer and Wikipedia artwork | Cover Art Archive for missing artwork |

A title with no match at all links to a search on the list's site instead. Run the workflow by hand with **retry** to re-check titles that had no match.

## How the page reads this

The portfolio page fetches `data/*.json` from `https://raw.githubusercontent.com/jfricano/anti-lib/main/data/` when it loads, so whatever is on `main` here is what the page shows, a few minutes after it lands (GitHub caches raw files for about five minutes). Changing a list never needs a portfolio deploy. Data on other branches isn't shown until it merges.

This repository has to stay public for that to work.

## Marking titles finished

Owner mode on the page (`/antilibrary/?owner=on`, not linked anywhere) opens a prefilled issue in this repository titled "Anti-library: update N titles". When Jason opens it, the **Progress** workflow applies the marks to `data/progress.json` on `main` and closes the issue. Issues from anyone else are ignored, and the page holds no credentials.
