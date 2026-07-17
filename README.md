# Weian Learning Portfolio

A local-first learning portfolio built with Vanilla HTML, CSS, and JavaScript.

## Current features

- Paper Scout: OpenAlex search, duplicate cleanup, citation sorting, reading filters, pagination, Reading Library, comparison, and AI Summary
- Journal: published entries and drafts stored in the browser
- Learning Snapshot: a seven-day overview of Journal and Reading Library activity
- Language Hub: multiple languages, weekly goals, and short practice records
- Learning Backup: versioned JSON export for the supported local data

## Main files

- `index.html`, `styles.css`, `script.js` — homepage, Paper Scout, and AI tools
- `journal.html` — Journal interface
- `language.html`, `language.css`, `language.js` — Language Hub
- `snapshot.js` — Learning Snapshot
- `backup.js` — local backup export

## Development references

- [Changelog](docs/CHANGELOG.md)
- [Prioritized roadmap](docs/ROADMAP.md)
- [Deployment checklist](docs/DEPLOY_CHECKLIST.md)
- [Latest QA report](docs/QA_REPORT.md)
- [Paper Scout regression harness](tests/paper-scout-harness.html)

## Deployment

The site is deployed as static files on Cloudflare. There is no framework build step.
Run the checks in `docs/DEPLOY_CHECKLIST.md` before uploading a new version.
