// The time rail over a Home whose dense recent weeks sit above a sparse old tail (the mock world: four busy weeks,
// then one archive note a month for years). Owner report 2026-11-26: the old tail pulled the scale so the labels went
// vague, a drag to the bottom broke, the rail showed nothing, and the grip stuck to the top after scrolling down.
import type { Page } from 'playwright-core';

const feed = '.view[data-kind="home"]';
type Sample = { top: number; height: number; grip: number; scroll: number; key?: string };
const sample = (page: Page): Promise<Sample> =>
  page.locator(feed).evaluate((el) => {
    const rail = el.querySelector<HTMLElement>('.time-rail')!.getBoundingClientRect();
    const grip = el.querySelector<HTMLElement>('.time-grip')!.getBoundingClientRect();
    const node = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
      (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
    );
    return {
      top: rail.top,
      height: rail.height,
      grip: grip.top + grip.height / 2 - rail.top,
      scroll: el.scrollTop,
      key: node?.dataset.key,
    };
  });

export async function railTailChecks(
  page: Page,
  check: (name: string, ok: boolean, detail?: unknown) => void,
): Promise<void> {
  const rail = page.locator(`${feed} .time-rail`);
  await rail.waitFor({ state: 'visible' });
  // 1. Scale: the busy weeks keep most of the rail, named by day; the years of the tail stay named below.
  const marks = await rail.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const h = el.getBoundingClientRect().height;
    return [...el.querySelectorAll<HTMLElement>('.time-label')].map((l) => ({
      at: (l.getBoundingClientRect().top - top) / h,
      level: l.className.includes('time-year')
        ? 'year'
        : l.className.includes('time-day')
          ? 'day'
          : 'month',
      text: l.textContent ?? '',
    }));
  });
  const years = marks.filter((m) => m.level === 'year').sort((a, b) => a.at - b.at);
  const days = marks.filter((m) => m.level === 'day');
  check(
    'sparse old tail: recent days named over most of the rail, tail years below',
    days.length >= 8 && (years[1]?.at ?? 0) > 0.6 && years.length >= 4,
    marks,
  );
  // 2. Scrolling down some way never leaves the grip at the top.
  const view = page.locator(feed);
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const start = await sample(page);
  const stuck: Sample[] = [];
  let lowest = 0;
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(40);
    const s = await sample(page);
    // Down the list the grip only goes down; back at the top's clamp after leaving it is the reported snap.
    if (s.grip < lowest - 2 || (lowest > 24 && s.grip <= 17)) stuck.push(s);
    lowest = Math.max(lowest, s.grip);
  }
  const scrolled = await sample(page);
  check(
    'grip follows a long scroll down and never snaps to the top',
    stuck.length === 0 && scrolled.scroll > scrolled.height && scrolled.grip > 24,
    { stuck, scrolled },
  );
  // 3. A long drag to the very bottom reaches the oldest note and stays there.
  const r = (await rail.boundingBox())!;
  const x = r.x + r.width - 6;
  await page.mouse.move(x, r.y + 12);
  await page.mouse.down();
  await page.mouse.move(x, r.y + r.height + 40, { steps: 24 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const landed = await sample(page);
  const oldest = await page.locator(feed).evaluate((el) => {
    const notes = [...el.querySelectorAll<HTMLElement>('.list > .note time')];
    return notes
      .map((t) => t.getAttribute('title') ?? '')
      .sort()[0]
      ?.slice(0, 4);
  });
  const topYear = await page.locator(feed).evaluate((el) => {
    const n = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
      (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
    );
    return n?.querySelector('time')?.getAttribute('title')?.slice(0, 4);
  });
  const later: Sample[] = [];
  for (let i = 0; i < 5; i++) await page.waitForTimeout(200), later.push(await sample(page));
  check(
    'drag past the bottom reaches the oldest note and holds steady',
    topYear === oldest &&
      landed.grip > landed.height * 0.9 &&
      later.every((s) => s.key === landed.key && Math.abs(s.grip - landed.grip) < 2),
    { landed, later, oldest, topYear },
  );
  // Back to the newest for the checks that follow.
  await page.locator(feed).focus();
  await page.keyboard.press('Home');
  await page.waitForFunction(
    ({ feed, key }) => {
      const el = document.querySelector(feed)!;
      const n = [...el.querySelectorAll<HTMLElement>('.list > .note')].find(
        (n) => n.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 1,
      );
      return n?.dataset.key === key;
    },
    { feed, key: start.key },
  );
}
