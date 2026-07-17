# Changelog

## Unreleased — 2026-07-18

### Added

- Added a Paper Scout `Sort by` control with `Most Cited` and `Least Cited`.
- Added a deterministic Paper Scout regression harness for duplicate cleanup, the 50-paper cap, sorting, reading-filter compatibility, and five-paper pagination.
- Added development documentation for priorities, deployment checks, and QA results.

### Improved

- Citation sorting now resets pagination to page 1.
- DOI normalization now also handles a `doi:` prefix and removes URL query strings or fragments before duplicate comparison.
- Citation ties use newer year first, then title, for a stable order.

### Preserved

- Existing reading filters, citation-per-year calculation, quality score, journal badges, search history, Analyze, Open, Reading Library, comparison, and AI Summary flows.
- Journal source and data behavior were not changed.

## 2026-07-18

- Refined Language Hub hero typography and reduced the Back to Knowledge button and first panel size.
- Added the local-first Language Hub with multiple languages, weekly goals, and short practice records.
- Added Learning Snapshot to the homepage.
- Added versioned local learning-data export.

## 2026-07-17

- Added Paper Scout Reading Library and paper comparison.
- Added a comparison-specific AI analysis mode.
