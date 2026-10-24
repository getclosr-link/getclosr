// Shared helpers for getClosr E2E tests.

// Build a YNM share code from raw bytes — mirrors the app's encode() byte→text stage.
function craftCode(bytes) {
  const b64 = Buffer.from(Uint8Array.from(bytes)).toString('base64');
  const safe = b64.replace(/\+/g, '~').replace(/\//g, '.').replace(/=/g, '');
  return 'YNM-' + safe.replace(/(.{6})/g, '$1-').replace(/-$/, '');
}

// Encode a state object inside the app (uses the app's own encode()).
async function encodeInApp(page, data) {
  return page.evaluate(d => encode(d), data);
}

// Decode a code inside the app (uses the app's own decode()).
async function decodeInApp(page, code) {
  return page.evaluate(c => decode(c), code);
}

// Byte payload for a v2 code: name + items [{id, packed, note}].
function v2Bytes(name, items, overallNote) {
  const enc = new TextEncoder();
  const nb = Array.from(enc.encode(name));
  const buf = [2, nb.length, ...nb, items.length];
  for (const it of items) {
    const noteB = Array.from(enc.encode(it.note || ''));
    buf.push(it.id, it.packed, noteB.length, ...noteB);
  }
  if (overallNote !== undefined) {
    const ob = Array.from(enc.encode(overallNote));
    buf.push(ob.length >> 8, ob.length & 0xff, ...ob);
  }
  return buf;
}

// Compare codes through the home screen's single code field: reveal it, paste each code
// and accept it into the queue, then press the one primary action. Mirrors what a reader
// actually does — there is no separate two-slot compare box any more.
async function queueCodes(page, ...codes) {
  const toggle = page.locator('#home-code-toggle');
  if (await toggle.isVisible()) await toggle.click();
  for (const entry of codes) {
    const { code, label } = typeof entry === 'string' ? { code: entry, label: '' } : entry;
    await page.fill('#home-code-input', code);
    // An unreadable code never reaches the queue; leave it in the field for the assertion.
    const preview = page.locator('#home-code-preview .import-preview-card, #home-code-preview .code-card');
    if (!(await preview.count())) continue;
    // A private code asks whose list it is first; these helpers always queue someone else.
    const theirs = page.locator('#home-code-theirs');
    if (await theirs.count()) await theirs.click();
    if (label) await page.fill('#home-nick', label);
    await page.click('#home-code-preview button:has-text("→")');
  }
}

async function compareCodes(page, ...codes) {
  await queueCodes(page, ...codes);
  await page.click('#home-cta');
}

module.exports = { craftCode, encodeInApp, decodeInApp, v2Bytes, compareCodes, queueCodes };
