# getClosr — brand foundations

Voice, tone and the visual rules that are not about the rating scale. The rating scale —
words, colours, marks, the three channels — lives in [`DESIGN.md`](DESIGN.md) and is not
repeated here.

> This replaces `design-spec/design_handoff_getclosr_v2/README_brand.md`, a v2 handoff that
> was declared the SSOT and then aged badly: by the time it was removed it claimed the app
> had no icon system (it vendors Lucide), that focus states were still missing, that the
> serif was only a recommendation, that Crave was green, and that the app was ~1322 lines
> (it was 6922). Everything below has been checked against the code.

## Voice

Plain, declarative, second-person. *"Map your desires. Privately."* Imperative verbs in
CTAs. When the app explains itself it uses a "do this → then this → then this" rhythm.

- **Singles, couples and groups.** getClosr works on your own as well as with others.
  Copy never assumes a couple: write "a partner or a group", "everyone", "together"
  rather than "you and your partner" where the sentence is about who uses the app.
- **No "we", no "us".** The product addresses *you*, and your *partner* or *group* when
  there is one. Not "users", not "people", not "partner A / partner B".
- **Community vocabulary, not euphemism.** Top, Bottom, D/s, giving, receiving. Say
  "anal fisting", not "advanced anal play".
- **Never clinical, never pathologizing, never voyeuristic.**
- **Risk language is descriptive, not alarmist.** "Needs context", "learn the technique
  first" — never "DANGEROUS".
- **Heavy topics get quieter, not louder.** Hard limits and risk copy use shorter
  sentences and more whitespace than the rest of the app.

**Casing.** Sentence case everywhere, including headlines and buttons, with no terminal
punctuation. The exception is category headers and small eyebrow labels, which are
uppercase and letter-spaced — a graphic device, not a shout.

**Don't write:** marketing flourish ("discover your most intimate self"), Cosmopolitan
adjectives, or anything that implies data is collected. The app's entire claim is that
nothing leaves the device; the copy has to keep proving it.

## Emoji

**Not used as UI, ever.** Marks in the app, the footer included, are icons or typographic
symbols, never pictograms. An emoji in a row breaks the register immediately.

## Chrome palette

Since 2026-10 the look follows "Inside The Head" (Awwwards Site of the Day, 2017): a navy
ground with bordeaux, red and coral as flat colour fields. **Dark only**; there is no light
mode and no theme toggle. Rating colours are separate hues and are governed by `DESIGN.md`.

| Token | Value | Use |
|---|---|---|
| `--navy` / `--bg` | `#1c1a3e` | ground |
| `--bord` | `#7a0f35` | diagonal fields |
| `--red` | `#d14836` | circles |
| `--coral` / `--accent` | `#ff9398` | accent text, primary button, small fields |
| `--surface` / `--surface2` | `#24224e` / `#2c2a5c` | cards |
| `--text` / `--muted` | `#f4f1f7` / `#a9a5cf` | ink (muted is 6.3:1 on a card) |

## Type

System stack plus `ui-serif, Georgia` for display headlines, set at weight 900 for the
large titles. No webfont, because the app is one file with no network requests. Sizes come off the nine-step scale (`--t-display` …
`--t-2xs`); **use a token, never invent a size.** `DESIGN.md` explains why.

## Structure

- **Borders do the structural work.** Hairline `1.5px solid var(--border)` on every card,
  pill and input. Shadows only add lift: `--shadow` for floating things, `--shadow-sm` for
  sticky surfaces. **No inner shadows.**
- **Radii:** `--r 14px` default, `--r-lg 18px` for larger surfaces, `--r-pill 20px` for
  pills. Never sharp corners.
- **Layout:** mobile-first, single column, content max-width 720px, sticky nav at top. No
  desktop sidebar. Every container on a screen shares one horizontal inset — a screen where
  boxes have four different widths is a bug, and has been one twice.
- **Row zebra** (`--row-alt`) in the questionnaire is precious for scannability. Preserve it.

## Restraint

- **No imagery.** No stock, no illustration, no avatars, no mood photography. The reader's
  mental images stay theirs; that restraint is what makes the topic feel safe.
- **Flat colour fields are the only decoration.** A bordeaux diagonal, red circles and a
  coral corner, as solid shapes, on three surfaces: the home hero, the head of the question
  screen and the head of the results. They are `aria-hidden` and never sit behind a rating.
  No gradients, no texture, no pattern.
- **Buttons are pills in uppercase** with letter spacing: outline in white on a field, coral
  with navy text as the primary action elsewhere.
- **Animation is minimal and quick**: `.2s`, a one-pixel lift on the primary button. No
  bounce, no spring, no parallax, no scroll-jacking. This is the brand's emotional safety
  mechanism: fast feedback, no surprises.
- **Blur is used in exactly one place**, the sticky nav. Do not proliferate it.

## Icons

The app vendors **Lucide** (ISC) as inline SVG node data — `UI_ICONS` for interface marks,
`CAT_GLYPHS` for category glyphs, `CARD_ICONS` for the canvas card. Monochrome line,
`currentColor`, 1.5–1.8px stroke, 24×24 viewBox. No CDN, no icon font, no sprite file:
everything is inlined so the app makes zero network requests — until someone clicks *Send
feedback*, which loads the feedback form from the site's own `/fk` path.

Category glyphs are recognisable wherever a fitting icon exists. Only *penetration* stays
geometric — it is the one category where a literal icon would be explicit rather than clear.
Regenerate from the package rather than editing a path by hand.
