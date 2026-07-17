# Deployment Checklist

## 1. Scope check

- Confirm the release contains one user-facing feature.
- Confirm Journal files are unchanged unless Journal is the stated task.
- Review `git diff` and remove unrelated edits.

## 2. Static checks

- Run JavaScript syntax checks for `script.js`, `backup.js`, `snapshot.js`, and `language.js`.
- Run `git diff --check`.
- Confirm every new HTML `id` matches its JavaScript lookup and every label `for` value.
- Confirm no duplicate localStorage key was introduced.

## 3. Paper Scout regression

Start a static server at the repository root and open:

`tests/paper-scout-harness.html`

Check both queries:

- `quality`: 6 cleaned papers, 5 on page 1, 1 on page 2.
- `limit`: 50 cleaned papers, 10 pages.

Then confirm:

- Most Cited orders citation counts from high to low.
- Least Cited orders citation counts from low to high.
- Changing the sort returns to page 1.
- Reading filters still preserve citation order.
- Previous and Next disable correctly at the boundaries.

## 4. Page smoke test

Test at desktop width and approximately 375px mobile width:

- `index.html`: theme, navigation, Paper Scout controls, search history, AI Summary empty state, Reading Library, and comparison.
- `journal.html`: New Entry, Cancel, search, and filters. Do not publish or delete test data on production.
- `language.html`: language tabs, add-language validation, practice form, and delete-practice action.
- Confirm there is no horizontal page overflow.
- Confirm the browser console has no JavaScript errors.

## 5. Live API check

- Search a normal topic such as `catalysis`.
- Confirm the request finishes before the 25-second frontend timeout.
- Confirm the Worker accepts `limit=100`.
- Confirm the frontend keeps at most 50 cleaned papers.
- Confirm each result has working Analyze and Open actions.

## 6. Cloudflare upload

Upload the complete production set:

- `index.html`
- `journal.html`
- `styles.css`
- `script.js`
- `backup.js`
- `snapshot.js`
- `language.html`
- `language.js`
- `language.css`

The `docs/` and `tests/` directories are development references and are not required in the production upload.

## 7. Production verification

- Open the deployed URL with a cache-busting query string.
- Repeat one desktop and one mobile Paper Scout search.
- Verify Most Cited is the default.
- Verify pagination, Analyze, Open, Reading Library, and comparison.
- Verify Journal and Language Hub still load existing local data.
- Record the release in `docs/CHANGELOG.md`.
