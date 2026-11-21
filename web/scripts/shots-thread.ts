// T1 to T4 scenes (docs/interface-thread.md), from the mock's thread fixtures (`mock.threads`): a long conversation
// opened on its focus, the same tall enough to see whole, its earlier notes and one note above opened, a note above
// still being looked for and then missing, and a reply being written. Each checks what its picture is meant to show.
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { idOf } from '../src/engine/mock/world.ts';
import { seated, seatOf } from './thread-seat.ts';

type Scene = (
  name: string,
  path: string,
  act: (page: Page) => Promise<void>,
  mock?: string,
) => Promise<void>;
export const THREAD_SCENES = [
  'thread-long',
  'thread-whole',
  'thread-earlier',
  'thread-wait',
  'thread-missing',
  'thread-reply',
] as const;

const MOCK = '{"live":false,"threads":true}';
const at = (n: number): string => `/n/note1${idOf(n).slice(0, 58)}`;
const LONG = at(7004);
const MISSING = at(7101);
const view = '.view[data-kind="thread"]:visible';

/** The thread's scroller shows everything from its top, as tall as the page allows. */
async function whole(page: Page, height: number): Promise<void> {
  const width = page.viewportSize()?.width ?? 1440;
  await page.setViewportSize({ width, height });
  await page.locator(view).evaluate((v) => void (v.scrollTop = 0));
  await page.waitForTimeout(300);
}

export async function threadShots(scene: Scene): Promise<void> {
  await scene(
    'thread-long',
    LONG,
    async (page) => {
      const focus = page.locator(`${view} .th-focus`);
      await focus.waitFor();
      await page.locator(`${view} .tfold.th-step`).first().waitFor();
      // It opens on its focus, about a third down the tile, with what it answers in view above it.
      await page.waitForTimeout(300);
      const seat = await seatOf(page);
      assert.ok(seated(seat), `the focus is seated with its context: ${JSON.stringify(seat)}`);
      assert.ok(
        (await page.locator(`${view} .th-reply > .ctx`).count()) >= 2,
        'nested replies say whom they answer',
      );
      assert.equal(
        await page.locator(`${view} .th-focus .fold`).count(),
        0,
        'the focus is never folded',
      );
    },
    MOCK,
  );
  await scene(
    'thread-whole',
    LONG,
    async (page) => {
      await page.locator(`${view} .th-focus`).waitFor();
      await whole(page, (page.viewportSize()?.width ?? 1440) < 500 ? 3600 : 2600);
      await page.locator(`${view} .tfold.th-above`).waitFor();
    },
    MOCK,
  );
  await scene(
    'thread-earlier',
    LONG,
    async (page) => {
      await page.locator(`${view} .th-focus`).waitFor();
      await whole(page, (page.viewportSize()?.width ?? 1440) < 500 ? 1400 : 1100);
      await page.locator(`${view} .tfold.th-above`).click();
      const compact = page.locator(`${view} .th-compact`);
      assert.equal(await compact.count(), 4, 'all four notes above, compact');
      const heights = await compact.evaluateAll((all) =>
        all.map((n) => n.getBoundingClientRect().height),
      );
      assert.equal(new Set(heights).size, 1, `compact notes share one height: ${heights}`);
      await compact.nth(1).click();
      await page.locator(`${view} .th-ancestor:not(.th-compact) .acts`).waitFor();
      await page.locator(view).evaluate((v) => void (v.scrollTop = 0));
    },
    MOCK,
  );
  await scene(
    'thread-wait',
    MISSING,
    async (page) => {
      await page.locator(`${view} .tslot:not(.missing)`).waitFor();
      await page.locator(view).evaluate((v) => void (v.scrollTop = 0));
    },
    MOCK,
  );
  await scene(
    'thread-missing',
    MISSING,
    async (page) => {
      const slot = page.locator(`${view} .tslot`);
      const loading = (await slot.boundingBox())?.height;
      await page.locator(`${view} .tslot.missing`).waitFor({ timeout: 9000 });
      const missing = (await slot.boundingBox())?.height;
      const compact = (await page.locator(`${view} .th-compact`).first().boundingBox())?.height;
      assert.ok(
        loading && loading === missing && missing === compact,
        `one height: ${loading}, ${missing}, ${compact}`,
      );
      await page.locator(view).evaluate((v) => void (v.scrollTop = 0));
    },
    MOCK,
  );
  await scene(
    'thread-reply',
    LONG,
    async (page) => {
      await page.locator(`${view} .th-focus .acts > .a-reply`).click();
      const field = page.locator(`${view} .tsay textarea`);
      assert.ok(
        await field.evaluate((f) => f === document.activeElement),
        'reply puts the keyboard in the field',
      );
      const ja = await page.evaluate(() => document.documentElement.lang === 'ja');
      await page.keyboard.type(
        ja ? '橋のたもとのバス停、使ってみます。' : 'I will try the bus stop by the bridge.',
      );
      await page.locator(`${view} .tsay .cbar`).waitFor();
    },
    MOCK,
  );
}
