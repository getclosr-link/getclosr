const { test, expect } = require('@playwright/test');
const { compareCodes } = require('./helpers');
test.beforeEach(async ({ page }) => { await page.goto('/'); });

// Value: protects=keyboard access to category choices, result filters and disclosures;
// seam=synthetic profiles; no_claim=screen-reader usability certification.
test('category choices work with Enter and Space and expose their selected state', async ({ page }) => {
  await page.evaluate(() => { buildSetupScreen(); go('setup'); });
  const category = page.locator('.cat-item').first();
  await expect(category).toHaveAttribute('aria-pressed', /^(true|false)$/);
  const selected = await category.getAttribute('aria-pressed');
  await category.focus();
  await page.keyboard.press('Enter');
  await expect(category).toHaveAttribute('aria-pressed', String(selected !== 'true'));
  await page.keyboard.press('Space');
  await expect(category).toHaveAttribute('aria-pressed', selected);
});

test('summary filters and activity disclosures work from the keyboard', async ({ page }) => {
  const codes = await page.evaluate(() => ['Alex', 'Sam'].map(name => encode({ name,
    ratings: { 3: { s: 3, g: 0, r: 0, n: 'Synthetic comment' } } })));
  await compareCodes(page, ...codes);
  const summary = page.locator('#res-summary .sum-card.match');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.matrix-row').first()).toBeVisible();
  const disclosure = page.locator('.matrix-row-head').first();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  const detailsId = await disclosure.getAttribute('aria-controls');
  await disclosure.focus();
  await page.keyboard.press('Space');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#' + detailsId)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#' + detailsId)).toBeHidden();
});

async function openDialog(page, kind) {
  await page.route('https://buymeacoffee.com/**', route => route.fulfill({ body: 'Synthetic widget' }));
  if (kind === 'coffee-sheet') {
    const opener = page.locator('.l-footer a.bmc-link');
    await opener.click(); return opener;
  }
  await page.evaluate(() => {
    state.name = 'Alex'; state.ratings = { 3: { s: 3, g: 0, r: 0, n: '' } }; saveDraft();
  });
  if (kind === 'share-sheet') {
    await page.evaluate(() => goToCode());
    const opener = page.locator('#profile-card-btn');
    await opener.click(); return opener;
  }
  if (kind === 'fill-overview') {
    await page.evaluate(() => resumeDraft());
    const opener = page.getByRole('button', { name: 'Overview', exact: true });
    await opener.click(); return opener;
  }
  await page.locator('#home-code-toggle').click();
  const code = await page.evaluate(() => encode({ name: 'Sam', ratings: { 5: { s: 4, g: 0, r: 0, n: '' } } }));
  await page.locator('#home-code-input').fill(code);
  const opener = page.locator('#home-code-mine');
  await opener.click(); return opener;
}

for (const kind of ['share-sheet', 'import-modal', 'coffee-sheet', 'fill-overview']) {
  test(`${kind} moves, contains and restores keyboard focus`, async ({ page }) => {
    const opener = await openDialog(page, kind);
    const dialog = page.locator('#' + kind);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    expect(await dialog.evaluate(el => !!el.closest('[inert]'))).toBe(false);
    const focusable = dialog.locator('button:visible:not([disabled]), a[href]:visible, input:visible, textarea:visible, iframe:visible');
    await focusable.last().focus();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await focusable.first().focus();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(await page.locator('#s-home').evaluate(el => el.inert)).toBe(false);
  });
}

test('share content rerender keeps focus on the switch and restores existing inert state', async ({ page }) => {
  await page.evaluate(() => {
    const marker = document.createElement('div'); marker.id = 'already-inert'; marker.inert = true; document.body.appendChild(marker);
    state.name = 'Alex'; state.ratings = { 3: { s: 3, g: 0, r: 0, n: 'Synthetic comment' } }; goToCode();
  });
  await page.locator('#profile-card-btn').click();
  await page.locator('#share-tab-code').click();
  const sw = page.locator('#share-part-code-notes');
  await sw.focus(); await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(sw).toBeFocused();
  await page.keyboard.press('Escape');
  expect(await page.locator('#already-inert').evaluate(el => el.inert)).toBe(true);
});
