# Profile sharing

The normal social export is a **1080 × 1440 px (3:4) profile card**, the tallest format
the Instagram feed shows uncropped. It is a fixed editorial sheet, not a long export of
the comparison screen: the name leads the card, followed by the rating scale and category
distribution. The last row holds the hard limits on the left and the QR panel ("Scan to
compare with me") on the right, then one quiet closing line. The comparison card uses the
same size and the same last row.

`buildProfileCard()` is the single renderer. It has no external assets and uses the local
Lucide node data in `CARD_ICONS` for its QR and boundary marks. Both light and dark themes
use the app's semantic rating palette: red for No, gold for Maybe, green for Yes, and
purple for Crave. Labels and counts remain visible so colour is never the
only signal.

## What is public

The owner intentionally publishes these fields on the card and in its QR profile:

- name;
- all 64 activity ratings in stable category order;
- hard limits (up to 280 UTF-8 bytes);
- opted-in aftercare preferences.

Activity notes and the overall note are deliberately absent. A posted card may be public;
those fields remain for a deliberate person-to-person share.

The review field displays a live UTF-8-byte counter for hard limits. A new over-limit paste
is rejected rather than silently shortened; an older over-limit draft remains editable until
the owner has reduced it.

## Code formats

All codes begin with `YNM-`. New codes carry no dashes. The decoder strips dashes and line
breaks, so v2, v3 and v4 codes saved earlier still read.

| Version | Purpose | Contents |
| --- | --- | --- |
| v2 / v3 | Legacy | Name, rated activities, activity notes; v3 can include opted-in aftercare. |
| v4 | Private full code (legacy) | Name, ratings, activity notes, opted-in aftercare, overall note, and hard limits. Still decoded, no longer written. |
| v5 | Public profile QR | Name, all fixed-order ratings, hard limits, and opted-in aftercare. No activity notes or overall note. |
| v6 | Private full code | Same contents as v4 in about half the length: an activity-id bitmask instead of one id byte per rating, one byte for rating and note flag, and deflate when it shortens the payload. Use only with someone deliberately trusted. |
| v7 | Group code | Two to eight complete v6 profiles in one code, compressed together. Pasting it reopens that comparison with only those people. |

v6 and v7 start with `[version, flags]`; flag bit 0 means the rest is raw deflate. The
deflate step uses a vendored subset of fflate (`deflateSync`, `inflateSync`) so decoding
stays synchronous while someone types. Activity ids address the ratings, so reordering
`CATS` does not break these codes (unlike v5).

`encodeProfile()` validates every v5 field before rendering the QR. The profile URL is kept
below the QR guard and malformed / oversized inputs fail locally with a concrete message;
the app never emits a blank or substitute QR.

## Share flow

On the code screen, **Preview share card** is the primary action. It opens the actual canvas
inside the browser first. The second action invokes `navigator.share({ files })` when the
platform can share a PNG file (so iOS can offer **Save Image**); desktop falls back to a PNG
download. The private v4 code is intentionally secondary, inside an expandable section.

The QR opens `/#c=<v5 code>`. `ingestSharedHash()` immediately removes the fragment from the
address bar and browser history, validates the code locally, and keeps it only in
`sessionStorage`. A visitor with a local draft can compare at once; another visitor can fill
out a list, paste an existing private code, or deliberately import the received profile.

## Import and groups

Replacing the local list is a confirmation flow, never a merge. Pasting a valid code into
the home screen's single code field first shows the kind of code, the name, and a checked
list of what it carries — ratings, comments, aftercare, hard limits. **Preview, then
replace** opens the confirmation, and only **Replace my local list** overwrites the draft.
The warning names the number of answers that would be lost.

Every comparison uses the same group engine. It accepts any number of profiles:

- an activity is **All together** only if every pair is directly compatible under the
  existing Self / Giving / Receiving matching rules;
- otherwise the result names the direct compatible pairs and does not fabricate an
  exponential list of possible combinations;
- each participant's rating remains visible, including No; a No does not erase a
  matching subgroup of other people;
- published hard limits appear in **Boundaries — read first**, before activity results.

On narrow screens the person matrix stacks vertically. Desktop cards use a responsive grid.

## Comparison card

**Get comparison card**, on the results screen, renders a second, separate share sheet for
the *comparison itself* — `buildGroupCard()`. It follows the same calm-editorial principle
as the profile card (one hero, then aligned sections, not a screenshot of the results list)
and the same fixed 1080 × 1440 (3:4) size. To fit, a 2-person card shows the category bars
and a card for three or more shows the pair grid in their place.

Sections, top to bottom:

- a hero with every participant's display name as a wrapped chip row (an 8th name onward
  collapses into a single **+N more** chip so the hero never grows unbounded);
- **Match summary** — the three on-screen result buckets (Gaps, Talking points, Matches),
  in the same red / gold / green tones as the results screen's own bucket chips and the
  profile card's rating scale — no new hue is introduced;
- **Where we overlap** (two people only) — the same stacked-bar primitive the profile card
  uses for one person's own rating levels, here fed the pair's match/discuss/gap split per
  category;
- **Who overlaps with whom** (three or more people) — a pairwise grid: for every pair, the percentage of activities
  where the group engine already resolved that specific pair to `match`, aggregated
  directly from `getGroupComparison()`'s own pairs (no separate matching pass). Capped at 6
  participants so cells stay legible; a larger group's grid says how many more people are
  not shown, rather than shrinking cells until they are unreadable;
- a last row shared with the profile card: **All together** (activities where every pair in
  the group reached `match`) on the left, the QR panel ("Scan to compare with us") on the
  right. The QR holds the public group code (v8): names, ratings and hard limits, without
  comments, notes or aftercare.

A local nickname (see below) is applied before this card is ever built, so it always shows
whatever this browser is currently displaying for that person — never a raw decoded name the
nickname was set to override.

The card itself does not show hard limits or aftercare — those stay in the app's own **Boundaries
— read first** and aftercare-overlap sections, and an individual's hard limits remain the
single profile card's responsibility to publish, not this one's. Per-activity and overall
notes never reach it: `getGroupComparison()`'s normalised profiles do not carry an overall
note at all, and the renderer never reads a rating's `.n` field.

## Local nicknames and saved comparisons

Accepting a code into the comparison queue takes an optional **local nickname** alongside
it. A nickname is never encoded anywhere — it overwrites only the decoded profile's `name`
in this browser, once, before the comparison runs, so every renderer that already prints a
person's name (the results header, activity pills, boundaries, the comparison card) shows it
with no further changes needed.

**Save this comparison** (shown after comparing from entered codes, not from a single
received-profile link) stores the current codes and nicknames — never anyone's ratings — as
a named entry in this browser under `closr.compare.saved.v1`, capped at 20 entries. The home
screen lists saved comparisons with **Load** (repopulates the code/nickname rows and reruns
the comparison immediately) and delete actions.

## Verification

`tests/specs/profile-card.spec.js` checks the fixed 1080 × 1440 size, card privacy split, v5 QR
payload, browser preview, semantic colours and image-file sharing. `codec.spec.js` covers
v2–v5 compatibility, hard-limit UTF-8 bounds, and v4/v5 data separation.
`sharing-group.spec.js` covers import cancellation/replacement, QR import, trios, two pairs,
unbounded group-engine inputs, hard-limit rendering, and mobile stacking.
`group-card.spec.js` covers the comparison card's dynamic height, the 6-person grid cap,
note exclusion, nickname override, the live preview-before-share flow, and the saved-
comparison save/reload/load/delete round trip.
