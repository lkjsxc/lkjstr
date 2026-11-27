import assert from 'node:assert/strict';

const imageResponse = {
  contentType: 'image/svg+xml',
  body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"/>',
};

const scrollTo = (feed, index) =>
  feed.evaluate((el, rowIndex) => {
    const row = el.querySelector(`[data-key="layout-${rowIndex}"]`);
    el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top;
  }, index);

const waitForImage = (page, path) =>
  page.waitForFunction(
    (src) => [...document.images].some((img) => img.naturalWidth === 480 && img.src.endsWith(src)),
    path,
  );

const retainedImages = (el) => {
  const top = el.getBoundingClientRect().top + el.clientTop;
  const bottom = top + el.clientHeight;
  const loaded = [...el.querySelectorAll('.mbox img[src]')].filter((img) => img.naturalWidth);
  const counts = { loaded: loaded.length, offscreen: 0, distant: 0 };
  for (const img of loaded) {
    const rect = img.closest('.mbox').getBoundingClientRect();
    const distance = Math.max(top - rect.bottom, rect.top - bottom);
    if (distance >= 0) counts.offscreen++;
    if (distance > 4.5 * el.clientHeight) counts.distant++;
  }
  return counts;
};

export async function checkLazyMedia(page, context) {
  const loaded = new Set();
  await context.route('**/lazy-fixture-*.svg', (route) => {
    const match = route
      .request()
      .url()
      .match(/lazy-fixture-(\d+)\.svg$/);
    if (match) loaded.add(Number(match[1]));
    return route.fulfill(imageResponse);
  });
  const rows = 160;
  const checkpoints = [];
  await page.evaluate((count) => globalThis.noteLayout.prepareLazyMedia(count), rows);
  const feed = page.locator('.view.feed');
  assert.ok((await feed.locator('.mbox img[src]').count()) <= 12);
  for (const index of [0, 20, 40, 60, 80, 100, 120, 60, 0]) {
    await scrollTo(feed, index);
    const image = Math.floor(index / 2);
    await waitForImage(page, `/lazy-fixture-${image}.svg`);
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.view.feed');
        const rect = el.getBoundingClientRect();
        const keep = 4.5 * el.clientHeight;
        return [...el.querySelectorAll('.mbox img[src]')].every((img) => {
          const box = img.closest('.mbox').getBoundingClientRect();
          return box.bottom >= rect.top - keep && box.top <= rect.bottom + keep;
        });
      },
      undefined,
      { timeout: 3000 },
    );
    const retained = await feed.evaluate(retainedImages);
    assert.ok(
      retained.offscreen <= 24,
      `Kept ${retained.offscreen} offscreen images at row ${index}`,
    );
    assert.equal(retained.distant, 0);
    const ahead = Math.max(...loaded) - image;
    if (checkpoints.length < 7)
      assert.ok(ahead <= 12, `Loaded ${ahead} images ahead of the reader at row ${index}`);
    checkpoints.push({ index, ahead, requested: loaded.size, ...retained });
  }
  await page.evaluate(() => globalThis.noteLayout.showMediaFeed(false));
  assert.equal(await feed.locator('.mbox img[src]').count(), 0);
  await page.evaluate(() => globalThis.noteLayout.showMediaFeed(true));
  await waitForImage(page, '/lazy-fixture-0.svg');
  return { rows, checkpoints, canceled: await checkCanceledMedia(page, context, feed, rows) };
}

async function checkCanceledMedia(page, context, feed, rows) {
  const first = '/cancel-fixture-0.svg';
  const requests = [];
  const { promise: held, resolve: respond } = Promise.withResolvers();
  await context.route('**/cancel-fixture-*.svg', async (route) => {
    requests.push(route.request().url());
    await held;
    await route
      .fulfill({ ...imageResponse, headers: { 'cache-control': 'no-store' } })
      .catch(() => {});
  });
  const canceled = page.waitForEvent('requestfailed', {
    predicate: (req) => req.url().endsWith(first),
    timeout: 5000,
  });
  // Keep the rejection observed while the first viewport fills its slots.
  void canceled.catch(() => {});
  try {
    await page.evaluate((count) => globalThis.noteLayout.prepareLazyMedia(count, false), rows);
    const sourced = feed.locator('.mbox img[src]');
    await page.waitForFunction(() => document.querySelectorAll('.mbox img[src]').length >= 4);
    assert.equal(await sourced.count(), 4);
    assert.ok(
      (await sourced.evaluateAll((imgs) => imgs.map((img) => img.src))).some((src) =>
        src.endsWith(first),
      ),
    );
    await scrollTo(feed, 120);
    await canceled;
  } finally {
    respond();
  }
  await waitForImage(page, '/cancel-fixture-120.svg');
  await scrollTo(feed, 0);
  await waitForImage(page, first);
  assert.equal(requests.filter((url) => url.endsWith(first)).length, 2);
  return true;
}
