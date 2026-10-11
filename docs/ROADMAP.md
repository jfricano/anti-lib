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
