# Research

The working notes behind the lists: the proposal passes that shaped each list, what was cut and why, the design review of the page, and the scripts that first generated the lists. Everything here is a record. The lists themselves live in `lists/`, and that is what the page reads.

Most proposals are written to me in the second person, the way they were drafted, and each file opens with a note on what was applied.

## Books

- [Proposed additions](books/proposed-additions.md): one pass for connections between the shelf and what the list missed. Merged 2026-10-11.
- [Proposed cuts](books/proposed-cuts.md): the critical pass, "one door per author".

## Films

- [Proposed additions](films/proposed-additions.md): the hidden connectors and the holes they point at. Merged 2026-10-11.
- [Proposed cuts](films/proposed-cuts.md)

## TV

- [Proposed additions](tv/proposed-additions.md), including the `hours` and `watch` column proposals.
- [Proposed cuts](tv/proposed-cuts.md): one critical pass over 784 shows.
- [From the movies list](tv/from-movies-list.txt): the series that started out on the film list.

## Music

- [Proposed additions](music/proposed-additions.md)
- [Proposed cuts](music/proposed-cuts.md): the critical pass and the canon cut from 875 albums to 352.
- [Archive](music/archive.md): the 523 albums cut from "The canon by decade", each with its reason. Kept rather than deleted, as the next place to look when an artist or a scene opens up.

## Design review

Screenshots from the page's redesign, in [design-review/](design-review/).

- `old-view-reference.png`: the page before the layout work.
- `before-*` and `after-*`: the header and layout passes, v1 to v4 (v4 approved), at desktop (1440 px) and phone (390 px) widths.
- `filters/`: the Search / Shelf / Show / Sort controls with applied-filter chips, before and after, including owner mode.

## Sources

The scripts and plain-text sources that generated the first versions of the lists, in [sources/](sources/). They ran against the project's working folder (with the lists as Markdown), so their paths assume that layout rather than this repo's.

- `build.py` with `films.txt`: the film list (one line per film, `title | year | director | note | neighbor | tag`, `#` for shelves, `!` for a star pick).
- `music_csv.py`: regenerates `music.csv` from the Markdown music list.
- `tv/gen.py` with `tv_data.txt`, `tv_format.txt` (axis, move, neighbor), `tv_extent.txt` (hours, watch) and `creators.txt`: the TV list.
- `tv/merge_proposals.py`: the one-off merge of the TV additions.
