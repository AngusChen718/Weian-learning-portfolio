# Development Roadmap

## P0 — Reliability before the next release

1. Investigate Paper Search Worker availability.
   - During the 2026-07-18 QA run, the browser reached the existing 25-second timeout.
   - Direct Worker requests were reset before a response was returned.
2. Repeat a live search after the Worker is stable.
   - Confirm 50 cleaned results are shown when enough OpenAlex results exist.
   - Confirm Most Cited is selected by default.
   - Confirm the first and last pages contain no duplicate papers.

Cloudflare source inspection already confirmed:

- The Worker reads both `q` and `limit`.
- `limit` is clamped between 1 and 100.
- OpenAlex receives the value as `per-page`.
- There is no fixed `.slice(0, 25)` or `.slice(0, 50)`.
- The paper mapping includes title, year, venue, DOI, citation count, authors, abstract, and OpenAlex/open-access URLs.

## P1 — Safe data recovery

1. Design a backup import preview.
2. Show which local data groups will be added or replaced.
3. Require a second confirmation before overwriting local data.
4. Keep export compatible with older backup versions.

## P2 — Product improvements

1. Add a Recent sort only after citation sorting has been stable in production.
2. Add a Language Hub edit/remove flow for languages.
3. Add non-destructive status feedback for long Paper Scout searches.
4. Reduce duplicated legacy CSS blocks in small, separately tested changes.

## Release rule

Only one user-facing feature should be enabled in each release. Reliability fixes and documentation may accompany it when they do not alter unrelated behavior.
