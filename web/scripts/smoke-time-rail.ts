// Shared mock/release browser checks. Notes must span several years and exceed the first window.

import { mkdir } from 'node:fs/promises';
import type { Page } from 'playwright-core';
import { smokePath } from './smoke-output.ts';
export async function railSmoke(
  page: Page,
  check: (name: string, ok: boolean) => void,
  shots = false,
): Promise<void> {
  const feed = '.view[data-kind="home"]';
  const rail = page.locator(`${feed} .time-rail`);
  // The preview can have one year before the fixture's historical page settles.
  await page.locator(`${feed} .time-rail:not(.plain) .time-year`).nth(1).waitFor();
  check('Home has a time rail', await rail.isVisible());
  const grip = rail.locator('.time-grip');
  const geometry = () =>
    grip.evaluate((el) => {
      const rail = el.closest<HTMLElement>('.time-rail')!;
      const view = el.closest<HTMLElement>('.view')!;
      const box = el.getBoundingClientRect();
      return {
        railWidth: rail.offsetWidth,
        viewWidth: view.clientWidth,
        overflow: view.scrollWidth - view.clientWidth,
        opacity: Number(getComputedStyle(el).opacity),
        cursor: getComputedStyle(rail).cursor,
        center: box.y + box.height / 2,
        height: box.height,
        width: box.width,
      };
    });
  await page.mouse.move(10, 10);
  const rest = await geometry();
  check(
    'Home shows a resting grip within a wide tile',
    rest.viewWidth >= 520 &&
      rest.railWidth === 56 &&
      rest.overflow === 0 &&
      rest.height === 32 &&
      rest.width === 6 &&
      rest.opacity > 0,
  );
  const markBox = await rail.locator('.time-marks').boundingBox();
  check('month marks have height for the honest-end fade', (markBox?.height ?? 0) > 100);
  const top = () =>
    page.locator(feed).evaluate((el) => {
      const node = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      const time = node?.querySelector('time')?.getAttribute('title') ?? '';
      return { key: node?.dataset.key, year: Number(time.slice(0, 4)), time };
    });
  const origin = await top();
  const box = await rail.boundingBox();
  if (!box) throw new Error('no rail box');
  const x = box.x + box.width - 6;
  await page.mouse.move(x, rest.center);
  const hovered = await geometry();
  check(
    'hover highlights the visible grip',
    hovered.cursor === 'grab' && hovered.opacity > rest.opacity,
  );
  const timeLabel = rail.locator('.scrub');
  await timeLabel.waitFor({ state: 'visible' });
  await timeLabel.waitFor({ state: 'hidden' });
  check(
    'hover time fades while the rail and grip stay visible',
    (await rail.isVisible()) && (await grip.isVisible()),
  );
  await page.mouse.move(x, box.y + 9);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - 9, { steps: 8 });
  await page.waitForTimeout(180);
  const held = await geometry();
  check(
    'drag keeps the grip under the pointer without horizontal overflow',
    held.cursor === 'grabbing' &&
      held.opacity === 1 &&
      held.overflow === 0 &&
      Math.abs(held.center - (box.y + box.height - held.height / 2 - 4)) < 1,
  );
  const [heldTime] = await rail.locator('.scrub:visible').allTextContents();
  await page.mouse.up();
  await rail.locator('.time-return').waitFor({ state: 'visible' });
  const oldest = Number((await rail.locator('.time-year').last().textContent()) ?? 0);
  await page
    .waitForFunction(
      ({ feed, oldest }) => {
        const el = document.querySelector(feed)!;
        const n = [...el.querySelectorAll('.list > .note')].find(
          (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
        );
        return Number(n?.querySelector('time')?.getAttribute('title')?.slice(0, 4)) === oldest;
      },
      { feed, oldest },
    )
    .catch(async (cause) => {
      throw new Error(
        `drag to oldest year ${oldest} left the top row at ${JSON.stringify(await top())}`,
        {
          cause,
        },
      );
    });
  const jumped = await top();
  check(
    'held rail says the pointer time',
    heldTime === jumped.time.slice(0, 10) || heldTime === jumped.time.slice(0, 16),
  );
  check(
    'drag to oldest year changes the top row year',
    jumped.year === oldest && jumped.year !== origin.year,
  );
  await rail.locator('.time-return').click();
  await page
    .waitForFunction(
      ({ feed, key }) => {
        const el = document.querySelector(feed)!;
        const n = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
          (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
        );
        return n?.dataset.key === key && el.querySelector<HTMLElement>('.time-return')?.hidden;
      },
      { feed, key: origin.key },
    )
    .catch(async (cause) => {
      throw new Error(
        `return tick expected ${origin.key}, got ${JSON.stringify(await top())}, visible ${await rail.locator('.time-return').isVisible()}`,
        { cause },
      );
    });
  check('return tick restores the row and disappears', (await top()).key === origin.key);
  // C2: labels keep 14px; once days are named, months read mm/dd. C3: ] steps to an older day (a month without
  // days), Backspace comes back.
  const marks = await rail.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('.time-label')].map((l) => ({
      y: l.getBoundingClientRect().top + l.getBoundingClientRect().height / 2,
      level: l.className,
      text: l.textContent ?? '',
    })),
  );
  const sorted = marks.map((m) => m.y).sort((a, b) => a - b);
  const dated = marks.some((m) => m.level.includes('time-day'));
  check(
    'rail labels keep 14px; with days, months read mm/dd',
    sorted.every((y, i) => i === 0 || y - sorted[i - 1]! >= 13.5) &&
      (!dated ||
        marks
          .filter((m) => m.level.includes('time-month'))
          .every((m) => /^\d\d\/\d\d$/.test(m.text))),
  );
  const day = () =>
    page.locator(feed).evaluate((el) => {
      const n = [...el.querySelectorAll('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      return n?.querySelector('time')?.getAttribute('title')?.slice(0, 10) ?? '';
    });
  await page.locator(feed).focus();
  const today = await day();
  await page.keyboard.press(']');
  const landedDay = await page.waitForFunction(
    ({ feed, today, originKey }) => {
      const el = document.querySelector(feed)!;
      const n = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      if (!n || n.dataset.key === originKey || !el.querySelector('.time-return:not([hidden])'))
        return false;
      // A covered note has no time element. The rail still announces its time when the jump lands.
      const time = n.classList.contains('hid')
        ? el.querySelector('.time-pin > [aria-live]')?.textContent
        : n.querySelector('time')?.getAttribute('title');
      const at = time?.slice(0, 10);
      return at && at < today ? at : false;
    },
    { feed, today, originKey: origin.key },
  );
  const older = await landedDay.jsonValue();
  await landedDay.dispose();
  await page.keyboard.press('Backspace');
  await page.waitForFunction(
    ({ feed, key }) => {
      const el = document.querySelector(feed)!;
      const n = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      return n?.dataset.key === key;
    },
    { feed, key: origin.key },
  );
  check('] goes to an older day and Backspace comes back', Boolean(older && older < today));
  if (shots) {
    await mkdir(smokePath('screens'), { recursive: true });
    const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
    for (const theme of ['dark', 'light'] as const) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      await page.waitForTimeout(180);
      await page.screenshot({ path: smokePath(`screens/rail-1440-${theme}.png`) });
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
      await mobile.bringToFront();
      const narrow = mobile.locator(`${feed} .time-rail`);
      await narrow.waitFor({ state: 'visible' });
      await mobile.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      const yearOpacity = async (hovered: boolean): Promise<boolean> => {
        const observed = await mobile.waitForFunction(
          ({ feed, hovered }) => {
            const rail = document.querySelector(`${feed} .time-rail`);
            const year = rail?.querySelector('.time-year');
            return Boolean(
              year &&
                rail?.matches(':hover') === hovered &&
                getComputedStyle(year).opacity === (hovered ? '1' : '0'),
            );
          },
          { feed, hovered },
        );
        // The rail may replace year nodes on its next paint. Assert the sampled state.
        const matches = await observed.jsonValue();
        await observed.dispose();
        return matches;
      };
      await mobile.mouse.move(20, 20);
      check('narrow time rail is 16px', (await narrow.boundingBox())?.width === 16);
      check('narrow rail shows year numbers on hover', await yearOpacity(false));
      await narrow.hover();
      check('hover reveals narrow year numbers', await yearOpacity(true));
      await mobile.mouse.move(20, 20);
      await yearOpacity(false);
      await mobile.screenshot({ path: smokePath('screens/rail-390-dark.png') });
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
