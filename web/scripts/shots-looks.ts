// Focused review scenes. Assertions use the rendered app and loopback-only test double.
import type { Page } from 'playwright-core';
import { createWorld } from '../src/engine/mock/world.ts';

type Scene = (name: string, path: string, act: (page: Page) => Promise<void>) => Promise<void>;
const assert = (ok: boolean, why: string) => {
  if (!ok) throw new Error(why);
};
export async function looksShots(scene: Scene, statsWord: string, phone: boolean) {
  const railKind = phone ? 'profile' : 'home';
  await scene('looks-rail', phone ? '/p/aoi' : '/', async (page) => {
    const rail = page.locator(`.view[data-kind="${railKind}"]:visible .time-rail`);
    await rail.waitFor({ state: 'visible' });
    assert(
      (await rail.locator('.time-grip').boundingBox())?.width === 6,
      'resting grip spans only dots',
    );
    assert((await rail.locator('.time-year.current').count()) === 1, 'one current year');
    const overlap = await rail.evaluate((el) => {
      const grip = el.querySelector('.time-grip')!.getBoundingClientRect();
      return [...el.querySelectorAll('.time-year')].some((year) => {
        const r = year.getBoundingClientRect();
        return r.right > grip.left && r.left < grip.right;
      });
    });
    assert(!overlap, 'year column does not intersect grip');
  });
  await scene('looks-rows', '/', async (page) => {
    const row = page
      .locator('.view[data-kind="home"] .note')
      .filter({ hasText: 'Historical name fixture' });
    const feed = page.locator('.view[data-kind="home"]');
    await feed.focus();
    // Month seeks bring the fixture into a fresh window without scraping or changing product DOM.
    await page.keyboard.press('End');
    await row.waitFor();
    await row.scrollIntoViewIfNeeded();
    await feed.evaluate((el) => {
      const row = [...el.querySelectorAll<HTMLElement>('.note')].find((n) =>
        n.textContent?.includes('Historical name fixture'),
      )!;
      el.scrollTop += row.offsetTop - el.scrollTop - 30;
    });
    assert(
      (await row.locator('.nhead time').innerText()).match(/^\d\d:\d\d$/) !== null,
      'dated row uses clock',
    );
    assert(
      await row.locator('.nhead .name').evaluate((el) => el.scrollWidth <= el.clientWidth),
      '14-letter name fits',
    );
  });
  await scene('looks-card', '/', async (page) => {
    const row = page.locator('.note').filter({ hasText: 'Two pages.' }).first();
    await row.locator('.nhead time').click();
    await page.locator('.th-focus .link-card').first().waitFor();
    const cards = page.locator('.th-focus .link-card');
    assert((await cards.count()) === 2, 'two distinct pages');
    for (const card of await cards.all())
      assert((await card.boundingBox())!.width <= 560, 'card maximum width');
  });
  await scene('looks-card-failed', '/', async (page) => {
    await page
      .locator('.note')
      .filter({ has: page.locator('.text a[href="https://unavailable.example/path"]') })
      .first()
      .locator('.nhead time')
      .click();
    await page.locator('.th-focus').waitFor();
    assert(
      (await page.locator('.th-focus .link-card').count()) === 0,
      'failure has no fallback card',
    );
    assert((await page.locator('.th-focus .text a').count()) === 1, 'original link remains');
  });
  await scene('looks-reactions', '/', async (page) => {
    const fixture = createWorld(Date.now()).notes.find((note) =>
      note.text.startsWith('Reading the relay list spec again.'),
    )!;
    await page.goto(new URL(`/n/note1${fixture.id.slice(0, 58)}`, page.url()).href);
    const note = page.locator('.th-focus');
    await note.waitFor();
    assert((await note.locator('.a-heart > span').innerText()) === '', 'chips own reaction count');
    assert(!(await note.locator('.chips').innerText()).includes('+'), 'fixture has no relay limit');
  });
  await scene('looks-tabsearch', '/', async (page) => {
    await page.locator('.bar [data-tab-search]').click();
    await page.locator('.tsearch input').waitFor();
    const titles = await page.locator('.titem > span:first-child').allTextContents();
    const open = await page.locator('.titem.open > span:first-child').allTextContents();
    for (const title of open)
      assert(titles.filter((x) => x === title).length === 1, 'no duplicate open kind');
  });
  for (const name of ['looks-stats', 'looks-stats-open', 'looks-requests-open']) {
    await scene(name, '/', async (page) => {
      await page.keyboard.press('Alt+Shift+N');
      await page.keyboard.type(statsWord);
      await page.locator('.ncard > b').getByText(statsWord, { exact: true }).first().click();
      const stats = page.locator('.statsv');
      await stats.locator('.relay-stats tbody tr').first().waitFor();
      if (name === 'looks-stats-open')
        await stats.locator('.relay-stats .stats-toggle.s-connected').first().click();
      if (name === 'looks-requests-open') {
        await stats.locator('.request-stats .stats-toggle').first().click();
        if (page.viewportSize()!.width === 390)
          await stats
            .locator('.request-stats .stats-detail:not([hidden])')
            .scrollIntoViewIfNeeded();
      }
      if (page.viewportSize()!.width === 390) {
        assert(
          (await stats.locator('.relay-stats .c-health').first().boundingBox())!.width > 100,
          'relay column keeps its measure',
        );
        for (const detail of await stats.locator('.stats-detail:not([hidden])').all()) {
          const widths = await detail.evaluate((el) => [
            el.getBoundingClientRect().width,
            el.closest('table')!.getBoundingClientRect().width,
          ]);
          assert(Math.abs(widths[0]! - widths[1]!) < 2, 'detail spans visible columns');
        }
      }
      assert(await stats.evaluate((el) => el.scrollWidth <= el.clientWidth), 'Stats fits its tile');
      assert(
        await stats
          .locator('.stats-table')
          .evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth)),
        'tables do not scroll sideways',
      );
      if (name === 'looks-stats-open' && page.viewportSize()!.width === 390) {
        await page.reload();
        await stats.locator('.stats-detail:not([hidden])').waitFor({ state: 'visible' });
      }
    });
  }
}
