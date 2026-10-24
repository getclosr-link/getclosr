const { test, expect } = require('@playwright/test');

// The feedback switch is the one opt-in network path: nothing may load before
// it is turned on, and afterwards the page talks only to its own /fk path (the
// Worker relays it), never to a third-party host. Turning the switch on pins
// the floating button so the reader can scroll anywhere and give feedback;
// turning it off hides the floating button again.

// Stand-in for the real widget: records how it was loaded, mounts a host element,
// and counts open() calls.
const STUB = `
  const s = document.currentScript;
  const host = document.createElement('div');
  host.setAttribute('data-feedbackkit', 'host');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<button class="fk-trigger" type="button">Feedback</button><div class="fk-backdrop" hidden><button class="fk-x" type="button">×</button></div>';
  root.querySelector('.fk-x').onclick = () => { root.querySelector('.fk-backdrop').hidden = true; document.documentElement.style.overflow = ''; };
  document.body.appendChild(host);
  window.__fk = { base: s.dataset.base, project: s.dataset.project, trigger: s.dataset.trigger, autoopen: s.dataset.autoopen, opens: 0 };
  window.FeedbackKit = { open() { window.__fk.opens++; root.querySelector('.fk-backdrop').hidden = false; document.documentElement.style.overflow = 'hidden'; } };
  if (s.dataset.autoopen != null) window.FeedbackKit.open();
`;

test('nothing loads before the switch is turned on; turning it on pins the floating widget and Escape unlocks scroll', async ({ page }) => {
  const seen = [];
  page.on('request', (r) => seen.push(r.url()));
  await page.route('**/fk/widget.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
  await page.goto('/');
  const ownHost = new URL(page.url()).host;
  await page.waitForTimeout(300);
  expect(seen.filter((u) => u.includes('/fk/'))).toEqual([]);

  const sw = page.getByRole('switch', { name: 'Send feedback' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => window.__fk && window.__fk.opens)).toBe(1);
  expect(await page.evaluate(() => window.__fk)).toMatchObject({ base: '/fk' });
  expect(await page.evaluate(() => window.__fk.autoopen)).toBeUndefined();
  expect(seen.some((u) => u.endsWith('/fk/widget.js'))).toBe(true);
  expect(seen.filter((u) => new URL(u).host !== ownHost)).toEqual([]);

  // Pressing Escape anywhere on the page closes the panel and unlocks scrolling.
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');

  // Turning the switch off hides the floating button; turning it back on reuses the widget.
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await page.locator('[data-feedbackkit="host"]').isHidden()).toBe(true);
  await sw.click();
  await expect.poll(() => page.evaluate(() => window.__fk.opens)).toBe(2);
  expect(await page.locator('script[data-fk-loader]').count()).toBe(1);
});

// Value: protects=manual retry after network failure without background requests;
// seam=failed then synthetic widget response; no_claim=upstream service availability.
test('a failed feedback load resets the switch and a fresh opt-in retries once', async ({ page }) => {
  let requests = 0;
  await page.route('**/fk/widget.js', route => {
    requests++;
    return requests === 1 ? route.abort('failed') : route.fulfill({ status: 200, contentType: 'application/javascript', body: STUB });
  });
  await page.goto('/');
  const sw = page.getByRole('switch', { name: 'Send feedback' });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('script[data-fk-loader]')).toHaveCount(0);
  await expect(page.locator('#feedback-status')).toContainText('Feedback could not load');
  await page.waitForTimeout(200);
  expect(requests).toBe(1);
  await sw.click();
  await expect.poll(() => page.evaluate(() => window.__fk?.opens)).toBe(1);
  expect(requests).toBe(2);
  await expect(sw).toHaveAttribute('aria-checked', 'true');
});

test('switching off during a delayed feedback load prevents late opening', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/fk/widget.js', async route => {
    requests++; await gate;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: STUB });
  });
  await page.goto('/');
  const sw = page.getByRole('switch', { name: 'Send feedback' });
  await sw.click();
  await expect.poll(() => requests).toBe(1);
  await sw.click();
  release();
  await expect.poll(() => page.evaluate(() => !!window.FeedbackKit)).toBe(true);
  expect(await page.evaluate(() => window.__fk.opens)).toBe(0);
  await expect(page.locator('[data-feedbackkit="host"]')).toBeHidden();
  await sw.click();
  await expect.poll(() => page.evaluate(() => window.__fk.opens)).toBe(1);
  expect(requests).toBe(1);
});

test('off and on during one pending feedback load keeps a single request', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/fk/widget.js', async route => {
    requests++; await gate;
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: STUB });
  });
  await page.goto('/');
  const sw = page.getByRole('switch', { name: 'Send feedback' });
  await sw.click(); await expect.poll(() => requests).toBe(1);
  await sw.click(); await sw.click();
  release();
  await expect.poll(() => page.evaluate(() => window.__fk?.opens)).toBe(1);
  expect(requests).toBe(1);
  await expect(page.locator('script[data-fk-loader]')).toHaveCount(1);
});
