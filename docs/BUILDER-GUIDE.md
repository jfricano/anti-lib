# Guide for the Anti-Library Builder

For whoever builds the Anti-Library Builder (a paid, per-run service that turns someone's taste into their own anti-library) and is reading these repositories for ideas. Written 2026-10-12, when the lists and page described here were live.

The short version: **take the method and the plumbing, never the content.** These repositories are one person's library. Their value to the Builder is in how the lists are shaped, checked, linked and marked. Every title, shelf name, thread, note and taste signal in them is Jason's, and a Builder list that resembles them has failed, even if it looks good.

## Where things are

| Repository | Visibility | What it holds |
| --- | --- | --- |
| [jfricano/anti-lib](https://github.com/jfricano/anti-lib) (this one) | Public | The lists, the importer, the link and cover lookups, the owner-mode workflow, threads, artist, author and director paths, and the research behind the lists (`docs/research/`) |
| [jfricano/personal-portfolio](https://github.com/jfricano/personal-portfolio) | Public | The page: `site/antilibrary/` (list browser, owner mode, XLSX export, artist, author and director path pages) and `site/digests/` (the private digests reader) |
| jfricano/reading-list | Private | Digests and the marks on them. Not readable by the Builder, and nothing from it belongs in the Builder. |

Start with this repository's [README](../README.md), then [lists.md](lists.md) for the fields and conventions, then `site/antilibrary/app.js` in the portfolio for the page.

## What's worth reusing

### The method

- **Organize, don't just generate.** About 1,100 books, 1,300 films, 1,300 albums and 700 shows only became usable once they had numbered shelves (starting from a "start here" shelf at zero), folded by default, with search, sort and filters. Size without shape is a pile.
- **Per-title fields that earned their place** ([lists.md](lists.md)): a one-line note in the owner's first person, a style axis (lean to maximal), a shelf neighbor (a work the person already knows that this one argues with), and a respectful-fringe tag for heterodox or consciousness-first work, shelved beside the skeptics without taking a side.
- **The core shelf.** A deliberately small set (twelve books here) to reread for life, held against the open-ended horizon. The framing (Eco and Taleb's unread library against Seneca's "read few things deeply") is general; the twelve titles are not.
- **Threads.** About fifteen named, ordered paths per list through titles already on it, each stop with a line on why it comes there. They turn a list into routes. Keep each thread inside one list: cross-list shelves were tried here and dissolved because they sprawled.
- **Artist paths.** For music: a door record, then the records that complete the picture, with the skipped ones shown on a timeline and a reason for each ([artist-paths.md](artist-paths.md)). A path is an order through albums filed once on their own shelves, never a second copy of them.
- **Author paths.** The same for books: a door book, then the books that complete the picture, with the rest of the bibliography on a timeline ([author-paths.md](author-paths.md)).
- **Director paths.** The same for films ([director-paths.md](director-paths.md)).
- **Critical cut passes.** First drafts over-include. A second pass that cuts covered ground, extra titles per author ("one door per author") and weak fits made every list better. `docs/research/` has the proposal and cut passes as examples of the *process*: tiers of cuts with reasons, cut albums kept in an archive instead of deleted.
- **Already-known works belong on the list**, marked as such. Formative and already-read titles anchor the edge; the emphasis stays on the frontier.

### The plumbing

- **One table per list.** `LISTS` at the top of `scripts/import.mjs` maps each source's columns to a common shape (title, creator, year, group, shelf, note, done, flags). A new medium is one more entry. The page reads `lists.json` and needs no code per list.
- **Lookups with fallbacks and a cache** (`scripts/lookup.mjs`): keyless public APIs first (Open Library, Wikidata, Wikipedia, MusicBrainz, Deezer, Cover Art Archive, iTunes), keyed ones optional (TMDB, OMDb, Google Books). Results are cached so a title is looked up once. Films are matched on director as well as title, and a short hand-checked list fixes the ones search gets wrong. **Generated titles and years contain errors**; a lookup that fails is a signal to check the title, not just a missing cover. MusicBrainz allows one request a second, so a big run is slow; [ROADMAP.md](ROADMAP.md) has the bulk-dump alternative.
- **Stable keys.** `"<title>|<creator>"` connects a row to its marks, threads and removals. Simple, but fragile: correcting a title detaches everything keyed to the old spelling. The Builder will want a stable ID per title instead.
- **Additions are separate from marking.** Only the curation pipeline adds titles; the owner's page can only mark and remove. This kept the lists coherent and is worth keeping.
- **Public sees only crossed-off.** Private flags (such as "Start here") and progress detail show only in owner mode.
- **The page's interaction details**: filters kept in the URL so a view can be shared, a chip for every active filter, menu counts that grey out empty choices, a random pick, shelves remembered per browser, an XLSX export with one sheet per list (SheetJS, loaded only on export).

## What doesn't carry over as is

- **Owner mode's IssueOps.** Marks go out as a prefilled GitHub issue, and a workflow applies issues opened by the repository owner. That works because there is exactly one owner and GitHub sign-in is the permission check. A paid multi-user service needs real accounts (the brief's email magic link) and a datastore per user. The idea worth keeping is the shape: changes wait locally, then go out as one batch the server validates.
- **Data served from `raw.githubusercontent.com`.** Fine for one public library; GitHub caches it for about five minutes and every list is world-readable. Builder pages need their own hosting and an access decision (private, public or shareable by link).
- **The digests setup.** A private repository read with a fine-grained read-only GitHub key pasted into the browser suits one person. Digests as a Builder add-on need server-side storage and access control.
- **Licensing.** The portfolio is MIT-licensed; this repository has no license file. Both are Jason's, so reuse is his call, but add a license before copying code into another public repository.

## What must not be copied

These are Jason's and only Jason's. The Builder must not seed, prompt, rank or validate with them:

- **Every title on every list**, and the shelf and section names, which encode his taste ("The Vonnegut Frequency", "My Wheelhouse", "My Books on Screen", "Ebert's Four-Star Shelf", "Nick at Nite and Before", "The 1994–2003 soundtrack cabinet").
- **The notes**, written in his voice about his shelf and history.
- **The core shelf's twelve titles, the threads, the artist, author and director paths and the reading-path tracks** (`docs/reading-path.md`).
- **The taste-specific flags.** "Vonnegut frequency" (`star`) measures closeness to his favorite book. The general idea is a per-person "frequency" flag named after *their* touchstone.
- **The research passes in `docs/research/`**, written to him about his lists. Use them to see what a cut pass looks like, not as a source of picks.
- **Anything from the private digests repository**, including the reader profile in its writing brief.

### Checks worth building in

- **Overlap.** Compare each generated list with Jason's (`data/<list>.json`, keyed by title and creator) and with other users' lists. High overlap with any one person is a red flag. Some overlap with the famous canon is unavoidable; overlap in the long tail is not.
- **Traceability.** Every pick should trace back to something the person said: a book on their shelf, their favorite and why, a dislike. A pick that traces only to "it's a classic" belongs in a clearly labeled "other canon" shelf, as Jason's list does with its own.
- **Verification before delivery.** Run the lookups on every generated title and treat no-match titles as suspect.

## What the intake taught us

The most useful signals were concrete: photos or screenshots of a real shelf, an all-time favorite and *why* it lands, the few works that formed them, and what they dislike or skip. Abstract genre picks were weak. See the Builder brief in its own project for the open questions on pricing, models and delivery.
