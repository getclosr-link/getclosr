const { test, expect } = require('@playwright/test');
const { queueCodes } = require('./helpers');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

async function code(page, profile, kind = 'private') {
  return page.evaluate(({ profile, kind }) => kind === 'profile' ? encodeProfile(profile) : encode(profile), { profile, kind });
}

// Opens the replace-my-list modal the way a reader reaches it: paste into the one code
// field, then take the deliberate second step out of the preview.
async function queueCodesForReplace(page, incoming) {
  const toggle = page.locator('#home-code-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await page.fill('#home-code-input', incoming);
  await page.click('#home-code-mine');
}

test.describe('explicit import', () => {
  test('previewing and cancelling an import never touches the local draft', async ({ page }) => {
    const incoming = await code(page, { name: 'Imported', hardLimits: 'No breath play', ratings: { 3: { s: 4, g: 0, r: 0, n: 'private' } } });
    await page.evaluate(() => { state = { ...state, name: 'Keep me', ratings: { 5: { s: 3, g: 0, r: 0, n: '' } } }; saveDraft(); });
    await queueCodesForReplace(page, incoming);
    await expect(page.locator('#import-preview')).toContainText('Imported');
    expect(await page.evaluate(() => state.name)).toBe('Keep me');
    await page.click('#import-modal button:has-text("Cancel")');
    expect(await page.evaluate(() => state.name)).toBe('Keep me');
  });

  test('confirmation intentionally replaces the complete local draft', async ({ page }) => {
    const incoming = await code(page, { name: 'Imported', hardLimits: 'No breath play', overallNote: 'Start slowly', aftercareInCode: true, aftercare: ['Water'], ratings: { 3: { s: 4, g: 0, r: 0, n: 'private note' } } });
    await page.evaluate(() => { state = { ...state, name: 'Old', ratings: { 5: { s: 3, g: 0, r: 0, n: '' } } }; saveDraft(); });
    await queueCodesForReplace(page, incoming);
    await page.click('#confirm-import-btn');
    await expect(page.locator('#s-review')).toHaveClass(/on/);
    const imported = await page.evaluate(() => ({ name: state.name, hardLimits: state.hardLimits, overallNote: state.overallNote, note: state.ratings[3].n, old: state.ratings[5] }));
    expect(imported).toEqual({ name: 'Imported', hardLimits: 'No breath play', overallNote: 'Start slowly', note: 'private note', old: undefined });
  });

  test('a scanned v5 profile can be consciously imported after the hash is removed', async ({ page }) => {
    const profile = await code(page, { name: 'Sam', hardLimits: 'No choking', ratings: { 3: { s: 3, g: 0, r: 0, n: 'never public' } } }, 'profile');
    await page.goto('/#c=' + encodeURIComponent(profile));
    await page.reload();
    expect(await page.evaluate(() => location.hash)).toBe('');
    // The scanned code is already sitting in the one code field; replacing is the
    // deliberate second step behind its own confirm.
    await page.click('#home-code-preview button:has-text("Preview, then replace")');
    await expect(page.locator('#import-preview')).toContainText('Sam');
    await page.click('#confirm-import-btn');
    expect(await page.evaluate(() => ({ name: state.name, note: state.ratings[3].n, limits: state.hardLimits }))).toEqual({ name: 'Sam', note: '', limits: 'No choking' });
  });
});

test.describe('group comparison', () => {
  test('renders all-together rows, direct pairs, and every published boundary', async ({ page }) => {
    const profiles = [
      { name: 'A', hardLimits: 'A boundary', ratings: { 3: { s: 3, g: 0, r: 0, n: '' }, 5: { s: 3, g: 0, r: 0, n: '' } } },
      { name: 'B', ratings: { 3: { s: 4, g: 0, r: 0, n: '' }, 5: { s: 3, g: 0, r: 0, n: '' } } },
      { name: 'C', hardLimits: 'C boundary', ratings: { 3: { s: 3, g: 0, r: 0, n: '' }, 5: { s: 1, g: 0, r: 0, n: '' } } },
    ];
    await page.evaluate(ps => runComparison(...ps), profiles);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    // Boundaries sit above the tabs — they are read before anything is chosen.
    await expect(page.locator('#res-boundaries')).toContainText('A boundary');
    await expect(page.locator('#res-boundaries')).toContainText('C boundary');
    // The per-activity list lives on the Activities tab; Overview is what opens first.
    await page.click('#res-tab-list');
    await expect(page.locator('#res-body')).toContainText('All together');
    const partial = page.locator('.matrix-row', { hasText: 'Direct matches:' }).filter({ hasText: 'A + B' });
    await expect(partial).toHaveCount(1);
    await expect(partial).toContainText('C');
    // C rated this a hard no. Asserted on the level-1 chip rather than the bare word, so
    // a two-letter label like "No" cannot pass by matching other text in the row.
    // Scoped to the collapsed head: the expanded axis breakdown carries its own chips.
    const noChip = partial.locator('.matrix-cells .res-chip.r1');
    await expect(noChip).toHaveCount(1);
    await expect(noChip).toContainText('No');
  });

  test('two pairs are surfaced without fabricating combinations', async ({ page }) => {
    const profiles = [
      { name: 'A', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } },
      { name: 'B', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } },
      { name: 'C', ratings: { 5: { s: 3, g: 0, r: 0, n: '' } } },
      { name: 'D', ratings: { 5: { s: 3, g: 0, r: 0, n: '' } } },
    ];
    await page.evaluate(ps => runComparison(...ps), profiles);
    await page.click('#res-tab-list');
    await expect(page.locator('#res-body')).toContainText('A + B');
    await expect(page.locator('#res-body')).toContainText('C + D');
    await expect(page.locator('#res-body')).not.toContainText('All together: every pair is compatible.');
  });

  test('the UI accepts extra profiles and no participant cap exists in the engine', async ({ page }) => {
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push(await code(page, { name: `Q${i}`, ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    await queueCodes(page, ...codes);
    // Every accepted code becomes a chip; "You" is the first one, so three codes make four.
    expect(await page.locator('#home-queue .home-chip').count()).toBe(4);
    const count = await page.evaluate(() => {
      const people = Array.from({ length: 9 }, (_, i) => ({ name: `P${i + 1}`, ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
      const result = getGroupComparison(people);
      return { people: result.profiles.length, cells: result.buckets.match[0].ratings.length, all: result.buckets.match[0].allTogether };
    });
    expect(count).toEqual({ people: 9, cells: 9, all: true });
  });
});

test.describe('group code', () => {
  const people = [
    { name: 'Robin', overallNote: 'Talk first', ratings: { 3: { s: 3, g: 0, r: 0, n: 'only slowly' } } },
    { name: 'Sky', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } },
  ];

  test('pasting a group code opens exactly the comparison it holds, even with an own list', async ({ page }) => {
    const group = await page.evaluate(ps => encodeGroup(ps), people);
    await page.evaluate(() => { state = { ...state, name: 'Me', ratings: { 5: { s: 3, g: 0, r: 0, n: '' } } }; saveDraft(); refreshHomeScreen(); });
    await page.click('#home-code-toggle');
    await page.fill('#home-code-input', group);
    await expect(page.locator('#home-code-preview')).toContainText('Group code · 2 profiles');
    await expect(page.locator('#home-cta')).toHaveText('Open Robin + Sky →');
    await page.click('#home-code-preview button:has-text("Open Robin + Sky")');
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await expect(page.locator('#res-pair-label')).toHaveText('Robin & Sky');
  });

  test('the comparison can be shared back as a group code that reopens it', async ({ page }) => {
    await queueCodes(page, ...(await Promise.all(people.map(p => code(page, p)))));
    await page.click('#home-cta');
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await page.click('#s-results .res-share-btn');
    await page.click('#share-tab-groupcode');
    const shown = await page.locator('#group-code-display').textContent();
    const back = await page.evaluate(c => decodeGroup(c), shown);
    expect(back.map(p => p.name)).toEqual(['Robin', 'Sky']);
    expect(back[0]).toMatchObject({ overallNote: 'Talk first', ratings: { 3: { n: 'only slowly' } } });
  });

  test('without an own list, sharing a group offers only group items and group wording', async ({ page }) => {
    const three = [...people, { name: 'Alex', ratings: { 3: { s: 4, g: 0, r: 0, n: '' } } }];
    const group = await page.evaluate(ps => encodeGroup(ps), three);
    await page.click('#home-code-toggle');
    await page.fill('#home-code-input', group);
    await page.click('#home-code-preview button:has-text("Open")');
    await expect(page.locator('#res-title')).toHaveText('Your group');
    await page.click('#s-results .res-share-btn');
    await expect(page.locator('#share-tab-profile')).toHaveCount(0);
    await expect(page.locator('#share-tab-group')).toContainText('Our group image');
    await page.click('#share-tab-group');
    await expect(page.locator('#s-group-card-preview')).toHaveClass(/on/);
    const blob = await page.evaluate(async () => (await groupCardBlob()).size);
    expect(blob).toBeGreaterThan(1000);
  });

  test('a group code arriving as a link lands in the code field', async ({ page }) => {
    const group = await page.evaluate(ps => encodeGroup(ps), people);
    await page.goto('/#c=' + encodeURIComponent(group));
    await page.reload();
    await expect(page.locator('#home-code-preview')).toContainText('Group code · 2 profiles');
  });
});

test('hard-limit field has a live byte count and rejects a too-long paste without truncating it into a code', async ({ page }) => {
  await page.evaluate(() => { buildReviewScreen(); go('review'); });
  const field = page.locator('#hard-limits');
  await field.fill('x'.repeat(280));
  await expect(page.locator('#hard-limits-count')).toContainText('280 / 280');
  await field.fill('x'.repeat(281));
  await expect(page.locator('#hard-limits-error')).toContainText('280 UTF-8 bytes');
  expect(await field.inputValue()).toBe('x'.repeat(280));
});

test.describe('choosing what goes into a code', () => {
  const robin = { name: 'Robin', overallNote: 'Talk first', hardLimits: 'No marks', aftercare: ['Water'], aftercareInCode: true, ratings: { 3: { s: 3, g: 0, r: 0, n: 'ask first' }, 5: { s: 4, g: 0, r: 0, n: '' } } };

  test('switching parts off rebuilds the private code without them, and reopening starts from everything', async ({ page }) => {
    await page.evaluate(p => { state = { ...state, ...p }; saveDraft(); openShareSheet(); }, robin);
    await page.click('#share-tab-code');
    await expect(page.locator('#share-part-code-notes')).toHaveAttribute('aria-checked', 'true');
    await page.click('#share-part-code-notes');
    await page.click('#share-part-code-limits');
    await expect(page.locator('#share-parts-warn')).toHaveText('Comments and hard limits stay on this device.');
    const shown = await page.locator('#my-code-display').textContent();
    const back = await page.evaluate(c => decode(c), shown);
    expect(back).toMatchObject({ name: 'Robin', overallNote: 'Talk first', hardLimits: '', aftercare: ['Water'] });
    expect(back.ratings[3]).toMatchObject({ s: 3, n: '' });
    await page.evaluate(() => { closeShareSheet(); openShareSheet('code'); });
    await expect(page.locator('#share-part-code-notes')).toHaveAttribute('aria-checked', 'true');
  });

  test('the group code has the same switches and applies them to everyone in it', async ({ page }) => {
    const sky = { name: 'Sky', overallNote: 'Slow is fine', ratings: { 3: { s: 4, g: 0, r: 0, n: 'yes please' } } };
    await queueCodes(page, ...(await Promise.all([robin, sky].map(p => code(page, p)))));
    await page.click('#home-cta');
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await page.click('#s-results .res-share-btn');
    await page.click('#share-tab-groupcode');
    await expect(page.locator('#share-part-groupcode-notes')).toHaveText('✓ Comments');
    await page.click('#share-part-groupcode-notes');
    await page.click('#share-part-groupcode-overall');
    const back = await page.evaluate(c => decodeGroup(c), await page.locator('#group-code-display').textContent());
    expect(back.map(p => [p.name, p.overallNote, p.ratings[3].n])).toEqual([['Robin', '', ''], ['Sky', '', '']]);
    expect(back[0].hardLimits).toBe('No marks');
  });
});

test.describe('your own code', () => {
  const robin = { name: 'Robin', overallNote: 'Talk first', ratings: { 3: { s: 3, g: 0, r: 0, n: 'ask first' } } };

  test('on an empty device it asks whether the code is yours and restores it', async ({ page }) => {
    const mine = await code(page, robin);
    await page.click('#home-code-toggle');
    await page.fill('#home-code-input', mine);
    await expect(page.locator('#home-code-preview')).toContainText('Whose list is this?');
    await expect(page.locator('#home-code-theirs')).toHaveText("Robin's");
    await expect(page.locator('#home-code-note')).toBeHidden();
    await page.click('#home-code-mine');
    await expect(page.locator('#s-review')).toHaveClass(/on/);
    expect(await page.evaluate(() => ({ name: state.name, note: state.ratings[3].n, overall: state.overallNote }))).toEqual({ name: 'Robin', note: 'ask first', overall: 'Talk first' });
  });

  test('a code identical to the list on this device is recognised as your own', async ({ page }) => {
    await page.evaluate(p => { state = { ...state, ...p }; saveDraft(); refreshHomeScreen(); }, robin);
    const mine = await page.evaluate(() => encode(state));
    await page.click('#home-code-toggle');
    await page.fill('#home-code-input', mine);
    await expect(page.locator('#home-code-preview .code-card-tag')).toHaveText('Your own list');
    await expect(page.locator('#home-code-preview')).toContainText('Same as the list on this device');
    await page.reload();
    await page.click('#home-code-toggle');
    await page.fill('#home-code-input', mine);
    await page.getByRole('button', { name: 'Edit my list', exact: true }).click();
    await expect(page.locator('#review-title')).toContainText(robin.name);
    await page.fill('#review-note', 'Updated synthetic note');
    const saved = await page.evaluate(() => loadDraft());
    expect(saved).toMatchObject({ ...robin, overallNote: 'Updated synthetic note' });
  });

  test('with a different list on the device, "Mine" warns and "Robin\'s" leads to comparing', async ({ page }) => {
    await page.evaluate(() => { state = { ...state, name: 'Me', ratings: { 5: { s: 3, g: 0, r: 0, n: '' } } }; saveDraft(); refreshHomeScreen(); });
    const other = await code(page, robin);
    await page.click('#home-code-toggle');
    await page.fill('#home-code-input', other);
    await expect(page.locator('#home-code-preview')).toContainText('Mine replaces the 1 answer on this device.');
    await page.click('#home-code-theirs');
    await expect(page.locator('#home-nick')).toBeVisible();
    await expect(page.locator('#home-code-preview .btn-primary')).toHaveText('Compare with Robin →');
  });
});

// Value: protects=stored answers when the draft vanishes; fails_when=Edit opens an empty profile;
// why_new=own-code happy path cannot cover missing storage; seam=none; no_claim=multi-tab timing.
test('own-code edit handles a draft removed after preview without saving an empty list', async ({ page }) => {
  const ownCode = await page.evaluate(() => {
    state = { ...state, name: 'Alex', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } };
    saveDraft();
    return encode(state);
  });
  await page.reload();
  await page.click('#home-code-toggle');
  await page.fill('#home-code-input', ownCode);
  await page.evaluate(() => localStorage.removeItem('closr.draft.v1'));
  await page.getByRole('button', { name: 'Edit my list', exact: true }).click();
  await expect(page.locator('#s-home')).toHaveClass(/on/);
  await expect(page.locator('#home-code-preview')).toContainText('saved list is no longer available');
  expect(await page.evaluate(() => loadDraft())).toBeNull();
});

// Value: protects=recovery from oversized group exports; fails_when=invalid code is copyable or row vanishes;
// why_new=codec rejection alone does not verify the share UI; seam=none; no_claim=OS clipboard integration.
test('oversized group stays in the share sheet and content switches recover a readable code', async ({ page }) => {
  const { largeProfiles, compareCodes } = require('./helpers');
  const profiles = largeProfiles(await page.evaluate(() => profileActivityIds()));
  const codes = await page.evaluate(ps => ps.map(encode), profiles);
  await compareCodes(page, ...codes);
  await page.evaluate(() => openShareSheet('groupcode'));
  await expect(page.locator('#share-tab-groupcode')).toBeVisible();
  await expect(page.locator('#share-sheet')).toContainText('too long to share');
  await expect(page.locator('#share-sheet-primary')).toBeDisabled();
  await page.click('#share-part-groupcode-notes');
  await page.click('#share-part-groupcode-overall');
  await expect(page.locator('#share-sheet-primary')).toBeEnabled();
  const exported = await page.locator('#group-code-display').innerText();
  expect(await page.evaluate(c => decodeGroup(c).map(p => ({ name: p.name, notes: Object.values(p.ratings).map(rt => rt.n), overall: p.overallNote })), exported))
    .toEqual(profiles.map(p => ({ name: p.name, notes: Object.keys(p.ratings).map(() => ''), overall: '' })));
  expect(await page.evaluate(() => currentComparisonInputs.map(p => p.code))).toEqual(codes);
});
