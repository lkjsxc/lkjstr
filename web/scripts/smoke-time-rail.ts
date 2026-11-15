// Shared mock/release browser checks. Notes must span several years and exceed the first window.
import { mkdir } from 'node:fs/promises';
import type { Page } from 'playwright-core';
export async function railSmoke(
  page: Page,
  check: (name: string, ok: boolean) => void,
  shots = false,
): Promise<void> {
  const feed = '.view[data-kind="home"]';
  const rail = page.locator(`${feed} .time-rail`);
  await rail.waitFor({ state: 'visible' });
  check('Home has a time rail', await rail.isVisible());
  const markBox = await rail.locator('.time-marks').boundingBox();
  check('month marks have height for the honest-end fade', (markBox?.height ?? 0) > 100);
  const top = () =>
    page.locator(feed).evaluate((el) => {
      const node = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      return {
        key: node?.dataset.key,
        year: Number(node?.querySelector('time')?.getAttribute('title')?.slice(0, 4)),
      };
    });
  const origin = await top();
  const box = await rail.boundingBox();
  if (!box) throw new Error('no rail box');
  const x = box.x + box.width - 6;
  await page.mouse.move(x, box.y + 9);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - 9, { steps: 8 });
  await page.waitForTimeout(180);
  check('held rail says the pointer time', await rail.locator('.scrub').isVisible());
  await page.mouse.up();
  await page.waitForFunction((feed) => {
    const el = document.querySelector(feed)!;
    const tick = el.querySelector<HTMLElement>('.time-return');
    return tick && !tick.hidden;
  }, feed);
  const oldest = Number((await rail.locator('.time-year').last().textContent()) ?? 0);
  await page.waitForFunction(
    ({ feed, oldest }) => {
      const el = document.querySelector(feed)!;
      const n = [...el.querySelectorAll('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      return Number(n?.querySelector('time')?.getAttribute('title')?.slice(0, 4)) === oldest;
    },
    { feed, oldest },
  );
  const jumped = await top();
  check(
    'drag to oldest year changes the top row year',
    jumped.year === oldest && jumped.year !== origin.year,
  );
  await rail.locator('.time-return').click();
  await page.waitForFunction(
    ({ feed, key }) => {
      const el = document.querySelector(feed)!;
      const n = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      return n?.dataset.key === key && el.querySelector<HTMLElement>('.time-return')?.hidden;
    },
    { feed, key: origin.key },
  );
  check('return tick restores the row and disappears', (await top()).key === origin.key);
  if (shots) {
    // Paths are absolute because the release driver runs from the repository root.
    const root = new URL('../../tmp/screens/', import.meta.url).pathname;
    await mkdir(root, { recursive: true });
    const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
    for (const theme of ['dark', 'light'] as const) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      await page.waitForTimeout(180);
      await page.screenshot({ path: `${root}rail-1440-${theme}.png` });
    }
    const layout = await page.evaluate(() => localStorage.getItem('lkjstr:layout:main'));
    const mobile = await page.context().newPage();
    try {
      await mobile.setViewportSize({ width: 390, height: 844 });
      await mobile.addInitScript(() =>
        localStorage.setItem(
          'lkjstr:layout:main',
          JSON.stringify({ type: 'pane', id: 'rail-phone', tabs: ['home'], active: 'home' }),
        ),
      );
      await mobile.goto(page.url());
      const narrow = mobile.locator(`${feed} .time-rail`);
      await narrow.waitFor({ state: 'visible' });
      await mobile.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      check('narrow time rail is 16px', (await narrow.boundingBox())?.width === 16);
      check(
        'narrow rail shows year numbers on hover',
        (await narrow
          .locator('.time-year')
          .first()
          .evaluate((e) => getComputedStyle(e).opacity)) === '0',
      );
      await narrow.hover();
      check(
        'hover reveals narrow year numbers',
        (await narrow
          .locator('.time-year')
          .first()
          .evaluate((e) => getComputedStyle(e).opacity)) === '1',
      );
      await mobile.mouse.move(20, 20);
      await mobile.screenshot({ path: `${root}rail-390-dark.png` });
    } finally {
      await mobile.close();
      await page.evaluate(
        ({ layout, themeBefore }) => {
          if (layout) localStorage.setItem('lkjstr:layout:main', layout);
          if (themeBefore) document.documentElement.dataset.theme = themeBefore;
          else delete document.documentElement.dataset.theme;
        },
        { layout, themeBefore },
      );
      await page.reload();
      await page.locator(`${feed} .time-rail`).waitFor({ state: 'visible' });
    }
  }
}
