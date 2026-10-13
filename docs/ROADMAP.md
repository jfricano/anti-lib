# Roadmap

Ideas for later, not commitments.

## Local copies of the lookup databases

Every lookup today calls a live public API, so big lists are slow to look up and depend on each service staying up and keeping its limits (MusicBrainz allows one request a second). Most of these databases publish free bulk downloads. Keeping a local copy of each would make lookups take minutes, work offline and survive an API going away.

| List | Primary download | Fallback download |
| --- | --- | --- |
| Books | Open Library data dumps (works, editions, authors, cover IDs) | Wikidata dump |
| Films | Wikidata dump (films, directors, Wikipedia links) | IMDb non-commercial datasets (titles and years only, no images) |
| TV | Wikidata dump (series, creators, networks) | IMDb non-commercial datasets |
| Albums | MusicBrainz data dumps (release groups, Discogs links, genres) | Discogs monthly data dumps |

Covers would still come from each service's image host, which has no rate limit to speak of. Google Books and iTunes have no downloads, so they stay live fallbacks. Worth doing once lists grow past a few thousand titles or need re-checking often.

## Cover store on Railway (parked)

Status: designed and built, paused pending implementation (jason, 2026-10-13). Code waits on its branches, reachable from the closed PRs anti-lib #52 (`server/`, `scripts/store.mjs`, the Store covers workflow) and personal-portfolio #83 (the page reads covers from the store). Plan: `/mnt/project-files/anti-library/railway/plan.md` in the project.

- Covers go on a small Railway Serverless service shaped like Personal Treasury's: full-size originals (the largest each host offers) plus 256px thumbnails for the page. A workflow copies new covers after each data rebuild; the page falls back to the source link when the store lacks a cover or is waking.
- List data stays in GitHub: one copy with history, never sleeps, about 80 to 150 KB per visit. `lookups.json` is a build cache the page never loads.
- Expected cost: well under $1 a month; full-size covers a few GB, inside Railway Hobby's default 5 GB volume.
- To resume: reopen #52 or open a new PR from its branch, set up Railway per `server/README.md` in that PR, run Store covers once, then set `data-covers` in #83.
