const { test, expect } = require('@playwright/test');

// Value: protects=the questionnaire column when moving from an activity to aftercare;
// fails_when=the last step expands across the viewport; seam=one synthetic category;
// no_claim=external sharing or feedback-service behavior.
for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  test(`aftercare retains the question column and navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('closr.onboard', '1');
      setHiddenCats(CATS.slice(1).map(cat => cat.id));
    });
    await page.getByRole('button', { name: 'Fill out my list', exact: false }).click();
    await page.locator('#s-setup button').filter({ hasText: 'Continue' }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.locator('.ov-act').last().click();
    const question = await page.locator('.q-head').boundingBox();
    await page.locator('.q-foot button').filter({ hasText: 'Skip' }).click();
    const card = page.locator('#cat-aftercare .ac-card');
    await expect(card).toBeVisible();
    async function expectColumn() {
      const aftercare = await card.boundingBox();
      const navigation = await page.locator('.fill-nav-btns').boundingBox();
      expect(aftercare.width).toBeLessThanOrEqual(460);
      expect(Math.abs(aftercare.x - question.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(aftercare.width - question.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(navigation.x - question.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(navigation.width - question.width)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
    await expectColumn();
    await page.locator('.ac-chip[data-ac-label="Water"]').click();
    await page.locator('#ac-share-checkbox').check();
    await page.getByRole('button', { name: '+ Add your own', exact: true }).click();
    await page.locator('.ac-input').fill('Synthetic comfort');
    await page.locator('.ac-input').press('Enter');
    await expect(page.locator('.ac-chip[data-ac-label="Water"]')).toHaveClass(/on/);
    await expect(page.locator('#ac-share-checkbox')).toBeChecked();
    await expect(page.getByRole('button', { name: 'Synthetic comfort', exact: false })).toBeVisible();
    await expectColumn();
    await page.locator('.fill-nav-btns button').first().click();
    await expect(page.locator('.q-head')).toBeVisible();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.locator('.ov-cat').last().click();
    await expectColumn();
    await expect(page.locator('#ac-share-checkbox')).toBeChecked();
    await page.getByRole('button', { name: 'Review & Share', exact: false }).click();
    await expect(page.locator('#s-review')).toHaveClass(/on/);
    const saved = await page.evaluate(() => loadDraft());
    expect(saved.aftercare).toEqual(['Water', 'Synthetic comfort']);
    expect(saved.aftercareInCode).toBe(true);
  });
}

// Value: protects=discoverable profile naming and persisted export identity;
// seam=synthetic name; fails_when=name can only be entered inside the hidden overview.
test('name is editable on Review, persists after reload and reaches the shared profile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { state.ratings = { 3: { s: 3, g: 0, r: 0, n: 'Synthetic note' } }; saveDraft(); goToReview(); });
  const name = page.locator('#s-review').getByLabel('Your name, shown on your card', { exact: true });
  await expect(name).toBeVisible();
  await name.fill('Alex');
  await expect(page.locator('#review-title')).toHaveText("Alex's list");
  await expect(page.locator('#s-review .fill-save-status').first()).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Edit categories', exact: true }).click();
  if (await page.locator('#s-onboard.on').count()) await page.locator('#ob-skip').click();
  await page.locator('#s-setup button').filter({ hasText: 'Continue' }).click();
  await page.locator('#s-fill .app-nav').getByRole('button', { name: 'Review', exact: false }).click();
  await expect(name).toHaveValue('Alex');
  expect(await page.evaluate(() => decode(profileQrCode()).name)).toBe('Alex');
  await page.locator('#s-review .app-nav button').click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('#name-input')).toHaveValue('Alex');
  await page.locator('#name-input').fill('Sam');
  await page.keyboard.press('Escape');
  await page.locator('#s-fill .app-nav').getByRole('button', { name: 'Review', exact: false }).click();
  await expect(name).toHaveValue('Sam');
  expect(await page.evaluate(() => loadDraft().ratings[3].n)).toBe('Synthetic note');
});
