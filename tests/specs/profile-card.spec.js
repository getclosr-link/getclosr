const { test, expect } = require('@playwright/test');
const jsQR = require('jsqr');
const { compareCodes } = require('./helpers');

// A state with everything a card must separate correctly: notes and the overall note
// stay private; published hard limits and opted-in aftercare reach the public profile.
const RICH_STATE = {
  name: 'Alex',
  ratings: {
    1:  { s: 0, g: 4, r: 4, n: 'private note about massage' },
    3:  { s: 3, g: 0, r: 0, n: '' },
    19: { s: 0, g: 2, r: 3, n: 'another private note' },
    31: { s: 0, g: 1, r: 0, n: '' },
    53: { s: 4, g: 4, r: 4, n: '' },
  },
  overallNote: 'Slow starts, clear words.',
  hardLimits: 'SECRET-BOUNDARY',
  aftercare: ['Cuddling', 'Water'],
  aftercareInCode: true,
};

// The QR sits in a block at the end of the card; the card reports where it drew it.
const readCardQr = () => {
  const card = buildProfileCard(), { x, y, size } = card.qrRect;
  return { size, pixels: Array.from(card.getContext('2d').getImageData(x, y, size, size).data), url: `${location.origin}/#c=${profileQrCode()}` };
};

async function seedState(page, data) {
  await page.evaluate(d => { state = { ...state, ...d }; }, data);
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test.describe('profile QR code', () => {
  test('v5 strips notes but keeps ratings, name, aftercare and shared hard limits', async ({ page }) => {
    await seedState(page, RICH_STATE);
    const decoded = await page.evaluate(() => decode(profileQrCode()));
    expect(decoded).not.toBeNull();
    expect(decoded.name).toBe('Alex');
    expect(decoded.ratings[1]).toEqual({ s: 0, g: 4, r: 4, n: '' });
    expect(decoded.ratings[53]).toEqual({ s: 4, g: 4, r: 4, n: '' });
    expect(decoded.aftercare).toEqual(['Cuddling', 'Water']);
    expect(decoded.hardLimits).toBe('SECRET-BOUNDARY');
    expect(decoded.kind).toBe('profile');
    for (const rt of Object.values(decoded.ratings)) expect(rt.n).toBe('');
    expect(JSON.stringify(decoded)).not.toContain('private note');
    expect(JSON.stringify(decoded)).not.toContain('Slow starts');
  });

  test('a note-only item disappears from the QR payload entirely', async ({ page }) => {
    await seedState(page, { ratings: { 5: { s: 0, g: 0, r: 0, n: 'only a note' } } });
    const decoded = await page.evaluate(() => decode(profileQrCode()));
    expect(decoded.ratings[5]).toBeUndefined();
  });

  test('stays far below QR byte-mode capacity even fully rated with long notes', async ({ page }) => {
    await seedState(page, {
      ratings: Object.fromEntries(Array.from({ length: 70 }, (_, i) => [i, { s: 4, g: 4, r: 4, n: 'x'.repeat(60) }])),
    });
    const len = await page.evaluate(() => profileQrCode().length);
    expect(len).toBeLessThan(1200);
  });
});

test.describe('profile card PNG', () => {
  test('renders a fixed 1080 × 1440 (3:4) canvas with non-empty pixels', async ({ page }) => {
    await seedState(page, RICH_STATE);
    const res = await page.evaluate(() => {
      const cv = buildProfileCard();
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
      return { w: cv.width, h: cv.height, painted, total: d.length / 4 };
    });
    expect(res.w).toBe(1080);
    expect(res.h).toBe(1440);
    expect(res.painted).toBe(res.total); // fully backgrounded, nothing transparent
  });

  test('builds without craves, without a name, and with zero ratings', async ({ page }) => {
    await seedState(page, { name: '', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } }, overallNote: '', aftercare: [], aftercareInCode: false });
    expect(await page.evaluate(() => buildProfileCard().height)).toBe(1440);
    await seedState(page, { ratings: {} });
    expect(await page.evaluate(() => buildProfileCard().height)).toBe(1440);
  });

  test('preview button exists and the card includes boundaries but excludes private notes', async ({ page }) => {
    await expect(page.locator('#profile-card-btn')).toHaveCount(1);
    await seedState(page, RICH_STATE);
    // The card is a flat PNG; intercepting canvas text proves exactly which data was
    // intentionally made public in the share artifact.
    const drawn = await page.evaluate(() => {
      const seen = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      buildProfileCard();
      CanvasRenderingContext2D.prototype.fillText = orig;
      return seen.join('\n');
    });
    expect(drawn).toContain('Alex');
    expect(drawn).toContain('HARD LIMITS');
    expect(drawn).toContain('SECRET-BOUNDARY');
    expect(drawn).not.toContain('private note');
    expect(drawn).not.toContain('Slow starts');
  });

  test('opens the exact canvas in-browser before sharing it', async ({ page }) => {
    await seedState(page, RICH_STATE);
    await page.evaluate(() => goToCode());
    // Sharing now starts from one sheet that names what each option reveals; the deliberate
    // preview step behind it is unchanged.
    await page.click('#profile-card-btn');
    await expect(page.locator('#share-sheet')).toHaveClass(/on/);
    // Images sit under "Safe to post"; tapping one opens its preview directly.
    await expect(page.locator('#share-sheet')).toContainText('Safe to post');
    await page.click('#share-tab-profile');
    await expect(page.locator('#s-share-preview')).toHaveClass(/on/);
    const dimensions = await page.locator('#profile-card-preview-canvas').evaluate(c => ({ w: c.width, h: c.height }));
    expect(dimensions.w).toBe(1080);
    expect(dimensions.h).toBe(await page.evaluate(() => buildProfileCard().height));
    await expect(page.locator('#profile-card-share-btn')).toBeVisible();
  });

  test('the QR rendered into the card decodes back to its v5 profile URL', async ({ page }) => {
    await seedState(page, RICH_STATE);
    const payload = await page.evaluate(readCardQr);
    const decoded = jsQR(Uint8ClampedArray.from(payload.pixels), payload.size, payload.size);
    expect(decoded?.data).toBe(payload.url);
  });

  test('a maximum legal hard-limit profile still produces a decodable QR', async ({ page }) => {
    await seedState(page, {
      name: 'A'.repeat(40), hardLimits: 'x'.repeat(280),
      ratings: Object.fromEntries(Array.from({ length: 70 }, (_, id) => [id, { s: 4, g: 4, r: 4, n: '' }])),
      aftercare: ['x'.repeat(30), 'y'.repeat(30), 'z'.repeat(30)], aftercareInCode: true,
    });
    const payload = await page.evaluate(readCardQr);
    expect(jsQR(Uint8ClampedArray.from(payload.pixels), payload.size, payload.size)?.data).toBe(payload.url);
  });
});

test.describe('shared profile link (#c=…)', () => {
  test('valid hash lands in the one code field, cleans the URL and previews the contents', async ({ page }) => {
    const code = await page.evaluate(() => encode({ name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    // Full navigation, not goto from '/': a same-document hash change would skip boot.
    await page.goto('/#c=' + encodeURIComponent(code));
    await page.reload();
    await expect(page.locator('#home-code-card')).toBeVisible();
    await expect(page.locator('#home-code-arrived')).toBeVisible();
    await expect(page.locator('#home-code-input')).toHaveValue(code);
    // Decoded and described before the reader is asked to do anything with it.
    await expect(page.locator('#home-code-preview')).toContainText('Sam');
    expect(await page.evaluate(() => location.hash)).toBe('');
  });

  test('invalid hash is ignored: nothing opens, no crash, URL cleaned', async ({ page }) => {
    await page.goto('/#c=YNM-garbage');
    await page.reload();
    await expect(page.locator('#home-code-card')).toBeHidden();
    expect(await page.evaluate(() => location.hash)).toBe('');
    await expect(page.locator('#s-home')).toHaveClass(/on/);
  });

  test('discarding a received code empties the field and clears the stored code', async ({ page }) => {
    const code = await page.evaluate(() => encode({ name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    await page.goto('/#c=' + encodeURIComponent(code));
    await page.reload();
    await expect(page.locator('#home-code-arrived')).toBeVisible();
    await page.click('#home-code-preview [aria-label="Discard this code"]');
    await expect(page.locator('#home-code-input')).toHaveValue('');
    await expect(page.locator('#home-code-arrived')).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem('closr.sharedCode'))).toBeNull();
  });
});

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// Euclidean distance in OKLab x100 — the same measure used to pick these colours.
function deltaE(h1, h2) {
  const lab = hex => {
    const [r, g, b] = rgb(hex).map(v => v / 255)
      .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const [a, b] = [lab(h1), lab(h2)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
}

test.describe('rating scale colours', () => {

  // One palette since the 2026-10 redesign (dark only).
  {
    const dark = true;
    const mode = 'dark';

    test(`${mode}: "Not for me" is red, never green`, async ({ page }) => {
      const [r, g, b] = rgb((await page.evaluate(d => ratingTones(d), dark))[1].fg);
      // The whole point of the correction: a green "Not for me" is nonsense to a reader.
      expect(r, 'red channel must dominate').toBeGreaterThan(g + 40);
      expect(r).toBeGreaterThan(b + 40);
    });

    test(`${mode}: "Yes" is green and "Crave" is deliberately off that ramp`, async ({ page }) => {
      const tones = await page.evaluate(d => ratingTones(d), dark);
      const [r3, g3, b3] = rgb(tones[3].fg);
      expect(g3, '"Yes" should be green-dominant').toBeGreaterThan(r3);
      expect(g3).toBeGreaterThan(b3);

      // This used to require "Crave" to be green too, because the design system handed
      // both levels a green. That is exactly what made them read as one block, and the
      // app had already moved Crave to purple on screen while the card still drew it
      // green. Crave is now off the ramp everywhere: not green-dominant, and far enough
      // from "Yes" by the same OKLab ΔE metric the palette was chosen against.
      const [r4, g4, b4] = rgb(tones[4].fg);
      expect(g4, '"Crave" must not sit on the green ramp').toBeLessThan(Math.max(r4, b4));
      expect(deltaE(tones[3].fg, tones[4].fg)).toBeGreaterThan(15);
    });

    test(`${mode}: all four levels are distinct colours`, async ({ page }) => {
      const fgs = (await page.evaluate(d => ratingTones(d), dark)).slice(1).map(t => t.fg);
      // The original defect: two levels were byte-identical.
      expect(new Set(fgs).size).toBe(4);
    });
  }

  test('every bar segment prints its own count, so hue is never the only channel', async ({ page }) => {
    await seedState(page, RICH_STATE);
    const drawn = await page.evaluate(() => {
      const seen = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      buildProfileCard();
      CanvasRenderingContext2D.prototype.fillText = orig;
      return seen;
    });
    // Read from the app rather than hardcoded, so renaming the scale in one place cannot
    // leave this assertion silently checking words the card no longer prints.
    const words = await page.evaluate(() => RATING_WORDS.slice(1).map(w => w.toUpperCase()));
    words.forEach(k => expect(drawn).toContain(k));
    // Red and gold collapse under deuteranopia, so the digits are the accessible channel.
    expect(drawn.filter(t => /^[0-9]+$/.test(t)).length).toBeGreaterThan(3);
  });
});

test.describe('app defaults and sharing', () => {
  test('dark mode is the default for a first-time visitor', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  });

  test('dark is the only theme: a light choice saved by an older version is dropped', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('closr.theme', 'light'));
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    expect(await page.evaluate(() => localStorage.getItem('closr.theme'))).toBeNull();
  });

  test('the card is shared as a real image file where the platform supports it', async ({ page }) => {
    // iOS only offers "Save Image" for a shared File; an <a download> lands in Files.
    const shared = await page.evaluate(async () => {
      const calls = [];
      navigator.canShare = () => true;
      navigator.share = async d => { calls.push(d); };
      state.ratings = { 3: { s: 4, g: 0, r: 0, n: '' } };
      await downloadProfileCard();
      const f = calls[0] && calls[0].files && calls[0].files[0];
      return f ? { name: f.name, type: f.type, size: f.size } : null;
    });
    expect(shared).not.toBeNull();
    expect(shared.type).toBe('image/png');
    expect(shared.size).toBeGreaterThan(1000);
  });

  test('category icons come from the vendored library, not hand-drawn paths', async ({ page }) => {
    const ids = await page.evaluate(() => Object.keys(CAT_GLYPHS));
    expect(ids.length).toBeGreaterThanOrEqual(10);
    const markup = await page.evaluate(() => Object.values(CAT_GLYPHS).join(''));
    expect(markup).toMatch(/<(path|circle|rect|line|polyline)/);
  });
});

test.describe('layout survives narrow and zoomed viewports', () => {
  // Reported from a phone: the nav's back button was clipped at the right edge. Cause was
  // the centred title taking flex:1 with min-width auto, refusing to shrink and pushing the
  // actions off-screen. Pinch-zoom and large system fonts both shrink the effective
  // viewport, so the floor tested here is well below any real device width.
  for (const width of [430, 393, 375, 320, 280, 240]) {
    test(`${width}px: nothing overflows horizontally and back stays reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 880 });
      await page.goto('/');
      const a = await page.evaluate(() => encode({ name: 'Person A', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
      const b = await page.evaluate(() => encode({ name: 'Person B', ratings: { 3: { s: 1, g: 0, r: 0, n: '' } } }));
      await compareCodes(page, a, b);
      await expect(page.locator('#s-results')).toHaveClass(/on/);
      const r = await page.evaluate(() => {
        const offenders = [];
        document.querySelectorAll('*').forEach(el => {
          if (el.closest('.l-fields, .q-fields, .res-fields')) return; // aria-hidden colour fields, clipped by their own box
          const box = el.getBoundingClientRect();
          if (box.width > 0 && box.right > window.innerWidth + 1) offenders.push(String(el.className).slice(0, 30) || el.tagName);
        });
        const back = document.querySelector('#s-results .btn-ghost');
        return { hScroll: document.documentElement.scrollWidth - window.innerWidth, offenders,
                 backWidth: back ? back.getBoundingClientRect().width : 0 };
      });
      expect(r.offenders, `elements past the right edge: ${r.offenders.join(', ')}`).toEqual([]);
      expect(r.hScroll).toBeLessThanOrEqual(0);
      expect(r.backWidth).toBeGreaterThan(0);
    });
  }
});

test.describe('icons are library icons, not emoji', () => {
  test('there is no theme toggle any more', async ({ page }) => {
    expect(await page.locator('.theme-btn').count()).toBe(0);
    expect(await page.evaluate(() => typeof window.toggleTheme)).toBe('undefined');
  });

  test('no pictographic emoji is used as UI on any screen', async ({ page }) => {
    // README_brand.md: emoji are not used as UI. Monochrome typographic marks (✓ ✗ ★ ⚠)
    // are explicitly allowed, so only the pictographic ranges are checked.
    const hits = await page.evaluate(() => {
      const re = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}]/u;
      const out = [];
      document.querySelectorAll('.screen, .app-nav').forEach(el => {
        const m = el.innerText.match(re);
        if (m) out.push(`${el.id || el.className}: ${m[0]}`);
      });
      return out;
    });
    expect(hits, `emoji found: ${hits.join(', ')}`).toEqual([]);
  });

  test('every icon placeholder gets painted, on boot and after a rebuild', async ({ page }) => {
    const unpainted = () => page.evaluate(() =>
      [...document.querySelectorAll('[data-ico]')].filter(e => !e.firstElementChild).map(e => e.dataset.ico));
    expect(await unpainted()).toEqual([]);
    // The onboarding cards write their own markup, so their spans appear after paint.
    await page.evaluate(() => { buildOnboard(); go('onboard'); obStep = 2; renderObCard(); });
    expect(await unpainted()).toEqual([]);
    expect(await page.evaluate(() => document.querySelector('.onboard-icon').innerHTML)).toContain('<svg');
  });
});

test.describe('one question per screen', () => {
  for (const width of [393, 320, 260]) {
    test(`${width}px: the four answers fit without horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 880 });
      await page.goto('/');
      await page.evaluate(() => { buildFillScreen(); go('fill'); });
      const r = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('#s-fill .q-opt')];
        return { count: opts.length, overflow: opts.some(o => o.getBoundingClientRect().right > window.innerWidth + 1),
                 hScroll: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(r.count).toBe(4);
      expect(r.overflow).toBe(false);
      expect(r.hScroll).toBeLessThanOrEqual(0);
    });
  }

  test('answering every context moves on to the next activity', async ({ page }) => {
    await page.evaluate(() => { localStorage.clear(); state.ratings = {}; state.activeCatId = 'affection'; state.activeItemIdx = 0; buildFillScreen(); go('fill'); });
    await expect(page.locator('#s-fill .q-title')).toHaveText('Holding hands');
    await page.locator('#s-fill .q-opt', { hasText: 'Yes' }).click();
    expect(await page.evaluate(() => state.ratings[0].s)).toBe(3);
    await expect(page.locator('#s-fill .q-title')).toHaveText('Massage');
    // Massage has Giving and Receiving: the first answer switches the tab, the second moves on.
    await page.locator('#s-fill .q-opt', { hasText: 'Crave' }).click();
    await expect(page.locator('#s-fill .q-ctx-tab.on')).toContainText('Receiving');
    await page.locator('#s-fill .q-opt', { hasText: 'No' }).click();
    await expect(page.locator('#s-fill .q-title')).toHaveText('Sensual massage');
    expect(await page.evaluate(() => [state.ratings[1].g, state.ratings[1].r])).toEqual([4, 1]);
  });

  test('the overview lists every category and jumps to an activity', async ({ page }) => {
    await page.evaluate(() => { state.ratings = { 0: { s: 3, g: 0, r: 0, n: '' } }; state.activeCatId = 'affection'; state.activeItemIdx = 0; buildFillScreen(); go('fill'); openFillOverview(); });
    await expect(page.locator('#fill-overview')).toBeVisible();
    expect(await page.locator('#fill-overview .ov-cat').count()).toBe(await page.evaluate(() => visibleCats().length + 1));
    await expect(page.locator('#fill-overview .ov-act').first()).toContainText('Yes');
    await page.locator('#fill-overview .ov-act', { hasText: 'Kissing' }).first().click();
    await expect(page.locator('#fill-overview')).toBeHidden();
    await expect(page.locator('#s-fill .q-title')).toHaveText('Kissing');
  });
});

test.describe('scan landing offers what this browser already has', () => {
  const MADS = { name: 'Mads', ratings: { 0: { s: 4, g: 0, r: 0, n: '' }, 3: { s: 3, g: 0, r: 0, n: '' } } };

  test('no draft: offers fill-out AND paste-my-code, which preloads direct compare', async ({ page }) => {
    const code = await page.evaluate(d => encode(d), MADS);
    await page.goto('/#c=' + encodeURIComponent(code));
    await page.reload();
    // With no list of their own, the one action is still to fill one out — but the
    // received profile is already decoded and waiting rather than demanding a decision.
    await expect(page.locator('#home-cta')).toHaveText(/Fill out my list/);
    await expect(page.locator('#home-code-input')).toHaveValue(code);
    await expect(page.locator('#home-code-preview')).toContainText('Mads');
  });

  test('with a rated draft: one tap from landing to results', async ({ page }) => {
    await page.evaluate(() => { state = { ...state, name: 'Robin', ratings: { 0: { s: 3, g: 0, r: 0, n: '' } } }; saveDraft(); });
    const code = await page.evaluate(d => encode(d), MADS);
    await page.goto('/#c=' + encodeURIComponent(code));
    await page.reload();
    // The half-baked path this replaces: the banner only offered "fill out mine" even
    // though a rated draft was sitting in localStorage. Now the single action is the
    // comparison itself.
    await expect(page.locator('#home-cta')).toHaveText(/Compare with Mads/);
    await page.click('#home-cta');
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await expect(page.locator('#res-pair-label')).toContainText('Robin & Mads');
  });
});


test.describe('card pictograms and information hierarchy', () => {
  test('the icon set is vendored and the editorial close is drawn with boundaries', async ({ page }) => {
    await seedState(page, RICH_STATE);
    const r = await page.evaluate(() => {
      const seen = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      buildProfileCard();
      CanvasRenderingContext2D.prototype.fillText = orig;
      return { icons: Object.keys(CARD_ICONS), text: seen.join('\n') };
    });
    expect(r.icons.sort()).toEqual(['heart-handshake', 'scan-line', 'server-off', 'shield-check']);
    expect(r.text).toContain('HARD LIMITS');
    expect(r.text).toContain('Compare with care · getclosr.link · no account, no server');
  });
});

// Value: protects=share cards with no published limits; seam=synthetic profile;
// fails_when=an empty warning panel is drawn or its QR stops decoding.
for (const limits of ['', '  \n  ', undefined]) {
  test(`profile card omits empty hard limits: ${JSON.stringify(limits)}`, async ({ page }) => {
    await seedState(page, { name: 'Alex', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } }, hardLimits: limits });
    const rendered = await page.evaluate(() => {
      const seen = [], original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { seen.push(String(text)); return original.call(this, text, ...args); };
      let card;
      try { card = buildProfileCard(); } finally { CanvasRenderingContext2D.prototype.fillText = original; }
      return { text: seen.join('\n'), pixel: [...card.getContext('2d').getImageData(80, 1100, 1, 1).data], qr: card.qrRect, width: card.width };
    });
    expect(rendered.text).not.toContain('HARD LIMITS');
    expect(rendered.text).not.toContain('No hard limits');
    expect(rendered.pixel).toEqual([28, 26, 62, 255]);
    expect(rendered.qr.x + rendered.qr.size / 2).toBe(rendered.width / 2);
    const payload = await page.evaluate(readCardQr);
    const decoded = jsQR(Uint8ClampedArray.from(payload.pixels), payload.size, payload.size);
    expect(decoded?.data).toBe(payload.url);
  });
}
