# Director paths

Some directors on the films list have their own page with a suggested viewing order. The orders live in
`lists/director-paths.json`; the importer checks them and writes `data/director-paths.json`, which the page at
jasonfricano.com/antilibrary/director.html reads. They work like [author paths](author-paths.md), which work like
[artist paths](artist-paths.md).

A path starts at a door (the film most likely to make the director click), then walks through the films that make the
study feel complete. It is not the full filmography. The other films still appear in the timeline, marked as skipped,
so it's clear what was left out and why.

A path doesn't hold its own copies of films. Each step points at the film's row in `movies.csv`, filed once on its
proper shelf. Add the film there first; a step that isn't on the list fails the rebuild. There is no director row:
every film by a path director gets a "Director path" button under the director's name on the list. Watched lives on the
film's row, so a step counts once its film is crossed off on the list (fully watched), and the director counts as fully
watched once every step is. That can't be ticked by itself, and director path pages have no checkboxes; films are
marked on the films list. Films off the path don't count, even when they're on the list.

## Format

`lists/director-paths.json` is one object keyed by director, spelled exactly as in the `director` column of
`movies.csv` (for example `"Joel & Ethan Coen"`). Directors play in the order they appear in the file.

```json
{
  "Quentin Tarantino": {
    "about": "One or two sentences on what the path is for.",
    "imdb": "https://www.imdb.com/name/nm0000233/",
    "records": [
      { "t": "Pulp Fiction", "y": 1994, "step": 1, "note": "Why it's the door." },
      { "t": "Reservoir Dogs", "y": 1992, "step": 2, "note": "Why it comes here." },
      { "t": "Four Rooms", "y": 1995, "by": "Anders, Rockwell, Rodriguez & Tarantino", "kind": "anthology", "note": "Why it can wait." }
    ]
  }
}
```

- `about`: optional. One or two sentences in my voice.
- `imdb`: the director's IMDb page. The name at the top of the path page links there, in a new tab. Where there's no
  single page (the Coens), an IMDb name search.
- `names`: optional. Other director credits on film rows that belong to this path. Defaults to the key. Every film with
  one of these credits gets the Director path button.
- `records`: every feature worth knowing about, plus the documentaries and shorts that matter. Order in the file doesn't
  matter; the page sorts by year.
  - `t` title and `y` year of release (required), spelled as on the list when the film is on it.
  - `step`: the film's place in the viewing order. Step 1 is the door. Steps run 1, 2, 3... with no gaps. A film with no
    step is shown in the timeline as skipped.
  - `note`: one or two sentences. For a step, why it comes here; for a skipped film, why it can wait.
  - `by`: the credit when it isn't the director alone (an anthology, a co-director, one brother on his own). A skipped
    film with a `by` credit that is on the list is linked to that row.
  - `kind`: optional label: `documentary`, `short`, `anthology`, `solo`, `collaboration`, `guest director`.
  - `watched`: true for a skipped film that isn't on the list and that I've already seen. A skipped film that
    is on the list is linked to its row, so its watched state and link follow the list.

Notes follow the list's voice: plain sentences, first person only where it's mine ("one I know"), and no em dashes.

## The paths

Eighteen directors, chosen for how I watch: the ones I named first (Tarantino, Scorsese, Spielberg, Nolan,
Tarkovsky), then Kubrick, the Coens, Wes Anderson, Paul Thomas Anderson, Herzog, Lynch, Linklater, Jarmusch and Fincher
for the American and stylized side, Kurosawa for the samurai films everyone borrowed from, and Bong Joon-ho and Park
Chan-wook for Korea.

Tarantino's order is mine: Pulp Fiction, Reservoir Dogs, then the rest as he made them. I've seen all of his, so every
step is marked watched. Twenty films were added to `movies.csv` for the paths: six Tarantino films, six Spielberg
films, The Dark Knight, Moonrise Kingdom, Punch-Drunk Love, The Host, Snowpiercer, Joint Security Area, Sympathy for
Mr. Vengeance and Decision to Leave.
