const { test, expect } = require('@playwright/test');
const { craftCode, encodeInApp, decodeInApp, v2Bytes } = require('./helpers');

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test.describe('encode/decode roundtrip', () => {
  test('full roundtrip: all activities, ratings and notes survive', async ({ page }) => {
    const ids = await page.evaluate(() => Object.keys(ACTIVITIES).map(Number));
    expect(ids.length).toBe(64);
    const ratings = {};
    ids.forEach((id, i) => {
      ratings[id] = { s: (i % 4) + 1, g: (i + 1) % 5, r: (i + 2) % 5, n: i % 7 === 0 ? `note ${id}` : '' };
    });
    const code = await encodeInApp(page, { name: 'Alex', ratings });
    const dec = await decodeInApp(page, code);
    expect(dec).not.toBeNull();
    expect(dec.name).toBe('Alex');
    for (const id of ids) {
      const orig = ratings[id];
      if (orig.s === 0 && orig.g === 0 && orig.r === 0 && !orig.n) continue;
      expect(dec.ratings[id]).toMatchObject({ s: orig.s, g: orig.g, r: orig.r, n: orig.n });
    }
  });

  test('unicode name and notes (umlauts + emoji) roundtrip intact', async ({ page }) => {
    const ratings = { 5: { s: 0, g: 3, r: 4, n: 'Nur mit Kerzenlicht 🕯️ & Musik' } };
    const code = await encodeInApp(page, { name: 'Zoë 💜', ratings });
    const dec = await decodeInApp(page, code);
    expect(dec.name).toBe('Zoë 💜');
    expect(dec.ratings[5].n).toBe('Nur mit Kerzenlicht 🕯️ & Musik');
  });

  test('40-char name / 60-char note boundaries hold', async ({ page }) => {
    const name = 'N'.repeat(45);
    const note = 'x'.repeat(70);
    const code = await encodeInApp(page, { name, ratings: { 3: { s: 2, g: 0, r: 0, n: note } } });
    const dec = await decodeInApp(page, code);
    expect(dec.name).toBe('N'.repeat(40));
    expect(dec.ratings[3].n).toBe('x'.repeat(60));
  });

  test('P12: emoji at slice boundary must not produce U+FFFD', async ({ page }) => {
    const name = 'a'.repeat(39) + '💜💜'; // slice(0,40) would cut inside the surrogate pair
    const code = await encodeInApp(page, { name, ratings: { 1: { s: 1, g: 0, r: 0, n: '' } } });
    const dec = await decodeInApp(page, code);
    expect(dec.name).not.toContain('�');
  });

  test('v4 private code carries the overall note to the partner', async ({ page }) => {
    const code = await encodeInApp(page, {
      name: 'Kim',
      overallNote: 'Bitte langsam anfangen — Kommunikation ist mir wichtig 💬',
      ratings: { 2: { s: 3, g: 0, r: 0, n: '' } },
    });
    const dec = await decodeInApp(page, code);
    expect(dec.overallNote).toBe('Bitte langsam anfangen — Kommunikation ist mir wichtig 💬');
  });

  test('v4 preserves every deliberately shared aftercare choice without silent clipping', async ({ page }) => {
    const aftercare = Array.from({ length: 21 }, (_, i) => `Preference ${i + 1}`);
    const code = await encodeInApp(page, {
      name: 'Kim', aftercareInCode: true, aftercare,
      ratings: { 2: { s: 3, g: 0, r: 0, n: '' } },
    });
    const dec = await decodeInApp(page, code);
    expect(dec.aftercare).toEqual(aftercare);
  });
});

test.describe('v4 private and v5 profile formats', () => {
  test('v2 and v3 remain readable while new private codes are v4', async ({ page }) => {
    const v2 = craftCode(v2Bytes('V2', [{ id: 3, packed: 75, note: 'old note' }]));
    const v3Bytes = v2Bytes('V3', [{ id: 3, packed: 75 }]);
    v3Bytes[0] = 3;
    const water = [...new TextEncoder().encode('Water')];
    v3Bytes.push(1, water.length, ...water);
    const v3 = craftCode(v3Bytes);
    const current = await encodeInApp(page, { name: 'V4', hardLimits: 'No breath play', overallNote: 'Slowly', ratings: { 3: { s: 3, g: 0, r: 0, n: 'new note' } } });
    const [a, b, c] = await Promise.all([decodeInApp(page, v2), decodeInApp(page, v3), decodeInApp(page, current)]);
    expect(a).toMatchObject({ name: 'V2', kind: 'legacy' });
    expect(b).toMatchObject({ name: 'V3', kind: 'legacy', aftercare: ['Water'] });
    expect(c).toMatchObject({ name: 'V4', kind: 'private', hardLimits: 'No breath play', overallNote: 'Slowly' });
  });

  test('v4 retains private notes and overall note; v5 intentionally omits them', async ({ page }) => {
    const data = { name: 'Ari', hardLimits: 'No breath play', overallNote: 'Start slowly', aftercareInCode: true, aftercare: ['Water'], ratings: { 3: { s: 3, g: 0, r: 0, n: 'Ask before longer kisses' } } };
    const [privateCode, profileCode] = await page.evaluate(d => [encode(d), encodeProfile(d)], data);
    const [priv, pub] = await Promise.all([decodeInApp(page, privateCode), decodeInApp(page, profileCode)]);
    expect(priv.ratings[3].n).toBe('Ask before longer kisses');
    expect(priv.overallNote).toBe('Start slowly');
    expect(priv.hardLimits).toBe('No breath play');
    expect(pub.ratings[3].n).toBe('');
    expect(pub.overallNote).toBe('');
    expect(pub.hardLimits).toBe('No breath play');
    expect(profileCode.length).toBeLessThan(1200);
  });

  test('hard limits enforce the explicit 280 UTF-8-byte boundary without truncating', async ({ page }) => {
    const exact = '🧡'.repeat(70); // 70 × 4 UTF-8 bytes
    const result = await page.evaluate(value => {
      const exact = encodeProfile({ name: 'A', hardLimits: value, ratings: {} });
      try { encodeProfile({ name: 'A', hardLimits: value + 'x', ratings: {} }); return { exact, error: '' }; }
      catch (e) { return { exact, error: e.message }; }
    }, exact);
    expect(result.exact).toContain('YNM-');
    expect(result.error).toContain('Hard limits is too long');
  });

  test('v5 validates UTF-8 byte limits for the profile name and custom aftercare', async ({ page }) => {
    const result = await page.evaluate(() => {
      const base = { hardLimits: '', ratings: {}, aftercareInCode: true };
      const exactName = encodeProfile({ ...base, name: '🧡'.repeat(12) });
      const exactCustom = encodeProfile({ ...base, name: 'A', aftercare: ['x'.repeat(30), 'y'.repeat(30), 'z'.repeat(30)] });
      let nameError = '', customError = '';
      try { encodeProfile({ ...base, name: '🧡'.repeat(13) }); } catch (e) { nameError = e.message; }
      try { encodeProfile({ ...base, name: 'A', aftercare: ['x'.repeat(30), 'y'.repeat(30), 'z'.repeat(30), 'w'.repeat(3)] }); } catch (e) { customError = e.message; }
      return { exactName, exactCustom, nameError, customError };
    });
    expect(result.exactName).toContain('YNM-');
    expect(result.exactCustom).toContain('YNM-');
    expect(result.nameError).toContain('Profile name is too long');
    expect(result.customError).toContain('Custom aftercare is too long');
  });
});

test.describe('v6 compact private codes and v7 group codes', () => {
  const sample = {
    name: 'Robin', overallNote: 'Slowly, and talk first', hardLimits: 'No pain',
    aftercareInCode: true, aftercare: ['Water', 'Cuddling'],
    ratings: { 0: { s: 3, g: 0, r: 0, n: '' }, 12: { s: 0, g: 4, r: 2, n: 'Only with time' }, 69: { s: 1, g: 0, r: 0, n: '' }, 30: { s: 0, g: 0, r: 0, n: 'Curious, not sure yet' } },
  };

  test('new private codes are v6, carry no dashes and roundtrip every field', async ({ page }) => {
    const code = await encodeInApp(page, sample);
    expect(code).toMatch(/^YNM-[A-Za-z0-9~.]+$/);
    const bytes = Buffer.from(code.slice(4).replace(/~/g, '+').replace(/\./g, '/'), 'base64');
    expect(bytes[0]).toBe(6);
    const dec = await decodeInApp(page, code);
    expect(dec).toMatchObject({ name: 'Robin', overallNote: 'Slowly, and talk first', hardLimits: 'No pain', aftercare: ['Water', 'Cuddling'], kind: 'private' });
    expect(dec.ratings[12]).toEqual({ s: 0, g: 4, r: 2, n: 'Only with time' });
    expect(dec.ratings[69]).toEqual({ s: 1, g: 0, r: 0, n: '' });
    expect(dec.ratings[30]).toEqual({ s: 0, g: 0, r: 0, n: 'Curious, not sure yet' });
  });

  test('a full list with notes is far shorter than the same list as v4', async ({ page }) => {
    const { v4, v6 } = await page.evaluate(() => {
      const ratings = {};
      Object.keys(ACTIVITIES).map(Number).forEach((id, i) => {
        ratings[id] = { s: (i % 4) + 1, g: i % 5, r: (i + 3) % 5, n: i % 9 === 0 ? 'only when we both have time for it' : '' };
      });
      // Rebuild the former v4 bytes from the same data to compare like with like.
      const legacy = [4, 4, ...benc('Alex'), Object.keys(ratings).length];
      Object.entries(ratings).forEach(([id, rt]) => { const n = benc(rt.n); legacy.push(+id, packedRating(rt), n.length, ...n); });
      legacy.push(0, 0, 0, 0, 0);
      return { v4: codeFromBytes(legacy).length, v6: encode({ name: 'Alex', ratings }).length };
    });
    expect(v6).toBeLessThan(v4 * 0.6);
  });

  test('stored v4 codes, with or without the old dashes, still decode', async ({ page }) => {
    const bytes = v2Bytes('Old', [{ id: 3, packed: 75, note: 'kept' }]);
    bytes[0] = 4;
    const limit = [...new TextEncoder().encode('No pain')];
    bytes.push(0, 0, 0, 0, limit.length, ...limit);
    const dashed = craftCode(bytes);
    for (const c of [dashed, dashed.replace(/-/g, '').replace(/^YNM/, 'YNM-'), dashed.replace(/-/g, '\n')]) {
      expect(await decodeInApp(page, c), c).toMatchObject({ name: 'Old', hardLimits: 'No pain', kind: 'private', ratings: { 3: { s: 3, g: 0, r: 0, n: 'kept' } } });
    }
  });

  test('both the stored and the deflated payload paths decode', async ({ page }) => {
    const r = await page.evaluate(() => {
      const data = { name: 'A', ratings: { 3: { s: 3, g: 0, r: 0, n: 'again and again and again and again' }, 4: { s: 3, g: 0, r: 0, n: 'again and again and again and again' } } };
      const payload = [];
      pushProfileBody(payload, data);
      const stored = codeFromBytes([6, 0, ...payload]);
      const deflated = encode(data);
      return { deflatedFlag: bytesFromCode(deflated)[1], stored: decode(stored), deflated: decode(deflated) };
    });
    expect(r.deflatedFlag).toBe(1);
    expect(r.stored.ratings).toEqual(r.deflated.ratings);
    expect(r.stored.ratings[4].n).toBe('again and again and again and again');
  });

  test('activity ids, not CATS order, address the ratings', async ({ page }) => {
    const dec = await page.evaluate(() => {
      const code = encode({ name: 'A', ratings: { 65: { s: 4, g: 0, r: 0, n: '' }, 1: { s: 2, g: 0, r: 0, n: '' } } });
      CATS.reverse();
      try { return decode(code); } finally { CATS.reverse(); }
    });
    expect(dec.ratings).toEqual({ 1: { s: 2, g: 0, r: 0, n: '' }, 65: { s: 4, g: 0, r: 0, n: '' } });
  });

  test('a group code holds two complete profiles and is shorter than both codes together', async ({ page }) => {
    const r = await page.evaluate(s => {
      const other = { ...s, name: 'Sky', overallNote: 'Talk first, always', ratings: { 12: { s: 0, g: 2, r: 4, n: 'Only with time' } } };
      const group = encodeGroup([s, other]);
      return { group, decoded: decodeGroup(group), sum: encode(s).length + encode(other).length, asSingle: decode(group) };
    }, sample);
    expect(r.decoded.map(p => p.name)).toEqual(['Robin', 'Sky']);
    expect(r.decoded[0]).toMatchObject({ overallNote: 'Slowly, and talk first', hardLimits: 'No pain', aftercare: ['Water', 'Cuddling'] });
    expect(r.decoded[1].ratings[12]).toEqual({ s: 0, g: 2, r: 4, n: 'Only with time' });
    expect(r.group.length).toBeLessThan(r.sum);
    // decode() promises one person; a group must never slip through it as one profile.
    expect(r.asSingle).toBeNull();
  });

  test('group codes reject wrong sizes, single codes and hostile input', async ({ page }) => {
    const r = await page.evaluate(() => {
      const one = { name: 'A', ratings: { 3: { s: 3, g: 0, r: 0, n: '' } } };
      const errors = [[one], Array(9).fill(one)].map(list => { try { encodeGroup(list); return ''; } catch (e) { return e.message; } });
      return {
        errors,
        single: decodeGroup(encode(one)),
        oneInside: decodeGroup(codeFromPayload(7, [1, 0, 0, 0, 0, 0, 0, 0, 0])),
        tooLong: decodeGroup('YNM-' + 'A'.repeat(9000)),
        badFlags: decode(codeFromBytes([6, 4, 0])),
      };
    });
    expect(r.errors.every(e => e.includes('2 to 8'))).toBe(true);
    expect(r.single).toBeNull();
    expect(r.oneInside).toBeNull();
    expect(r.tooLong).toBeNull();
    expect(r.badFlags).toBeNull();
  });
});

test.describe('malformed / hostile codes', () => {
  test('garbage, empty and wrong-version codes return null', async ({ page }) => {
    for (const bad of ['', 'YNM-', 'hello world', 'YNM-!!!!!!', craftCode([1, 0, 0])]) {
      expect(await decodeInApp(page, bad), `code: ${JSON.stringify(bad)}`).toBeNull();
    }
  });

  test('P3: a truncated code never yields a plausible but wrong object', async ({ page }) => {
    const ratings = { 5: { s: 3, g: 2, r: 1, n: 'hello' }, 9: { s: 0, g: 4, r: 0, n: '' } };
    const code = await encodeInApp(page, { name: 'Sam', ratings });
    const compact = code.replace(/-/g, '').replace(/^YNM/i, '');
    for (let cut = 1; cut <= 12; cut++) {
      const dec = await decodeInApp(page, 'YNM-' + compact.slice(0, compact.length - cut));
      if (dec === null) continue; // rejected outright — the common case
      // Surviving a cut is only acceptable when the payload is still exactly right. The
      // v3 aftercare list is a trailing optional section, so dropping it degrades
      // gracefully; what must never happen is NaN/undefined ratings or a mangled name.
      expect(dec.name, `cut=${cut}`).toBe('Sam');
      expect(Object.keys(dec.ratings).sort(), `cut=${cut}`).toEqual(['5', '9']);
      for (const [id, want] of Object.entries(ratings)) {
        expect(dec.ratings[id], `cut=${cut} id=${id}`).toMatchObject(want);
      }
      expect(dec.aftercare, `cut=${cut}`).toEqual([]);
    }
  });

  test('P2: packed byte >124 (impossible rating) returns null', async ({ page }) => {
    const dec = await decodeInApp(page, craftCode(v2Bytes('X', [{ id: 5, packed: 200 }])));
    expect(dec).toBeNull();
  });

  test('nameLen pointing past buffer end returns null', async ({ page }) => {
    const dec = await decodeInApp(page, craftCode([2, 250, 65, 66]));
    expect(dec).toBeNull();
  });

  test('item count larger than actual items returns null', async ({ page }) => {
    const dec = await decodeInApp(page, craftCode([2, 1, 65, 9, 5, 80, 0]));
    expect(dec).toBeNull();
  });

  test('unknown activity id is not fatal (ignored in comparison)', async ({ page }) => {
    const code = craftCode(v2Bytes('X', [{ id: 200, packed: 80 }]));
    const dec = await decodeInApp(page, code);
    if (dec !== null) {
      const cmp = await page.evaluate(d => getComparison(d.ratings, {}, 'A', 'B'), dec);
      const total = cmp.buckets.match.length + cmp.buckets.discuss.length + cmp.buckets.gap.length;
      expect(total).toBe(0);
    }
  });
});

test.describe('matchStatus bucketing', () => {
  const cases = [
    { a: { s: 3, g: 0, r: 0, n: '' }, b: { s: 3, g: 0, r: 0, n: '' }, want: 'match', why: 'both self >=3' },
    { a: { s: 4, g: 0, r: 0, n: '' }, b: { s: 3, g: 0, r: 0, n: '' }, want: 'match', why: 'crave+into it' },
    { a: { s: 0, g: 3, r: 0, n: '' }, b: { s: 0, g: 0, r: 3, n: '' }, want: 'match', why: 'giving meets receiving' },
    { a: { s: 0, g: 0, r: 3, n: '' }, b: { s: 0, g: 3, r: 0, n: '' }, want: 'match', why: 'receiving meets giving' },
    { a: { s: 0, g: 3, r: 0, n: '' }, b: { s: 0, g: 3, r: 0, n: '' }, want: 'discuss', why: 'two givers, no receiver' },
    { a: { s: 2, g: 0, r: 0, n: '' }, b: { s: 2, g: 0, r: 0, n: '' }, want: 'discuss', why: 'both curious' },
    { a: { s: 2, g: 0, r: 0, n: '' }, b: { s: 0, g: 0, r: 0, n: '' }, want: 'gap', why: 'one interested, one silent' },
    { a: { s: 0, g: 0, r: 0, n: 'someday…' }, b: { s: 0, g: 0, r: 0, n: '' }, want: 'gap', why: 'note counts as signal' },
    { a: { s: 0, g: 0, r: 0, n: '' }, b: { s: 0, g: 0, r: 0, n: '' }, want: 'skip', why: 'both silent' },
    // Documents current (deferred D1) behavior: a hard "Not for me" (1) is treated as no signal.
    { a: { s: 1, g: 0, r: 0, n: '' }, b: { s: 0, g: 0, r: 0, n: '' }, want: 'skip', why: 'limit vs silent — current behavior' },
    { a: { s: 1, g: 0, r: 0, n: '' }, b: { s: 4, g: 0, r: 0, n: '' }, want: 'gap', why: 'limit vs crave — current behavior' },
  ];
  for (const c of cases) {
    test(`${c.want}: ${c.why}`, async ({ page }) => {
      const got = await page.evaluate(({ a, b }) => matchStatus(a, b), { a: c.a, b: c.b });
      expect(got).toBe(c.want);
    });
  }
});

// Value: protects=reopenable group exports; fails_when=an encoder returns a rejected oversized code;
// why_new=existing group fixtures compress well; seam=none; no_claim=oversized code support.
test('group export rejects the smallest oversized valid fixture and still accepts reduced content', async ({ page }) => {
  const { largeProfiles } = require('./helpers');
  const profiles = largeProfiles(await page.evaluate(() => profileActivityIds()));
  const result = await page.evaluate(ps => {
    const individual = ps.map(p => decode(encode(p)) !== null);
    let message = '';
    try { encodeGroup(ps); } catch (e) { message = e.message; }
    const reduced = ps.map(p => ({ ...p, ratings: Object.fromEntries(Object.entries(p.ratings).map(([id, rt]) => [id, { ...rt, n: '' }])), overallNote: '' }));
    const code = encodeGroup(reduced);
    return { individual, message, length: code.length, profiles: decodeGroup(code).length };
  }, profiles);
  expect(result.individual).toEqual([true, true]);
  expect(result.message).toContain('too long to share');
  expect(result.length).toBeLessThanOrEqual(8000);
  expect(result.profiles).toBe(2);
});
