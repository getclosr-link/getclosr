const { test, expect } = require('@playwright/test');

// The feedback form is the one opt-in network path: nothing may load before the
// click, and afterwards the page talks only to its own /fk path (a Pages Function
// relays it), never to a third-party host.

// Stand-in for the real widget: records how it was loaded and counts open() calls.
const STUB = `
  const s = document.currentScript;
  window.__fk = { base: s.dataset.base, project: s.dataset.project, trigger: s.dataset.trigger, autoopen: s.dataset.autoopen, opens: 0 };
  window.FeedbackKit = { open() { window.__fk.opens++; } };
  if (s.dataset.autoopen != null) window.FeedbackKit.open();
`;

test('nothing loads before the click; the click loads the widget from the own /fk path', async ({ page }) => {
  const seen = [];
  page.on('request', (r) => seen.push(r.url()));
  await page.route('**/fk/widget.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: STUB }));
  await page.goto('/');
  const ownHost = new URL(page.url()).host;
  await page.waitForTimeout(300);
  expect(seen.filter((u) => u.includes('/fk/'))).toEqual([]);

  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect.poll(() => page.evaluate(() => window.__fk && window.__fk.opens)).toBe(1);
  expect(await page.evaluate(() => window.__fk)).toMatchObject({ base: '/fk', trigger: 'none', autoopen: '' });
  expect(seen.some((u) => u.endsWith('/fk/widget.js'))).toBe(true);
  expect(seen.filter((u) => new URL(u).host !== ownHost)).toEqual([]);

  // A second click reuses the loaded widget instead of injecting it again.
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect.poll(() => page.evaluate(() => window.__fk.opens)).toBe(2);
  expect(await page.locator('script[data-fk-loader]').count()).toBe(1);
});
