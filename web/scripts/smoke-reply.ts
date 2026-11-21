// Reply from anywhere (owner, 2026-11-21; docs/interface-thread.md T4): Reply pressed in Home, Notifications or a
// profile, or R on a note chosen with the keyboard, opens that note's thread in the same tile, seated on the note
// with what it answers in view, and puts the keyboard in the field under it, which answers that note. On a desktop
// beside another tile, and on a phone.
import type { Locator, Page } from 'playwright-core';
import { seated, seatOf } from './thread-seat.ts';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
) => Promise<Page>;

const view = '.view[data-kind="thread"]:visible';
const replyable = '.note:has(> .nrow > .nmain > .acts > .a-reply:not(.off))';
const pane = (tabs: string[], id: string) => ({ type: 'pane', id, tabs, active: tabs[0] });
const desk = {
  type: 'split',
  id: 'r',
  dir: 'row',
  children: [pane(['home', 'notifications'], 'a'), pane(['global'], 'b')],
  sizes: [0.6, 0.4],
};

/** Presses Reply (or R) on `note`, in the tile `tile`, and checks where it leads. */
async function reply(
  page: Page,
  fact: Check,
  name: string,
  tile: Locator,
  note: Locator,
  press: () => Promise<void>,
  answers = false,
): Promise<void> {
  const text = ((await note.locator('.content > .text').first().textContent()) ?? '').trim();
  const author = ((await note.locator('.nhead .name').first().textContent()) ?? '').trim();
  const tabs = await tile.locator('.tab').count();
  await press();
  await page.locator(`${view} .th-focus`).waitFor();
  const inField = () =>
    page.evaluate(() => document.activeElement?.matches('.tsay textarea') === true);
  for (let n = 0; n < 40 && !(await inField()); n++) await page.waitForTimeout(50);
  await page.waitForTimeout(400);
  const focus = (
    (await page.locator(`${view} .th-focus .content > .text`).textContent()) ?? ''
  ).trim();
  const seat = await seatOf(page);
  const hint = await page.locator(`${view} .tsay textarea`).getAttribute('placeholder');
  fact(
    `${name}: Reply opens the note's thread in the same tile`,
    (await tile.locator('.tab').count()) === tabs + 1 &&
      (await tile.locator('.tab.active[data-view^="thread"]').count()) === 1,
  );
  fact(
    `${name}: on that note, with what it answers in view`,
    text.length > 0 &&
      focus.startsWith(text.slice(0, 24)) &&
      seated(seat) &&
      (!answers || (seat?.above ?? 0) > 0),
    { text: text.slice(0, 24), focus: focus.slice(0, 24), seat },
  );
  fact(
    `${name}: the keyboard is in the field under it, which answers that note`,
    (await inField()) && Boolean(author && hint?.includes(author)),
    { author, hint },
  );
  await tile.locator('.tab.active[data-view^="thread"]').click({ button: 'middle' });
  await page.waitForTimeout(200);
  await tile.locator('.tab').first().click(); // back to Home, where the next press starts
  await page.waitForTimeout(200);
}

export async function replyChecks(open: Open, fact: Check): Promise<void> {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const on = size.width > 600 ? 'desktop' : 'phone';
    const layout = on === 'desktop' ? desk : pane(['home', 'notifications'], 'a');
    const page = await open(
      '/',
      { mock: { live: false, threads: true }, 'layout:main': layout },
      size,
    );
    const tile = page.locator('.pane[data-pane="a"]');
    const home = '.view[data-kind="home"]:visible';
    // A note that answers another (its line says what), so there is something to see above it.
    const answer = page.locator(`${home} ${replyable}:has(> .ctx .clip)`).first();
    await answer.waitFor();
    await reply(
      page,
      fact,
      `${on} Home`,
      tile,
      answer,
      () => answer.locator('.acts > .a-reply').click(),
      true,
    );
    // R on the note the keyboard is on.
    await page.locator(home).focus();
    await page.keyboard.press('j');
    const chosen = page.locator(`${home} .list > .sel`);
    await reply(page, fact, `${on} keyboard R`, tile, chosen, () => page.keyboard.press('r'));
    await tile.locator('.tab[data-view="notifications"]').click();
    const news = page.locator(`.view[data-kind="notifications"]:visible ${replyable}`).first();
    await news.waitFor();
    await reply(page, fact, `${on} Notifications`, tile, news, () =>
      news.locator('.acts > .a-reply').click(),
    );
    await tile.locator('.tab[data-view="home"]').click();
    await page.locator(`${home} ${replyable} .nhead .name`).first().click();
    const profile = page.locator(`.view[data-kind="profile"]:visible ${replyable}`).first();
    await profile.waitFor();
    await reply(page, fact, `${on} profile`, tile, profile, () =>
      profile.locator('.acts > .a-reply').click(),
    );
    await page.context().close();
  }
}
