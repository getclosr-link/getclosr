const { test, expect } = require('@playwright/test');
const { craftCode, v2Bytes, compareCodes, queueCodes } = require('./helpers');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

// Both codes belong to other people and this browser has no list of its own — still a
// valid comparison, and the shortest way to exercise the results renderer.
async function directCompare(page, a, b) {
  await compareCodes(page, a, b);
}

test.describe('user flows', () => {
  test('direct compare on home renders results', async ({ page }) => {
    const codeA = await page.evaluate(() => encode({ name: 'A', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    const codeB = await page.evaluate(() => encode({ name: 'B', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    await directCompare(page, codeA, codeB);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await expect(page.locator('#res-summary')).toContainText('Match');
  });

  test('invalid code shows error, does not navigate', async ({ page }) => {
    await queueCodes(page, 'YNM-garbage');
    await expect(page.locator('#home-code-preview .err-msg')).toBeVisible();
    await expect(page.locator('#s-results')).not.toHaveClass(/on/);
  });

  test('P1: XSS — hostile name in shared code must not execute', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', d => { dialogFired = true; d.dismiss(); });
    const evil = craftCode(v2Bytes('<img src=x onerror="alert(1)">', [{ id: 3, packed: 75 }]));
    const clean = await page.evaluate(() => encode({ name: 'Safe', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    await directCompare(page, evil, clean);
    // Guard against false-pass: results must actually have rendered.
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await page.waitForTimeout(200);
    expect(dialogFired).toBe(false);
    // The name must be rendered as text, not as a live <img> element.
    expect(await page.locator('#s-results img[src="x"]').count()).toBe(0);
  });

  test('P1b: XSS via note in shared code must not execute', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', d => { dialogFired = true; d.dismiss(); });
    const evil = craftCode(v2Bytes('Name', [{ id: 3, packed: 75, note: '<img src=y onerror="alert(2)">' }]));
    const clean = await page.evaluate(() => encode({ name: 'Safe', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    await directCompare(page, evil, clean);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await page.waitForTimeout(200);
    expect(dialogFired).toBe(false);
    expect(await page.locator('#s-results img[src="y"]').count()).toBe(0);
  });

});

test.describe('draft persistence', () => {
  test('rating an activity saves a draft and shows resume banner after reload', async ({ page }) => {
    await page.click('button:has-text("Start")');
    // Skip onboarding if present.
    if (await page.locator('#s-onboard.on').count()) {
      await page.click('#s-onboard button:has-text("Skip")').catch(() => {});
    }
    await page.evaluate(() => { state.ratings[3] = { s: 3, g: 0, r: 0, n: '' }; saveDraft(); });
    const draft = await page.evaluate(() => localStorage.getItem('closr.draft.v1'));
    expect(draft).toContain('"lastEdit"');
    await page.goto('/');
    await expect(page.locator('#home-draft-card')).toBeVisible();
  });

  test('P15: tampered draft with null rating values does not crash home', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('closr.draft.v1', JSON.stringify({
        name: 'X', overallNote: '', ratings: { 3: null, 5: { s: 3 } }, lastEdit: Date.now(),
      }));
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });

  test('P13: localStorage throwing must not break app boot', async ({ page }) => {
    await page.addInitScript(() => {
      const noop = () => { throw new Error('storage disabled'); };
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { return { getItem: noop, setItem: noop, removeItem: noop }; },
      });
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await page.waitForTimeout(200);
    // App must still render the home screen.
    await expect(page.locator('#s-home')).toHaveClass(/on/);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('privacy / anonymity', () => {
  test('no external network requests on load or during a full compare', async ({ page }) => {
    await page.goto('/');
    const ownHost = new URL(page.url()).hostname;
    const external = [];
    page.on('request', req => {
      const u = new URL(req.url());
      if (u.hostname !== ownHost) external.push(req.url());
    });
    const a = await page.evaluate(() => encode({ name: 'A', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } }));
    await compareCodes(page, a, a);
    await page.waitForTimeout(300);
    expect(external, external.join('\n')).toEqual([]);
  });

  test('no personal identity or email embedded in shipped artifact', async ({ page }) => {
    const html = await page.content();
    // No email address of any kind ships. The support link is a URL, not a mailto.
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
    // Identity terms come from the environment and are deliberately not written down here:
    // a denylist inside a public repo republishes the very strings it exists to keep out.
    // Set CLOSR_FORBIDDEN_TERMS="term,term" locally or in CI to enforce specific ones.
    const terms = (process.env.CLOSR_FORBIDDEN_TERMS || '').split(',').map(t => t.trim()).filter(Boolean);
    for (const term of terms) {
      expect(html.toLowerCase(), `shipped artifact leaks a forbidden term`).not.toContain(term.toLowerCase());
    }
  });
});

test.describe('v2-specific hardening', () => {
  test('P1c: hostile aftercare label from a partner code must not execute', async ({ page }) => {
    let dialogFired = false;
    page.on('dialog', d => { dialogFired = true; d.dismiss(); });
    // Aftercare arrives inside the partner's code and lands in innerHTML — a path that
    // only exists since the v2/v3 rework, so the original QA pass never covered it.
    const evil = await page.evaluate(() => encode({
      name: 'E', aftercareInCode: true,
      aftercare: ['<img src=q onerror="alert(3)">'],
      ratings: { 3: { s: 3, g: 0, r: 0, n: '' } },
    }));
    const clean = await page.evaluate(() => encode({
      name: 'Safe', aftercareInCode: true, aftercare: ['<img src=q onerror="alert(3)">'],
      ratings: { 3: { s: 3, g: 0, r: 0, n: '' } },
    }));
    await directCompare(page, evil, clean);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
    await page.waitForTimeout(250);
    // Guard against a false pass: the chip must actually have rendered, carrying the
    // hostile string as inert text rather than as a live element.
    await expect(page.locator('.ac-overlap-chip')).toHaveCount(1);
    await expect(page.locator('.ac-overlap-chip').first()).toHaveText('<img src=q onerror="alert(3)">');
    expect(dialogFired).toBe(false);
    expect(await page.locator('#s-results img[src="q"]').count()).toBe(0);
  });

  test('zoom is not blocked (WCAG 1.4.4)', async ({ page }) => {
    const viewport = await page.getAttribute('meta[name=viewport]', 'content');
    expect(viewport).not.toContain('maximum-scale');
    expect(viewport).not.toContain('user-scalable=no');
  });

  test('deploy root serves the app and nothing else', async ({ page }) => {
    const html = await page.content();
    expect(html).not.toContain('FEEDBACK_B64');
    // Each entry is a repo file that must never be reachable, paired with a string that
    // only exists inside it — so a served file is caught even if the status lies.
    const repoFiles = [
      ['/README.md', 'Deploy your own'],
      ['/docs/DESIGN.md', 'non-negotiable'],
      ['/docs/BRAND.md', 'brand foundations'],
    ];
    for (const [path, marker] of repoFiles) {
      const res = await page.request.get(path);
      const body = await res.text();
      // Cloudflare answers unknown paths with 404.html; a local static server
      // answers 404 with its own body. Either way the repo file must never be served,
      // so assert on the payload, not only on the status code.
      expect(res.status(), path).toBe(404);
      expect(body, path).not.toContain(marker);
    }
  });

  test('deployed assets carry no personal support handle', async ({ page }) => {
    // No personal handle or account name ships with the site: support goes through the
    // organization's GitHub Sponsors page. Keep the check structural, not a list of names.
    for (const path of ['/', '/404.html', '/robots.txt']) {
      const body = (await (await page.request.get(path)).text()).toLowerCase();
      expect(body, `${path} links to a personal support page`).not.toMatch(/buymeacoffee\.com|ko-fi\.com|patreon\.com/);
    }
  });

  test('the sponsor link is a plain link to the organization and loads nothing on the page', async ({ page }) => {
    const external = [];
    page.on('request', r => { if (!r.url().startsWith(new URL(page.url() || 'http://x').origin)) external.push(r.url()); });
    const link = page.locator('.l-footer a#sponsor-link');
    await expect(link).toHaveAttribute('href', 'https://github.com/sponsors/getclosr-link');
    await expect(link).toHaveAttribute('rel', /noopener/);
    expect(external.filter(u => u.includes('github.com'))).toEqual([]);
  });

  test('the footer links to the own imprint, which names the project and its GitHub org only', async ({ page }) => {
    await expect(page.locator('.l-footer-legal a', { hasText: 'Imprint' })).toHaveAttribute('href', '/imprint');
    // Python's dev server has no clean URLs; Cloudflare serves /imprint from imprint.html.
    await page.goto('/imprint.html');
    await expect(page.locator('main')).toContainText('The getClosr contributors');
    await expect(page.locator('main a[href="https://github.com/getclosr-link"]')).toHaveCount(1);
  });

  test('?feedback renders the normal app, not an embedded workbench', async ({ page }) => {
    await page.goto('/?feedback');
    await expect(page.locator('#s-home')).toHaveClass(/on/);
    expect(await page.content()).not.toContain('FEEDBACK_B64');
  });
});

test.describe('results drill-down', () => {
  async function openPair(page) {
    const a = await page.evaluate(() => encode({ name: 'Robin', ratings: { 0: { s: 3, g: 0, r: 0, n: '' }, 3: { s: 1, g: 0, r: 0, n: '' }, 5: { s: 4, g: 0, r: 0, n: '' } } }));
    const b = await page.evaluate(() => encode({ name: 'Sky', ratings: { 0: { s: 3, g: 0, r: 0, n: '' }, 3: { s: 4, g: 0, r: 0, n: '' }, 5: { s: 2, g: 0, r: 0, n: '' } } }));
    await compareCodes(page, a, b);
    await expect(page.locator('#s-results')).toHaveClass(/on/);
  }

  test('tapping a summary number opens the Activities list with that bucket', async ({ page }) => {
    await openPair(page);
    await page.locator('#res-summary .sum-card.match').click();
    expect(await page.evaluate(() => resultsTab)).toBe('list');
    const expected = await page.evaluate(() => currentComparison.buckets.match.length);
    expect(expected).toBeGreaterThan(0);
    await expect(page.locator('#res-body .matrix-row')).toHaveCount(expected);
  });

  test('tapping the pair in a two-person comparison opens the Activities list', async ({ page }) => {
    await openPair(page);
    await page.locator('.res-pair-row').first().click();
    expect(await page.evaluate(() => resultsTab)).toBe('list');
    expect(await page.locator('#res-body .matrix-row').count()).toBeGreaterThan(0);
  });

  test('tapping a category opens the list narrowed to it', async ({ page }) => {
    await openPair(page);
    await page.locator('.res-cat-row').first().click();
    expect(await page.evaluate(() => [resultsTab, resultsScopeCat !== null])).toEqual(['list', true]);
  });
});

// Value: protects=aftercare sharing choice after hydration; fails_when=opt-in is dropped or inferred;
// why_new=codec tests bypass draft loading; seam=none; no_claim=external recipient behavior.
for (const path of ['resume', 'home comparison']) {
  for (const preference of [true, false, undefined]) {
    test(`draft hydration retains aftercare opt-in: ${path}, ${String(preference)}`, async ({ page }) => {
      const exported = await page.evaluate(({ path, preference }) => {
        const draft = { name: 'Alex', ratings: { 3: { s: 3, g: 0, r: 0, n: 'Synthetic note' } },
          overallNote: 'Synthetic overall note', hardLimits: 'Synthetic boundary', aftercare: ['Water'],
          completedAt: 12345, activeCatId: 'affection' };
        if (preference !== undefined) draft.aftercareInCode = preference;
        localStorage.setItem('closr.draft.v1', JSON.stringify(draft));
        if (path === 'resume') resumeDraft(); else loadDraftIntoState();
        saveDraft();
        return { saved: loadDraft(), private: decode(encode(state)), public: decode(encodeProfile(state)) };
      }, { path, preference });
      expect(exported.saved).toMatchObject({ name: 'Alex', completedAt: 12345, aftercareInCode: preference === true });
      for (const profile of [exported.private, exported.public]) {
        expect(profile.aftercare).toEqual(preference === true ? ['Water'] : []);
      }
      expect(exported.saved.ratings[3].n).toBe('Synthetic note');
    });
  }
}

// Value: protects=saved answers during category editing after reload; seam=synthetic draft.
test('editing categories after reload preserves the saved profile when another answer changes', async ({ page }) => {
  const original = { name: 'Alex', ratings: { 3: { s: 3, g: 1, r: 0, n: 'Synthetic note' } },
    overallNote: 'Synthetic overall note', hardLimits: 'Synthetic boundary', aftercare: ['Water'], aftercareInCode: true };
  await page.evaluate(draft => {
    localStorage.setItem('closr.draft.v1', JSON.stringify(draft));
    localStorage.setItem('closr.onboard', '1');
  }, original);
  await page.reload();
  await page.getByRole('button', { name: 'Edit categories', exact: true }).click();
  await page.locator('#s-setup button').filter({ hasText: 'Continue' }).click();
  await expect(page.locator('#s-fill')).toHaveClass(/on/);
  await page.evaluate(() => setHeatRating(5, 's', 4));
  const saved = await page.evaluate(() => loadDraft());
  expect(saved).toMatchObject(original);
  expect(saved.ratings[5].s).toBe(4);
});
