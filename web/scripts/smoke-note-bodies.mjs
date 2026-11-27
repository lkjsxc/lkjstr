import assert from 'node:assert/strict';

export const foldImagePattern = /\/fold-image-\d+\.svg(?:\?.*)?$/;
export const foldImage = (url) => {
  const index = Number(url.match(/fold-image-(\d+)/)?.[1] ?? 0);
  const [sky, hill] = [
    ['#7eafc2', '#356052'],
    ['#deb287', '#8c514f'],
    ['#b9b4ce', '#5a656d'],
    ['#d8c68f', '#6e6c49'],
  ][index];
  return {
    contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="480" viewBox="0 0 280 480">
      <rect width="280" height="480" fill="${sky}"/>
      <circle cx="${72 + 40 * index}" cy="154" r="29" fill="#eee1b2"/>
      <path d="M0 314 93 217 172 318 232 268 280 311V480H0Z" fill="${hill}"/>
      <path d="M0 375 50 356 122 386 204 346 280 363V480H0Z" fill="#243a3b"/>
    </svg>`,
  };
};

async function sample(page) {
  return page.locator('.list > .note').evaluateAll((rows) =>
    rows.map((row) => {
      const body = row.querySelector('.content');
      const { height, top } = body.getBoundingClientRect();
      return {
        fold: row.querySelector('.fold')?.getAttribute('aria-expanded') ?? null,
        height,
        top,
        natural: body.scrollHeight,
        line: Number.parseFloat(getComputedStyle(body).lineHeight),
        images: [...body.querySelectorAll('img')].map((node) => node.naturalWidth),
      };
    }),
  );
}

export async function checkNoteBodies(page) {
  const result = [];
  for (const width of [720, 390]) {
    let release;
    const held = new Promise((done) => (release = done));
    const respond = async (route) => {
      await held;
      await route.fulfill(foldImage(route.request().url()));
    };
    await page.route(foldImagePattern, respond);
    try {
      await page.evaluate((width) => globalThis.noteLayout.prepareBodies(width), width);
      const pending = await sample(page);
      assert.deepEqual(
        pending.map((item) => item.fold),
        ['false', null, 'false'],
      );
      assert.equal(pending[0].images.length, 4);
      assert(
        pending[0].images.every((size) => size === 0),
        JSON.stringify({ width, pending }),
      );
      for (const note of [pending[0], pending[2]]) {
        assert.equal(note.height, 12 * note.line);
        assert(note.natural > note.height);
      }
      release();
      const images = page.locator('.list .media img');
      await images.first().evaluate((img) => img.decode());
      const loaded = await sample(page);
      assert.equal(loaded[0].height, pending[0].height);
      assert.equal(loaded[1].top, pending[1].top);

      const note = page.locator('.list > .note').first();
      const toggle = note.locator('.fold');
      await page.locator('.view').evaluate((view) => {
        view.style.height = '450px';
        view.scrollTop = 100;
      });
      const [before] = await sample(page);
      await toggle.click();
      await page.evaluate(() => globalThis.noteLayout.repeat());
      const [after] = await sample(page);
      assert.equal(after.top, before.top);
      assert.equal(after.fold, 'true');
      assert.equal(await toggle.textContent(), 'Show less');
      assert.equal(after.height, after.natural);
      assert(after.height > before.height);
      assert.equal(await note.locator('.mbox[inert]').count(), 0);
      await toggle.click();
      await page.evaluate(() => globalThis.noteLayout.remountNotes());
      const [collapsed] = await sample(page);
      assert.equal(collapsed.fold, 'false');
      assert.equal(collapsed.height, pending[0].height);
      assert.equal(await toggle.textContent(), 'Show more');
      result.push({ width, pending, loaded, before, after, collapsed });
    } finally {
      release();
      await page.unroute(foldImagePattern, respond);
    }
  }
  return result;
}
