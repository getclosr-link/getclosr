const { test, expect } = require('@playwright/test');
const { compareCodes } = require('./helpers');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

async function code(page, profile) {
  return page.evaluate(p => encode(p), profile);
}

test.describe('group comparison card', () => {
  test('throws a clear error before any comparison exists, and the preview screen surfaces it', async ({ page }) => {
    const message = await page.evaluate(() => { try { buildGroupCard(); return null; } catch (e) { return e.message; } });
    expect(message).toBe('Compare two or more profiles first.');
    await page.evaluate(() => openGroupCardPreview());
    await expect(page.locator('#group-card-err')).toHaveClass(/show/);
    await expect(page.locator('#s-results')).not.toHaveClass(/on/);
    await expect(page.locator('#s-group-card-preview')).not.toHaveClass(/on/);
  });

  test('renders a fully backgrounded 1080 × 1440 canvas for two and for eight people', async ({ page }) => {
    const paint = async n => page.evaluate(count => {
      const people = Array.from({ length: count }, (_, i) => ({ name: `P${i + 1}`, ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
      currentComparison = getGroupComparison(people);
      const cv = buildGroupCard();
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
      return { w: cv.width, h: cv.height, painted, total: d.length / 4 };
    }, n);
    for (const n of [2, 8]) {
      const card = await paint(n);
      expect({ w: card.w, h: card.h }).toEqual({ w: 1080, h: 1440 });
      expect(card.painted).toBe(card.total);
    }
  });

  test('the pairwise grid is capped at 6 people and says how many more are not shown', async ({ page }) => {
    const drawn = await page.evaluate(() => {
      const people = Array.from({ length: 9 }, (_, i) => ({ name: `P${i + 1}`, ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
      currentComparison = getGroupComparison(people);
      const seen = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      buildGroupCard();
      CanvasRenderingContext2D.prototype.fillText = orig;
      return seen.join('\n');
    });
    // The hero's name chips legitimately show every participant (P1..P9) — only the
    // pairwise grid itself is capped, so scope the "not shown" check to that section.
    const matrixSection = drawn.slice(drawn.indexOf('WHO OVERLAPS WITH WHOM'));
    expect(matrixSection).toContain('P6');
    expect(matrixSection).not.toContain('P7');
    expect(matrixSection).toContain('+3 more not shown in this grid');
  });

  test('activity notes never reach the comparison card, even though they ride along in the ratings', async ({ page }) => {
    const drawn = await page.evaluate(() => {
      currentComparison = getGroupComparison([
        { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: 'private note about Alex' } } },
        { name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: 'private note about Sam' } } },
      ]);
      const seen = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      buildGroupCard();
      CanvasRenderingContext2D.prototype.fillText = orig;
      return seen.join('\n');
    });
    expect(drawn).toContain('Alex');
    expect(drawn).toContain('Sam');
    expect(drawn).not.toContain('private note');
  });

  test('a local nickname overrides the decoded name everywhere a name renders, including the card', async ({ page }) => {
    const a = await code(page, { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } });
    const b = await code(page, { name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } });
    await compareCodes(page, { code: a, label: 'My Nickname' }, b);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await expect(page.locator('#res-pair-label')).toHaveText('My Nickname & Sam');
    await expect(page.locator('#res-names')).toContainText('My Nickname');
    await expect(page.locator('#res-names')).not.toContainText('Alex');
    const drawn = await page.evaluate(() => {
      const seen = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
      buildGroupCard();
      CanvasRenderingContext2D.prototype.fillText = orig;
      return seen.join('\n');
    });
    expect(drawn).toContain('My Nickname');
    expect(drawn).not.toContain('Alex');
  });

  test('opens the exact rendered canvas in-browser before sharing it', async ({ page }) => {
    const a = await code(page, { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } });
    const b = await code(page, { name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } });
    await page.evaluate(({ a, b }) => runComparison(decode(a), decode(b)), { a, b });
    await page.click('#s-results button:has-text("Share")');
    await expect(page.locator('#share-sheet')).toHaveClass(/on/);
    await page.click('#share-tab-group');
    await expect(page.locator('#s-group-card-preview')).toHaveClass(/on/);
    const dims = await page.locator('#group-card-preview-canvas').evaluate(c => ({ w: c.width, h: c.height }));
    expect(dims.w).toBe(1080);
    expect(dims.h).toBeGreaterThan(0);
    await expect(page.locator('#group-card-share-btn')).toBeVisible();
  });
});

test.describe('saved constellations', () => {
  test('save, reload, and load reproduce the same codes, labels, and comparison', async ({ page }) => {
    const a = await code(page, { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } });
    const b = await code(page, { name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } });
    await compareCodes(page, { code: a, label: 'Nickname A' }, b);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await expect(page.locator('#res-save-constellation button')).toBeVisible();

    // Naming is an inline field now, not a native prompt.
    await page.click('#res-save-constellation button');
    await page.fill('#save-const-name', 'Weekly check-in');
    await page.click('.save-const-form button[type="submit"]');

    const saved = await page.evaluate(() => loadConstellations());
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('Weekly check-in');
    expect(saved[0].people).toEqual([{ code: a, label: 'Nickname A' }, { code: b, label: 'Sam' }]);

    await page.reload();
    expect(await page.evaluate(() => loadConstellations().length)).toBe(1);

    await expect(page.locator('.saved-const-row')).toContainText('Weekly check-in');
    await page.click('.saved-const-row button:has-text("Load")');
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await expect(page.locator('#res-names')).toContainText('Nickname A');
    await expect(page.locator('#res-names')).toContainText('Sam');

    await page.evaluate(() => go('home'));
    const id = saved[0].id;
    await page.evaluate(i => removeConstellation(i), id);
    expect(await page.evaluate(() => loadConstellations().length)).toBe(0);
    await expect(page.locator('.saved-const-row')).toHaveCount(0);
  });

  test('declining the save prompt does not persist a constellation', async ({ page }) => {
    const a = await code(page, { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } });
    const b = await code(page, { name: 'Sam', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } });
    await page.evaluate(({ a, b }) => runComparison(decode(a), decode(b)), { a, b });
    // This path (runComparison called directly, not via compareDirect) never set
    // currentComparisonInputs, so the save action must not even appear.
    await expect(page.locator('#res-save-constellation')).toBeEmpty();
  });
});

test.describe('comparison card QR', () => {
  const jsQR = require('jsqr');
  const people = [
    { name: 'Robin', overallNote: 'Talk first', hardLimits: 'No marks', aftercare: ['Cuddles'], ratings: { 3: { s: 3, g: 0, r: 0, n: 'only slowly' } } },
    { name: 'Sky', ratings: { 3: { s: 4, g: 0, r: 0, n: '' }, 5: { s: 2, g: 0, r: 0, n: '' } } },
    { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } },
  ];

  const qrOf = page => page.evaluate(() => {
    const card = buildGroupCard(), { x, y, size } = card.qrRect;
    return { size, pixels: Array.from(card.getContext('2d').getImageData(x, y, size, size).data), url: `${location.origin}/#c=${currentPublicGroupCode()}` };
  });

  test('decodes to a share-safe group code without comments, notes or aftercare', async ({ page }) => {
    await compareCodes(page, ...(await Promise.all(people.map(p => code(page, p)))));
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    const payload = await qrOf(page);
    const scanned = jsQR(Uint8ClampedArray.from(payload.pixels), payload.size, payload.size)?.data;
    expect(scanned).toBe(payload.url);
    const back = await page.evaluate(u => decodeGroup(decodeURIComponent(u.split('#c=')[1])), scanned);
    expect(back.map(p => p.name)).toEqual(['Robin', 'Sky', 'Alex']);
    expect(back.every(p => p.kind === 'profile' && p.overallNote === '' && p.aftercare.length === 0)).toBe(true);
    expect(back[0].hardLimits).toBe('No marks');
    expect(back[0].ratings[3]).toMatchObject({ s: 3, n: '' });
  });

  test('eight fully rated profiles still produce a decodable QR', async ({ page }) => {
    const many = await page.evaluate(() => {
      let seed = 7;
      const rnd = () => { seed = (seed * 48271) % 2147483647; return seed % 5; };
      return Array.from({ length: 8 }, (_, i) => ({ name: `Person ${i + 1}`, ratings: Object.fromEntries(profileActivityIds().map(id => [id, { s: rnd(), g: rnd(), r: rnd(), n: '' }])) }));
    });
    await compareCodes(page, ...(await Promise.all(many.map(p => code(page, p)))));
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    const payload = await qrOf(page);
    expect(jsQR(Uint8ClampedArray.from(payload.pixels), payload.size, payload.size)?.data).toBe(payload.url);
  });

  test('a scanned comparison QR offers to compare the group with your own list', async ({ page }) => {
    const group = await page.evaluate(ps => encodePublicGroup(ps), people);
    await page.goto('/#c=' + encodeURIComponent(group));
    await page.reload();
    const preview = page.locator('#home-code-preview');
    await expect(preview).toContainText('Public group profile · 3 profiles');
    await expect(preview).toContainText('No comments');
    await expect(preview).not.toContainText('complete private lists');
    await expect(preview.locator('.btn-primary')).toHaveText('Keep them and fill out my list first →');
  });
});

// Value: protects=truthful comparison persistence and retry; fails_when=quota failure reports success;
// why_new=existing save test has working storage; seam=none; no_claim=real quota exhaustion (injected).
test('comparison save retains the form on storage failure and retries exactly once', async ({ page }) => {
  const a = await code(page, { name: 'Alex', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } });
  const b = await code(page, { name: 'Sam', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } });
  await compareCodes(page, a, b);
  await page.click('#res-save-constellation button');
  await page.fill('#save-const-name', 'Synthetic comparison');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'closr.compare.saved.v1') throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    window.__restoreComparisonStorage = () => { Storage.prototype.setItem = original; };
  });
  await page.click('.save-const-form button[type="submit"]');
  await expect(page.locator('#res-save-constellation')).not.toContainText('Saved on this phone');
  await expect(page.locator('#res-save-constellation [role="status"]')).toContainText('Not saved');
  await expect(page.locator('#save-const-name')).toHaveValue('Synthetic comparison');
  expect(await page.evaluate(() => loadConstellations())).toEqual([]);
  await page.evaluate(() => window.__restoreComparisonStorage());
  await page.click('.save-const-form button[type="submit"]');
  await expect(page.locator('#res-save-constellation')).toContainText('Saved on this phone');
  await page.reload();
  const saved = await page.evaluate(() => loadConstellations());
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: 'Synthetic comparison', people: [{ code: a, label: 'Alex' }, { code: b, label: 'Sam' }] });
});
