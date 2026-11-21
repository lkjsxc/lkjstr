// The moment tab (docs/interface-moment.md C4), on the mock: pressing a note's time opens the author's Home at that
// time in the same tile, named by the author and the time; the moment line stands where the time falls, a third down
// the tile, newer notes above and older below, with the follow list's own date and "From this device only"; there is
// no filter row; the text still opens the thread; A does what the press does; a reload keeps the reading place.
import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
) => Promise<Page>;

const view = '.view[data-kind="their-home"]:visible';
const home = '.view[data-kind="home"]:visible';
const STAMP = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/;

/** The moment tab as drawn: its line, where it stands, and the times of the notes on each side of it. */
const seen = (page: Page) =>
  page.locator(view).evaluate((v) => {
    const line = v.querySelector<HTMLElement>('.list > .moment');
    if (!line) return null;
    const time = (n: Element): number => {
      const [d, c] = (n.querySelector('.nhead time')?.getAttribute('title') ?? '').split(' ');
      const [y, mo, da] = (d ?? '').split('/').map(Number);
      const [h, mi, s] = (c ?? '').split(':').map(Number);
      return new Date(y ?? 0, (mo ?? 1) - 1, da ?? 0, h ?? 0, mi ?? 0, s ?? 0).getTime();
    };
    const notes = [...v.querySelectorAll('.list > .note')];
    const at = notes.indexOf(line.nextElementSibling as Element);
    const above = notes.filter((n) => n.compareDocumentPosition(line) & 4).map(time);
    const below = notes.filter((n) => line.compareDocumentPosition(n) & 4).map(time);
    return {
      top: Math.round(line.getBoundingClientRect().top - v.getBoundingClientRect().top),
      third: Math.round(v.clientHeight / 3),
      scrolled: Math.round(v.scrollTop),
      text: line.textContent ?? '',
      time: line.querySelector('.mtime')?.textContent ?? '',
      face: Boolean(line.querySelector('.av')),
      above,
      below,
      at,
      bar: (v.querySelector<HTMLElement>('.fslot')?.offsetHeight ?? 0) > 0,
    };
  });

export async function momentChecks(open: Open, fact: Check): Promise<void> {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const on = size.width > 600 ? 'desktop' : 'phone';
    const page = await open(
      '/',
      {
        mock: { live: false },
        'layout:main': { type: 'pane', id: 'a', tabs: ['home'], active: 'home' },
      },
      size,
    );
    const note = page.locator(`${home} .note:has(.nhead > .tmoment)`).nth(3);
    const name = ((await note.locator('.nhead .name').first().textContent()) ?? '').trim();
    const stamp = ((await note.locator('.nhead time').getAttribute('title')) ?? '').slice(0, 16);
    await note.locator('.nhead > .tmoment').click();
    await page.locator(`${view} .moment`).waitFor();
    await page.waitForTimeout(600);
    const tabs = await page
      .locator('.pane .tab')
      .evaluateAll((all) =>
        all.map(
          (t) => `${t.getAttribute('data-view')}${t.classList.contains('active') ? '*' : ''}`,
        ),
      );
    const title = ((await page.locator('.pane .tab.active > span').textContent()) ?? '').trim();
    fact(
      `${on}: a note's time opens the author's Home at that time, right after Home, in front`,
      tabs[0] === 'home' && /^their-home.*\*$/.test(tabs[1] ?? '') && title === `${name} ${stamp}`,
      { tabs, title, name, stamp },
    );
    const s = await seen(page);
    fact(
      `${on}: the moment line stands where the time falls, a third down (or the list at its top)`,
      s !== null &&
        STAMP.test(s.time) &&
        s.face &&
        s.above.every((t) => t > (s.below[0] ?? 0)) &&
        (Math.abs(s.top - s.third) <= 1 || s.scrolled === 0) &&
        s.below.length > 0,
      s,
    );
    fact(
      `${on}: it says the follow list's own date and that this is from this device only`,
      Boolean(s?.text.includes('Latest follows') && s.text.includes('From this device only')),
      s?.text,
    );
    fact(`${on}: a moment tab has no filter row`, s?.bar === false);
    // From here every window the page asks is traced (the engine's worker or the real transport's port).
    await page.context().addInitScript(() => {
      const seenWindows: unknown[] = [];
      (globalThis as { __windows?: unknown[] }).__windows = seenWindows;
      for (const proto of [Worker.prototype, MessagePort.prototype] as {
        postMessage: (m: unknown, ...r: unknown[]) => void;
      }[]) {
        const post = proto.postMessage;
        proto.postMessage = function (this: unknown, m: unknown, ...rest: unknown[]) {
          if ((m as { t?: string })?.t === 'window') seenWindows.push(m);
          return post.call(this, m, ...rest);
        };
      }
    });
    await page.reload();
    await page.locator(`${view} .moment`).waitFor();
    await page.waitForTimeout(600);
    const again = await seen(page);
    fact(
      `${on}: after a reload the moment tab is where it was`,
      again !== null && s !== null && Math.abs(again.top - s.top) <= 1,
      { before: s?.top, after: again?.top },
    );
    // Scrolling to both ends grows the window by its time alone: no head, key or month window ever leaves the pivot.
    for (const to of ['bottom', 'top', 'bottom'])
      await page
        .locator(view)
        .evaluate((v, end) => void (v.scrollTop = end === 'top' ? 0 : v.scrollHeight), to),
        await page.waitForTimeout(500);
    const windows = await page.evaluate(
      () => (globalThis as { __windows?: { sub: string; anchor: unknown }[] }).__windows ?? [],
    );
    const pivots = new Set(
      windows
        .filter((w) => typeof w.anchor === 'object' && w.anchor && 'at' in w.anchor)
        .map((w) => w.sub),
    );
    const strays = windows.filter(
      (w) => pivots.has(w.sub) && !(typeof w.anchor === 'object' && w.anchor && 'at' in w.anchor),
    );
    fact(
      `${on}: scrolling to both ends keeps the time window, and the moment line stays`,
      pivots.size > 0 &&
        strays.length === 0 &&
        windows.filter((w) => pivots.has(w.sub)).length > 1 &&
        (await page.locator(`${view} .moment`).count()) === 1,
      { asked: windows.filter((w) => pivots.has(w.sub)).length, strays },
    );
    // Back in Home: the text still opens the thread, and A on a chosen note opens its moment.
    await page.locator('.pane .tab[data-view="home"]').click();
    await page.locator(`${home} .note`).first().waitFor();
    await page.locator(home).focus();
    await page.keyboard.press('j');
    await page.keyboard.press('a');
    await page.waitForTimeout(400);
    fact(
      `${on}: A on the chosen note opens its moment`,
      (await page.locator('.pane .tab.active[data-view^="their-home"]').count()) === 1,
    );
    await page.locator('.pane .tab[data-view="home"]').click();
    await page
      .locator(`${home} .note .content > .text`)
      .first()
      .click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(400);
    fact(
      `${on}: the text still opens the thread`,
      (await page.locator('.pane .tab.active[data-view^="thread"]').count()) === 1,
    );
    await page.context().close();
  }
}
