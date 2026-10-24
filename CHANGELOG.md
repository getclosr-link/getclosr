# Changelog

All notable changes to getClosr are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/):

- **Major:** a change that breaks something people rely on, for example a code that no longer opens.
- **Minor:** a new feature, new activities or a new share format.
- **Patch:** fixes, wording and design polish.

Every version is a git tag `vX.Y.Z` with a GitHub release. The site itself deploys on every push
to `main`; a release marks a tested state worth naming.

## [Unreleased]

### Changed

- Support moved from Buy Me a Coffee to [GitHub Sponsors](https://github.com/sponsors/getclosr-link) for the organization. The footer link is a plain link; the embedded payment form and its privacy section are gone, and no personal handle ships with the site.

### Fixed

- Profile cards omit empty hard limits and center the QR panel when no limits are shared.
- Your name is editable directly on Review and stays in sync with Overview and the saved list.
- The feedback switch waits for the widget’s asynchronous configuration before treating it as ready.
- The imprint and privacy page include the public contact address hello@getclosr.link.
- Aftercare keeps the centered questionnaire layout instead of stretching across the screen.
- A failed feedback load can be retried, and switching feedback off prevents a delayed load from opening it.
- Category choices, result filters and activity details work from the keyboard. Dialogs contain focus and return it when closed.
- The privacy notice distinguishes discarding a draft from clearing all site data.
- Oversized private and group exports explain how to reduce the code before copying it.
- Editing your own code after a reload retains your saved answers and aftercare sharing choice.
- A failed comparison save keeps the form open and reports the storage error so you can retry.

## [1.0.0] - 2026-10-24

The first public release, on its own domain and under its own organization.

### Added

- Checklist with 10 categories and 64 activities, rated No, Maybe, Yes or Crave for self, giving and receiving, with private notes, an overall note, aftercare preferences and hard limits.
- Comparisons for any number of people, saved on the device: matches, things to talk about and gaps, with shared results for groups.
- Share sheet with a profile card (PNG with QR code), a private code (v6), a group code (v7) and a comparison card. Older v2 to v4 codes still open.
- Choice of what goes into a code, and recognition of your own code.
- Opt-in feedback: a footer switch pins a feedback button to every screen. An AI model reads the message once and may ask one follow-up question; feedback is stored privately and never published automatically.
- Privacy promises on the home screen with icons: no account, no server, no tracking.
- Imprint and privacy policy.
- Checklist content (categories, activities, descriptions, questions) is also available under CC BY-SA 4.0; the code is AGPL-3.0-only.

### Changed

- Moved to [getclosr.link](https://getclosr.link) and the [getclosr-link](https://github.com/getclosr-link) organization; `getclosr.pages.dev` redirects there.
- Copy speaks to singles, couples and groups, with the claim "Map your desires. Privately."
- Runs as a Cloudflare Worker with static assets instead of Cloudflare Pages.

### Fixed

- Escape now closes the feedback panel from anywhere and unlocks page scrolling.
- Dark, thin scrollbar that matches the design.

[Unreleased]: https://github.com/getclosr-link/getclosr/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/getclosr-link/getclosr/releases/tag/v1.0.0
