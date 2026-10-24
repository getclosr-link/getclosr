# Contributing to getClosr

Thanks for helping. getClosr handles some of the most private things people write down, so a few rules here are stricter than in most projects.

## Ground rules

- Everything in this repository is in English: UI copy, code comments, docs, tests, commit messages, issues and pull requests.
- Nothing personal goes into the repository. Use invented names (Alex, Sam, Jordan), `example.org` addresses and made-up notes in tests, screenshots and descriptions. Never paste a real getClosr code from yourself or anyone else into an issue; it contains their answers.
- The privacy promises on the site are part of the product. A change must not add a server call, analytics, cookies or a third-party request. If you think one is needed, open an issue first.
- Keep the app a single static file without a build step. A new dependency needs a good reason and has to be vendored with its license.
- Changes to the checklist content (`CATS`, `ITEM_PROMPTS`) are published under CC BY-SA 4.0 as well as the AGPL-3.0. See [`LICENSE-CONTENT.md`](LICENSE-CONTENT.md).

## Setting up

```bash
git clone https://github.com/getclosr-link/getclosr.git
cd getclosr/public
python3 -m http.server 8000
```

Open <http://localhost:8000>. Edit `public/index.html` and reload.

## Tests

```bash
cd tests
npm ci
npx playwright install chromium webkit
npm test
```

The suite runs every spec in Chromium and the sharing specs in WebKit as well. CI runs the same command on each pull request. Please add or update a spec when you change behaviour, especially anything about codes, imports or what a share card reveals.

## Codes are a public format

People keep their codes in notes and chats for months. A change to the encoder must keep every older code readable (v2 to v7 today), and `tests/specs/codec.spec.js` must keep passing. A new format gets a new version number instead of changing an existing one.

## Pull requests

1. Branch from `main` and keep the pull request to one topic.
2. Run the tests locally.
3. Describe what changes for the person using the app and how you checked it. For visual changes, add a before and after screenshot with invented data.
4. Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages, for example `fix(share): keep notes off the group card`.

For larger UI changes, open an issue with a mock-up first. The design rules are in `docs/DESIGN.md` and `docs/BRAND.md`.

A change that people will notice gets a line under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).

## Releases

The site deploys on every push to `main`. A release names a tested state, following [Semantic Versioning](https://semver.org/) as described at the top of the changelog. Maintainers cut one like this:

1. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it and update the compare links at the bottom.
2. In `public/index.html`, set the footer link `#app-version` to `vX.Y.Z` (text and release URL).
3. Commit to `main`, wait for the tests to pass, then tag and push:

   ```bash
   git tag -a vX.Y.Z -m "getClosr vX.Y.Z"
   git push origin vX.Y.Z
   ```

The release workflow checks that the tag is on `main` and that the footer shows the same version, then publishes the GitHub release with that version's changelog section as notes.

## Reporting bugs and ideas

Use the issue templates. For anything that could expose someone's answers, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).
