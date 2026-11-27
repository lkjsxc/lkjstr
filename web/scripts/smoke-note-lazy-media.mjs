import assert from 'node:assert/strict';

export async function checkLazyMedia(page, context) {
  const loaded = new Set();
  await context.route('**/lazy-fixture-*.svg', (route) => {
    const match = route
      .request()
      .url()
      .match(/lazy-fixture-(\d+)\.svg$/);
    if (match) loaded.add(Number(match[1]));
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"/>',
    });
  });
  const rows = 160;
  const checkpoints = [];
  await page.evaluate((count) => globalThis.noteLayout.prepareLazyMedia(count), rows);
  const feed = page.locator('.view.feed');
  assert.ok((await feed.locator('.mbox img[src]').count()) <= 12);
  for (const index of [0, 20, 40, 60, 80, 100, 120]) {
    await feed.evaluate((el, rowIndex) => {
      const row = el.querySelector(`[data-key="layout-${rowIndex}"]`);
      el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top;
    }, index);
    const image = Math.floor(index / 2);
    await page.waitForFunction(
      (path) =>
        [...document.images].some((img) => img.naturalWidth === 480 && img.src.endsWith(path)),
      `/lazy-fixture-${image}.svg`,
    );
    const ahead = Math.max(...loaded) - image;
    assert.ok(ahead <= 12, `Loaded ${ahead} images ahead of the reader at row ${index}`);
    checkpoints.push({ index, ahead, requested: loaded.size });
  }
  return { rows, checkpoints };
}
