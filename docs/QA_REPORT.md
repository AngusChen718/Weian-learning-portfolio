# QA Report — 2026-07-18

## Scope

- Paper Scout duplicate cleanup
- Citation sorting
- 50-paper cap
- Five-paper pagination
- Reading-filter compatibility
- Homepage, Journal, and Language Hub smoke tests
- Local data module checks
- Desktop and mobile layout checks

## Results

### Paper Scout deterministic regression

Passed:

- DOI duplicates were merged after normalizing URL, `doi:` prefix, query string, and letter case.
- Title-and-year duplicates were merged when DOI was missing.
- The version with the higher citation count was retained.
- 60 unique input papers were reduced to the 50-paper display pool.
- Pagination displayed 5 papers per page and 10 pages for 50 results.
- Most Cited produced `59, 58, 57, 56, 55` on the first test page.
- Least Cited produced `10, 11, 12, 13, 14` from the retained 50-paper pool.
- Changing the sort returned pagination to page 1.
- The Explore reading filter retained the selected citation order.

### Page smoke tests

Passed:

- Homepage theme preference remained applied after reload.
- Search History opened and closed with correct accessibility state.
- AI Summary showed the expected empty-input guidance.
- Journal New Entry and Cancel opened and closed the editor without saving.
- Journal search reduced the visible feed to the matching entry.
- Language Hub saved a test language across reload.
- Language Hub saved and deleted a test practice record.

### Local data modules

Passed:

- Backup recognizes all 6 supported local data groups.
- Learning Snapshot correctly summarized a sample Journal entry and Reading Library item.
- Language Hub normalization and weekly metrics handled a sample saved session.

### Layout and JavaScript

Passed:

- `index.html`, `journal.html`, and `language.html` had no horizontal overflow at 1280px.
- The same pages had no horizontal overflow at a 375px mobile viewport.
- The Paper Scout filter row stacked vertically on mobile.
- No JavaScript errors or warnings were recorded during the deterministic tests and page smoke tests.
- JavaScript syntax checks passed.

## Live API issue

The live Paper Search Worker could not be fully validated during this run:

- The browser reached the existing 25-second OpenAlex timeout.
- Direct Worker requests ended with a connection reset before returning JSON.

Cloudflare source inspection passed:

- The Worker reads `q` and `limit`.
- The requested limit is clamped from 1 to 100.
- OpenAlex receives `per-page=${limit}`.
- No fixed `.slice(0, 25)` or `.slice(0, 50)` is present.
- Paper mapping includes title, year, venue, DOI, citation count, authors, abstract, and usable OpenAlex/open-access URLs.
- Cloudflare showed 43 invocations, 0 Worker errors, and the active deployment from approximately 8 hours earlier.

The remaining P0 item is a successful live end-to-end search, because source correctness does not explain the timeout/reset observed from the test environment.
