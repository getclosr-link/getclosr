# getClosr — design SSOT

This file owns the rating scale and the screen-level decisions. Voice, tone, chrome palette
and the restraint rules live in [`BRAND.md`](BRAND.md). **Read both before changing colour,
type, or icon work** — a rating palette was once rebuilt from first principles without them
and shipped a green level 1.

These two files are the whole design SSOT. A `design-spec/design_handoff_getclosr_v2/`
folder used to hold it: 38 files, a stale duplicate of the app, and prototypes for decisions
that have long since shipped. It was removed once six of its claims had become false while
it was still labelled authoritative. Do not reintroduce a handoff folder — fold decisions
into these files as they are made.

## The rating scale — non-negotiable

Four levels. The words live in **one constant, `RATING_WORDS`** — the questionnaire, the
legend, the results and the profile card all read from it. Levels 1–4 and the encoding are
independent of the words, so renaming them never invalidates an existing code.

Since the 2026-10 redesign the app is dark only (navy ground, see `BRAND.md`). Values are
`fg / bg / br`; `bg` is the tint of a chosen answer, `br` its border and `fg` its text.

| Level | Word | Token family | Hue | `fg / bg / br` |
| --- | --- | --- | --- | --- |
| 1 | No | `gap` | **red** | `#fd736f / #402846 / #984b59` |
| 2 | Maybe | `disc` | **yellow** | `#f3c443 / #3e353f / #927841` |
| 3 | Yes | `recv` | **turquoise** | `#40d9c1 / #223953 / #308386` |
| 4 | Crave | `crave` | **purple, a fourth hue** | `#ce9ffe / #382f5d / #7e63a8` |

The four hues were chosen by script for the largest separation, not by eye: the closest pair
is ΔE 20.5 for normal vision and 10.3 under red-green deficiency (the old scale: 16.2 and
8.0). Yes moved from green to turquoise for that reason: it sits further from the yellow of
Maybe.

### Why the words are what they are

The scale used to read *Not for me · Curious · Into it · Crave*. Three of those named a
decision; **"Curious" named a feeling** — it said nothing about whether the person would
actually do the thing, so it sat on a different axis (experience, uncertainty) than the rest
of the ramp. All four words now answer one question: *how much do I want this.* "Maybe"
states undecidedness honestly and pushes the detail into the per-activity comment, which is
where getClosr is strong.

### Rules

- **Red means no.** Never encode level 1 as a shade of green, however tidy the ramp looks.
  A scale everyone misreads is worse than one that is harder for some readers to separate
  by hue alone.
- **The brand fields never sit behind a rating.** Bordeaux, red and coral are flat fields on
  the hero, the question head and the results head. Ratings sit on navy or on the card
  surface, so the red of a field is never read as "No".
- **A chosen answer is a tinted field.** In the questionnaire, the overview, the results
  bars and chips, the onboarding and both share cards a rating is drawn as its `bg` tint
  with a `br` border and `fg` text (at least 4.8:1). Full fields of the bright `fg` colours
  read as too loud next to the navy and bordeaux; only small marks (the progress dots, the
  legend keys) use `fg` as a fill.
- Crave is purple because "Yes" already takes the green side of the wheel; a second green
  cannot carry the top of the scale.
- **One answer, one colour.** The four buttons are four decisions on one axis; choosing one
  lights that button only. Tapping the chosen answer again clears it.

### Three channels, not one

- Red and yellow stay the weakest pair under red-green deficiency (ΔE about 10, measured
  with the `dataviz` validator). That is the price of a semantic red and it is accepted
  deliberately.
- Mitigation is mandatory and has three legs: **the word** (every level is labelled wherever
  it appears), **the mark** (`✗ ? ✓ ★` as monochrome line icons), and **position** (the
  four answers always stand in the same order). Stacked-bar segments
  additionally print their own count. If you add a surface that shows these colours without
  a word or a mark, you have reintroduced the bug.

The `bg` wells are near-black tints of their hue, and what makes them read as one family
is **chroma**, not lightness. Crave's well was once `#3b0764`, chroma 93 where its siblings
sat at 21, and read as a saturated block while every luminance check passed. Match the
siblings' chroma when you touch these, not only their brightness.

Verify colour changes with the `dataviz` skill's validator
(`node scripts/validate_palette.js "<hex,…>" --mode light|dark`) — measure, never eyeball.
`tests/specs/profile-card.spec.js` pins red-not-green, four distinct levels, Crave being off
the green ramp, and the presence of segment counts.

**Historical trap:** `--disc-*` and `--solo-*` hold *identical* values. While Crave was
mapped to `--solo-*`, "Maybe" and "Crave" rendered pixel-identical in every pill — the
weakest and strongest answers were indistinguishable. Do not map a rating level onto
`--solo-*` again.

## Everything you can hand over lives in one sheet

Profile card, comparison card and private code used to sit on three different screens, each
explaining itself in isolation — so the difference between *safe to post* and *one trusted
person* was something you worked out per screen, if at all. They are now three tabs of one
bottom sheet, and each tab states its privacy class in a coloured bar before the button
under it does anything, followed by a ✓/✗ list of what actually travels.

Consequences worth keeping:

- The results screen and the code screen open the **same** sheet. Add a fourth way to share
  and it belongs here, not on a screen of its own.
- A tab whose thing does not exist yet (no comparison run) says so and offers no action,
  rather than presenting a button that fails.
- The deliberate **preview before saving** step is unchanged — the sheet leads to it. The
  image is still never a surprise.

## Native dialogs are not the house style

`prompt()` is gone: naming a saved comparison happens in an inline field on the results
screen. A system dialog drops the reader out of the page, cannot carry the type or colour,
and on a phone covers the very thing being named. The one remaining `confirm()` guards
**discarding a draft** — a destructive, irreversible action where an unmissable system
interruption is the point. Do not add a native dialog to a creation flow.

## The results screen answers "where", then "which"

Two tabs on one screen. **Overview** opens first and answers *where do we overlap* — a
category × status breakdown sorted by share of matches, what people actually wrote, and who
overlaps with whom. **Activities** is the per-activity list you reach by tapping into any of
those. Boundaries sit **above** the tabs, because a published hard limit is read before
anything is chosen, not filed under a view.

Three levels of drill-down, each one a tap: category → the list, narrowed, with a chip
naming the narrowing and a way out of it; pair → the comparison recomputed for exactly that
pair; row → expanded, showing the answer **per axis** (Solo / Giving / Receiving) instead of
the single strongest one.

**The invariant that makes this trustworthy:** a pair's percentage in the overview and the
buckets in that pair's drill-down both fall out of the same function. `getGroupComparison()`
derives each row's group status from its own pair statuses, and `groupPairCounts()` counts
those same pair statuses — nothing is authored twice. A row therefore cannot claim
"Direct matches: A + B" while the A + B drill-down disagrees. **Do not add a second path
that computes a match.** A test pins the percentage against the drilled-down bucket counts.

Two honesty rules the list follows:

- A collapsed row reads all three axes, not just the ones the activity declares —
  `matchStatus()` does too, and a chip built from the declared set alone once read
  "Unrated" on a row the same data had made a direct match.
- Where a person's axes disagree, the row says so and points at the expanded view, rather
  than letting `max()` silently stand in for three different answers.
- An axis is named only when there is more than one — the same rule `buildQuestionView()` follows
  (`ctx.length > 1`). Labelling the single axis of a one-axis activity "Self" disambiguates
  nothing and just adds a word to every row.

In the questionnaire the four buttons are an *input*; in a result you are reading a stance,
so each answer is a chip carrying mark, word and colour. Keep that split.

## Type comes off a scale, not out of the air

Nine steps (`--t-display` … `--t-2xs`), defined at the top of `public/index.html`. **Use a
token; do not invent a size.** The app once carried 37 distinct hardcoded font sizes — `.82`, `.84`, `.85`,
`.86`, `.87` and `.88rem` all lived side by side, differences no reader can see but which
guarantee nothing aligns. Sizes that differed only invisibly have been collapsed onto their
step; the remainder move onto a token as each surface is rebuilt. Adding a new hardcoded
size re-opens the drift.

## Focus rings are universal, never a list

`:focus-visible` is declared once, unqualified. The rule used to enumerate the components
that existed at the time, so every component added later shipped with no focus ring at all.
Do not re-introduce a selector list. Do not set `border-radius` in the focus rule either —
the outline already follows the element's own radius, and overriding it squared off pills
while they were focused.

## One question per screen

The questionnaire shows one activity at a time (`buildQuestionView()`): the activity in the
display serif, its description from `CATS`, and the four answers as full-width pills of at
least 48px. Three things keep the reader oriented:

- **The dots** under the description stand for the activities of the category, filled in
  the colour of the answer given. Each dot is a jump target.
- **Contexts as tabs.** An activity with Giving and Receiving (or other pairs from
  `PILL_PAIRS`) shows one tab per context; answering one switches to the next unanswered.
- **Overview** lists every category with its progress and the activities of the current
  one with their answers. Any row jumps there.

Once every context of an activity is answered the app moves on after 380 ms, so the chosen
colour is seen first. Back and Skip move by hand and cancel a pending move.

## Hit areas are 24px even when the drawing is smaller

WCAG 2.5.8 puts the floor at 24×24. The progress dots are drawn at 12px and gain the area
from a transparent `::after` overlay, so the drawing stays small and the target still
qualifies.

## Touch input must never be under 16px

iOS Safari **zooms the whole page** when a focused field computes below 16px, and it does not
zoom back out. Every screen after that first tap is left scaled and clipped — this was the
real cause of a reported "scaling" bug that looked like a broken layout. Touch devices
therefore force 16px:

```css
@media (pointer: coarse) { input, textarea, select { font-size: 16px !important; } }
```

**Do not "fix" this with `user-scalable=no` or `maximum-scale=1`** — that trades a layout bug
for an accessibility one by killing pinch zoom. Both are asserted against in the spec.

## Icons

Category and UI icons are **Lucide 1.28.0** (ISC, <https://lucide.dev>), vendored verbatim
from its `icon-nodes.json`. Two sets: `CAT_GLYPHS` for categories, `UI_ICONS` plus
`uiIcon()` / `paintIcons()` for chrome. Markup carries `data-ico="<name>"` and `paintIcons()`
fills it — including after any `innerHTML` rebuild, which is why `go()` calls it.

- **Recognisable beats abstract.** Icons should read as the thing they label. Only
  "penetration" stays geometric, because a literal icon there would be explicit rather
  than clear.
- **No emoji as UI.** `README_brand.md` says so, and a colour emoji beside a monochrome
  wordmark reads cheap. Monochrome typographic marks (`✓ ✗ ★ ⚠`) are still fine — those are
  type, not pictograms. A spec sweeps every screen for pictographic emoji.
- An icon is always decoration beside a text label, never the only carrier of meaning.

## Nothing scrolls sideways that could wrap

The rating legend, result filters, and stat row **wrap**; they do not get `overflow-x: auto`.
A sideways scroll hides content behind an affordance nobody looks for, and under zoom it
hides most of it. Only the intentionally navigational category strip (`cat-nav`) may scroll.

## Theme

**Dark is the product default**, not a mirror of the OS: the app is read in bed and in
private, and a bright flash is the wrong first impression. A saved choice always wins.

## Layout floor

The app must not overflow horizontally down to a **240px** effective viewport. That is far
below any real device, but pinch-zoom and large system fonts shrink the effective width, and
a clipped back button was a real, reported bug. Mechanism: the nav title truncates and
disappears under 340px, the back label collapses to its arrow, and the stat row wraps to
2×2 rather than running off-screen. Pinned per width in the spec file.

## The profile card is an editorial sheet

The public card is fixed at **1080 × 1350 (4:5)**. It is not a column of dashboard cards:
one calm hero carries the name and QR, then aligned editorial sections carry the scale,
category distribution, highlights, and boundaries. The card closes with a single quiet line
rather than a large framed footer. Keep the hierarchy intact — there should be one clear
entry point for the eye, not competing boxes.

Hard limits are intentionally shareable on this card. They use the red semantic family and
are printed with a **HARD LIMITS** label; they must never look green or be hidden behind a
generic privacy promise. Activity notes and overall notes stay out of the public card and
its v5 QR.

Two layout invariants found the hard way:

- `.screen.on > *` forces `position: relative` onto every screen child and **beats
  `.fab`'s `position: fixed` on specificity** — the floating button silently became an
  in-flow block shifted past the left edge. The `.fab, .screen.on > .fab` selector pins it;
  keep that pairing if the screen rule ever changes.
- Banner action rows hold **at most two text buttons**; dismissal is the corner ×. Buttons
  never shrink below their label (`white-space: nowrap`, row wraps instead).

## The profile card

See **`docs/profile-card.md`** for the public/private data split, QR scan/import path,
fixed composition, and group-comparison rules.

Sharing: on a phone the card goes out via `navigator.share({ files: [...] })` so iOS offers
**Save Image** into the photo library. An `<a download>` always lands in Files or Drive
instead, which is useless for something meant to be posted; the download is the desktop
fallback only, and the button says which one this device will do.
