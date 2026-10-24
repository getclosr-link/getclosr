<p align="center">
  <a href="https://getclosr.link"><img src="docs/images/banner.png" alt="getClosr — Map your desires. Privately. No account, no server, no tracking." width="100%"></a>
</p>

<p align="center">
  <a href="https://getclosr.link"><img alt="Live at getclosr.link" src="https://img.shields.io/badge/live-getclosr.link-ff9398?style=flat-square&labelColor=1c1a3e"></a>
  <a href="https://github.com/getclosr-link/getclosr/actions/workflows/tests.yml"><img alt="Tests" src="https://img.shields.io/github/actions/workflow/status/getclosr-link/getclosr/tests.yml?branch=main&style=flat-square&label=tests&labelColor=1c1a3e"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/code-AGPL--3.0-7a0f35?style=flat-square&labelColor=1c1a3e"></a>
  <a href="LICENSE-CONTENT.md"><img alt="Content: CC BY-SA 4.0" src="https://img.shields.io/badge/content-CC%20BY--SA%204.0-d14836?style=flat-square&labelColor=1c1a3e"></a>
  <a href="https://github.com/getclosr-link/getclosr/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/getclosr-link/getclosr?style=flat-square&labelColor=1c1a3e&color=ff9398"></a>
  <img alt="No build step" src="https://img.shields.io/badge/build-none-37346a?style=flat-square&labelColor=1c1a3e">
</p>

<p align="center">
  <b>A free desires checklist for yourself, a partner, a date or a group.</b><br>
  Fill it out on your own device, keep it for yourself, or share a code and see what you want together.
</p>

<table align="center">
  <tr>
    <td align="center" width="33%"><b>No account</b><br><sub>No sign-up, no login, no email.</sub></td>
    <td align="center" width="33%"><b>No server</b><br><sub>Your answers stay in your browser. The code <i>is</i> your data.</sub></td>
    <td align="center" width="33%"><b>No tracking</b><br><sub>No analytics, no cookies, no third-party requests.</sub></td>
  </tr>
</table>

<p align="center">
  <a href="https://getclosr.link"><b>Open getClosr →</b></a>
</p>

<p align="center">
  <img src="docs/images/home.png" alt="The getClosr home screen: Map your desires. Privately., with buttons to fill out a list or paste a code" width="80%">
</p>

## How it works

1. Fill out your list. Rate each activity as No, Maybe, Yes or Crave, separately for doing it yourself, giving and receiving. It takes about 10 minutes, and you can switch off whole categories you don't want to think about today.
2. Generate a code. Your answers are packed into one compact code. The code is your data; nothing is stored anywhere else.
3. Compare. Paste the codes into the code field on the home screen. getClosr decodes them locally, shows what is inside, and then lists matches, things to talk about and gaps.

A comparison takes any number of people. With three or more, getClosr shows what everyone shares as well as each compatible pair, and never invents combinations that nobody chose.

## Sharing

Everything you can hand over sits in one share sheet, and each option says what it reveals before anything leaves the browser.

| Format | What it carries | Meant for |
|---|---|---|
| Profile card (PNG, 1080 × 1350) | Name, rating scale, category overview, a few Craves, the hard limits you chose to publish, and a QR code with your public profile | A dating profile, a forum post, your camera roll |
| Private code (v6) | Every rating, your activity notes, the overall note, opted-in aftercare and hard limits | One person you trust |
| Group code (v7) | Every list in a comparison | Reopening that comparison later, for example a couple's two lists |
| Comparison card (PNG) | Names, match, discuss and gap counts, how each pair overlaps | Sharing a summary without any notes |

The public profile behind the QR code never contains activity notes or the overall note. Hard limits appear on the card only because you wrote them for that purpose; the review screen counts them against a 280-byte limit so they fit in the QR code.

When someone scans your card, the code is taken out of the address bar as soon as it is read, so it does not stay in their browser history. It lands in the code field, where it describes itself before the visitor decides what to do with it.

Older v2 to v4 codes still open. Replacing your own list with an imported one is always a two-step confirmation after a preview; getClosr never merges or overwrites a list without asking.

## Features

- 10 categories with 64 activities, each with a short explanation; risky ones are marked "Needs context"
- Four-level rating scale (No, Maybe, Yes, Crave) for self, giving and receiving
- Private notes per activity and an overall note
- Aftercare preferences, shared only if you opt in
- Comparisons for any number of people, saved on the device
- Draft saved in `localStorage`, so a page refresh loses nothing
- Browser back and forward move between screens
- Dark design, mobile first

## Privacy

getClosr is one static HTML page. It has no backend, no database, no analytics, no cookies and no tracking. All processing happens in your browser, and we could not see your answers even if we wanted to.

There is one opt-in exception: the *Send feedback* switch at the bottom of the page. Nothing loads until you turn it on. It then pins a small feedback button to the corner, so you can report something from any screen. Only what you send leaves the browser: your message, any image you attach yourself, the page address without query or code, your browser type and screen size. It never takes a screenshot on its own and never includes your answers or a code.

The widget talks to this site's own `/fk` path, which the Cloudflare Worker in [`src/worker.js`](src/worker.js) relays to the [FeedbackKit](https://github.com/TruffleCraft/feedbackkit) gateway. An AI model reads the message once to understand it and, if something is missing, asks one follow-up question. Feedback is stored in a private inbox and is **not** published as a GitHub issue; the maintainers turn it into issues by hand. Cloudflare Turnstile runs as a bot check, and only after the switch is on.

The full privacy policy is at [getclosr.link/privacy](https://getclosr.link/privacy).

## Local development

The app is a single file, [`public/index.html`](public/index.html), with no build step and no framework. Serve the `public/` folder with any static server:

```bash
cd public
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The only vendored dependency is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) v2.0.4 (MIT), inlined so the QR code renders without a network request.

Design and wording rules live in [`docs/DESIGN.md`](docs/DESIGN.md) (the rating scale), [`docs/BRAND.md`](docs/BRAND.md) (voice and visuals) and [`docs/profile-card.md`](docs/profile-card.md) (the share card).

## Tests

The end-to-end tests use [Playwright](https://playwright.dev) and start their own server on port 4173:

```bash
cd tests
npm ci
npx playwright install chromium webkit
npm test
```

Every spec runs in Chromium. The sharing specs (profile card, group card, import and group comparison) also run in WebKit, because Safari handles sharing, the clipboard and canvas export differently. Use `npm run test:chromium` for a quicker run in Chromium only.

GitHub Actions runs the same suite on every pull request and on every push to `main` ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)).

## Deployment

getClosr runs as a Cloudflare Worker with static assets, connected to this repository through Workers Builds: a push to `main` runs `npx wrangler deploy` and publishes the site. [`wrangler.jsonc`](wrangler.jsonc) serves `public/` as is (clean URLs, `404.html` for unknown paths, headers from `public/_headers`) and sends only `/fk/*` through [`src/worker.js`](src/worker.js). There is no build step.

The feedback relay needs the gateway address as a secret:

```bash
npx wrangler secret put FEEDBACKKIT_ORIGIN
```

Check a deploy against the live domain rather than the build log, for example by comparing the byte size with your local file:

```bash
curl -sL https://getclosr.link/ | wc -c
wc -c public/index.html
```

## Releases

Every version is tagged and published under [Releases](https://github.com/getclosr-link/getclosr/releases); what changed is in [CHANGELOG.md](CHANGELOG.md). The version also shows in the site footer.

## Contributing

Bug reports, ideas and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first; it covers the test run, the privacy rules for example data and how pull requests are reviewed. Everyone taking part agrees to the [code of conduct](CODE_OF_CONDUCT.md). Security problems go through the private channel described in [SECURITY.md](SECURITY.md), not a public issue.

## License

getClosr is free software under the [GNU Affero General Public License v3.0 only](LICENSE). If you run a modified version for other people, including as a website, you have to offer them its source code under the same license. Third-party code keeps its own license (qrcode-generator is MIT).

The checklist content (categories, activities, descriptions and questions) is also available under [CC BY-SA 4.0](LICENSE-CONTENT.md), so you can translate, print or reuse the list elsewhere as long as you credit getClosr and share your version alike.

Copyright © getClosr contributors

## Support

getClosr is free and has no subscription or ads. If it helped you, you can [buy me a coffee](https://buymeacoffee.com/madsbergstroem).

---

*SSC: Safe, Sane, Consensual · RACK: Risk-Aware Consensual Kink*

Made by the getClosr contributors.
