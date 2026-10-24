const { test, expect } = require('@playwright/test');

// Phone metrics with touch, so `pointer: coarse` actually matches — that media query is
// what the fix hangs on, and a desktop context would pass this vacuously. Engine stays
// Chromium: WebKit cannot be installed on this host, and the assertion here is about the
// computed CSS a coarse pointer gets, not about Safari's zoom implementation itself.
test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => { await page.goto('/'); });

// iOS Safari zooms the page whenever a focused field computes under 16px, and it does not
// zoom back out — every screen after that first tap is left scaled and clipped. This was
// the actual root cause of the reported "scaling" problem; the nav clipping was a symptom.
test.describe('touch input never triggers iOS auto-zoom', () => {
  test('every focusable field computes at least 16px on a coarse pointer', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    // Reach the screens that own the remaining inputs so they are laid out and measurable.
    await page.evaluate(() => { state.ratings = { 3: { s: 3, g: 0, r: 0, n: '' } }; buildFillScreen(); buildReviewScreen(); goToCode(); });
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('input, textarea, select').forEach(el => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) out.push(`${String(el.className).slice(0, 24) || el.tagName}@${fs}px`);
      });
      return out;
    });
    expect(small, `fields iOS would zoom into: ${small.join(', ')}`).toEqual([]);
  });

  test('pinch zoom stays available — the fix must not be user-scalable=no', async ({ page }) => {
    await page.goto('/');
    const vp = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(vp).not.toMatch(/user-scalable\s*=\s*no/);
    expect(vp).not.toMatch(/maximum-scale\s*=\s*1/);
  });
});

test('a received code presents one action, not a row of competing buttons', async ({ page }) => {
  // The banner this replaces packed three buttons into a no-wrap row; at phone width they
  // shrank to 75px and broke their labels over four lines.
  const code = await page.evaluate(() => encode({ name: 'Mads', ratings: { 0: { s: 4, g: 0, r: 0, n: '' } } }));
  await page.evaluate(() => { state = { ...state, ratings: { 0: { s: 3, g: 0, r: 0, n: '' } } }; saveDraft(); });
  await page.goto('/#c=' + encodeURIComponent(code));
  await page.reload();
  // Full-width buttons stacked in one column: nothing has to shrink, so nothing wraps.
  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('#home-code-card .btn, #home-cta')].map(b => Math.round(b.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThan(0);
  heights.forEach(h => expect(h, 'a wrapped label makes the button tall').toBeLessThan(64));
  // The hero carries exactly one primary action, whatever state the page is in.
  expect(await page.locator('.l-actions .btn-primary:visible').count()).toBe(1);
});

test('the back-to-code button floats fixed at the content margin', async ({ page }) => {
  // .screen.on > * forces position:relative onto every screen child and silently beat the
  // .fab rule on specificity — the button sat in-flow at full width, shifted 20px past
  // the LEFT edge by its right:20px offset.
  await page.evaluate(() => {
    runComparison(decode(encode({ name: 'A', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } })),
                  decode(encode({ name: 'B', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } })));
  });
  const fab = await page.evaluate(() => {
    const f = document.querySelector('#s-results .fab');
    const r = f.getBoundingClientRect();
    return { pos: getComputedStyle(f).position, x: Math.round(r.x), right: Math.round(innerWidth - r.right), w: Math.round(r.width) };
  });
  expect(fab.pos).toBe('fixed');
  expect(fab.x).toBeGreaterThan(0);
  expect(fab.right).toBe(18);
  expect(fab.w).toBeLessThan(250);
});
