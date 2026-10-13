# Author paths

Some authors on the books list have their own page with a suggested reading order. The orders live in
`lists/author-paths.json`; the importer checks them and writes `data/author-paths.json`, which the page at
jasonfricano.com/antilibrary/author.html reads. They work like [artist paths](artist-paths.md).

A path starts at a door (the book most likely to make the author click, or the one I came in through), then walks
through the books that make the study feel complete. It is not the full bibliography. The other books still appear in
the timeline, marked as skipped, so it's clear what was left out and why.

A path doesn't hold its own copies of books. Each step points at the book's row in `anti-library.json`, filed once on
its proper shelf. Add the book there first; a step that isn't on the list fails the rebuild. There is no author row:
every book by a path author gets an "Author path" button under the author's name on the list. Read lives on the book's
row, so a step counts once its book is crossed off on the list (fully read or digested), and the author counts as fully
read once every step is. Author path pages have no checkboxes; books are marked on the books list. Books off the path
don't count toward fully read, even when they're on the list.

## Format

`lists/author-paths.json` is one object keyed by author, spelled exactly as in the `author` field of
`anti-library.json`. Authors play in the order they appear in the file.

```json
{
  "Friedrich Nietzsche": {
    "about": "One or two sentences on what the path is for.",
    "names": ["Friedrich Nietzsche", "Friedrich Nietzsche (Kaufmann)"],
    "goodreads": "https://www.goodreads.com/author/show/1938",
    "records": [
      { "t": "Twilight of the Idols", "y": 1889, "in": "Twilight of the Idols / The Anti-Christ", "step": 1, "note": "..." },
      { "t": "Beyond Good and Evil", "y": 1886, "step": 2, "note": "..." },
      { "t": "The Will to Power", "y": 1901, "kind": "notebooks", "note": "Why it can wait." }
    ]
  }
}
```

- `about`: optional. One or two sentences in my voice.
- `names`: optional. Author credits on book rows that belong to this path (an edited collection, a co-author). Defaults
  to the key. Every book with one of these credits gets the Author path button.
- `goodreads`: the author's Goodreads page. The author's name at the top of the path page links there, in a new tab.
- `photo`: optional. The author's photo beside the name at the top of the path page: the file name of an openly
  licensed picture on Wikimedia Commons, like `"photo": { "file": "Some photo.jpg" }`. Add `"pos": "50% 20%"` to move the
  crop when the page trims the picture. Without it, the rebuild uses the picture Wikidata keeps for the author's Wikipedia
  page, if any; `"photo": false` means no photo. The rebuild saves it once to `data/photos/` at up to 1280 by 1000 pixels and the
  page credits its author and license, linked to its Commons page. Add `"by"` to word that credit by hand.
- `records`: every book worth knowing about. Order in the file doesn't matter; the page sorts by year.
  - `t` title and `y` year of first publication (required).
  - `step`: the book's place in the reading order. Step 1 is the door. Steps run 1, 2, 3... with no gaps. A book with
    no step is shown in the timeline as skipped.
  - `in`: for a step that is a work read inside a book on the list (an essay in a collection, a novel in a Portable),
    the title of that book. The step then shares that book's row, link, cover and read mark.
  - `note`: one or two sentences. For a step, why it comes here; for a skipped book, why it can wait.
  - `kind`: optional label: `stories`, `essays`, `poems`, `play`, `letters`, `notebooks`, `posthumous`, `unfinished`.
  - `read`: true for a skipped book that isn't on the list and that I've already read.

Notes follow the list's voice: plain sentences, first person only where it's mine ("on my shelf"), and no em dashes.
A skipped book that is also on the list is linked to its row, so its read state and link follow the list.

## The paths

Ten authors, chosen for how I read: Vonnegut first, then the philosophers of the absurd and of perspective
(Nietzsche, Dostoevsky, Camus, Kafka), the reality-tunnel writers (Robert Anton Wilson, Philip K. Dick), the
maximalists (Pynchon, David Foster Wallace) and Bukowski for the poems.
