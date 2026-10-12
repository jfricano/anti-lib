# Artist paths

Each "Artist path" row on the albums list (section 01, "Artists to go deep on") can have its own page with a
suggested listening order. The orders live in `lists/artist-paths.json`; the importer checks them and writes
`data/paths.json`, which the page at jasonfricano.com/antilibrary/artist.html reads.

A path starts at a door (the record most likely to make the artist click), then walks through the records that
make the study feel complete. It is not the full discography. The other records still appear in the timeline,
marked as skipped, so it's clear what was left out and why.

The records with a step are also rows on the albums list, placed right after the artist's path row (the importer adds
them; music.csv doesn't need them). An album already on the list stays where it is. Ticking a record as heard on
either page is the same mark, and the artist's path row counts as fully heard once every step is ticked. A path whose
artist has no row on the list gets one at the end of section 01.

## Format

`lists/artist-paths.json` is one object keyed by artist name, spelled exactly as in the music.csv `artist`
column (for example `"Bill Callahan / Smog"`). Artists play in the order they appear in the file.

```json
{
  "Animal Collective": {
    "about": "One or two sentences on what the path is for.",
    "names": ["Animal Collective", "Panda Bear"],
    "records": [
      { "t": "Here Comes the Indian", "y": 2003, "step": 6, "note": "Why it comes at this point." },
      { "t": "Person Pitch", "y": 2007, "by": "Panda Bear", "kind": "solo", "step": 5, "note": "..." },
      { "t": "Centipede Hz", "y": 2012, "note": "Why it was skipped." },
      { "t": "Merriweather Post Pavilion", "y": 2009, "step": 1, "heard": true, "note": "..." }
    ]
  }
}
```

- `about`: optional. One or two sentences in my voice.
- `names`: optional. Credits on other album rows that should link to this page. Defaults to the key, split on
  " / " (so "Lou Reed / The Velvet Underground" covers both).
- `records`: every studio album worth knowing about, plus the live records, compilations, EPs and side projects
  that matter. Order in the file doesn't matter; the page sorts by year.
  - `t` title and `y` year of first release (required).
  - `step`: the record's place in the listening order. Step 1 is the door. Steps run 1, 2, 3... with no gaps.
    A record with no step is a minor one, shown in the timeline as skipped.
  - `note`: one or two sentences. For a step, why it comes here; for a skipped record, why it can wait.
  - `by`: the credit when it isn't the artist (a solo record, an earlier band, a collaboration).
  - `kind`: optional label: `live`, `compilation`, `EP`, `solo`, `side project`, `collaboration`, `soundtrack`.
  - `heard`: true for records I already know.

Notes follow the list's voice: plain sentences, first person only where it's mine ("I know this one"), no
em dashes, and no Rate Your Music links. Keep the door and path named in the music.csv row; extra steps can follow
them.
