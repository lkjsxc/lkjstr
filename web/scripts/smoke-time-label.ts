// The scroll time label (docs/interface-time.md C1), on the mock: a wheel, a touch-free key or a dragged thumb shows
// `yyyy/mm/dd HH:mm` beside the thumb (the rail's place line, or the native scrollbar's thumb), inside the tile; it
// goes a second after the last scroll; scrolls the list makes itself (a reload, a restored place, a script) show
// nothing. On a desktop and a phone.
import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
) => Promise<Page>;

const FORMAT = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/;
const pane = (tabs: string[]) => ({ type: 'pane', id: 'a', tabs, active: tabs[0] });

/** The shown label of the list in front, where it stands, and where the thumb it belongs to is. */
const said = (page: Page) =>
  page.evaluate(() => {
    const view = document.querySelector<HTMLElement>('.pane.cur .view.feed:not([hidden])');
    const label = [...(view?.querySelectorAll<HTMLElement>('.scrub') ?? [])].find((l) => !l.hidden);
    if (!view || !label) return null;
    const box = view.getBoundingClientRect();
    const r = label.getBoundingClientRect();
    const line = view
      .querySelector('.time-rail:not([hidden]) .time-place')
      ?.getBoundingClientRect();
    const h = view.clientHeight;
    const thumb = Math.max(24, (h * h) / view.scrollHeight);
    const room = view.scrollHeight - h;
    const native = box.top + (room > 0 ? (view.scrollTop / room) * (h - thumb) + thumb / 2 : h / 2);
    return {
      text: label.textContent ?? '',
      rail: Boolean(line),
      off:
        Math.round((r.top + r.height / 2 - (line ? line.top + line.height / 2 : native)) * 10) / 10,
      inside: r.top >= box.top && r.bottom <= box.bottom && r.right <= box.left + view.clientWidth,
      // Near an end the label stays 4px inside the tile instead of centring on the thumb.
      clamped: Math.abs(r.top - box.top - 4) < 1.5 || Math.abs(box.top + h - r.bottom - 4) < 1.5,
      width: Math.round(r.width),
    };
  });

async function wheel(page: Page, dy: number): Promise<void> {
  const box = await page.locator('.pane.cur .view.feed:not([hidden])').boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(250);
}

export async function timeLabelChecks(open: Open, fact: Check): Promise<void> {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const on = size.width > 600 ? 'desktop' : 'phone';
    const page = await open(
      '/',
      { mock: { live: false }, 'layout:main': pane(['home', 'notifications']) },
      size,
    );
    await page.waitForTimeout(600);
    fact(`${on}: no label for a list that opens`, (await said(page)) === null);
    for (const tab of ['home', 'notifications']) {
      await page.locator(`.pane.cur .tab[data-view="${tab}"]`).click();
      await page.waitForTimeout(400);
      await wheel(page, 900);
      const one = await said(page);
      fact(
        `${on} ${tab}: a wheel shows the date and time beside the thumb, inside the tile`,
        one !== null &&
          FORMAT.test(one.text) &&
          (Math.abs(one.off) <= 1.5 || one.clamped) &&
          one.inside,
        one,
      );
      await wheel(page, 900);
      const two = await said(page);
      fact(`${on} ${tab}: its width holds while digits change`, two?.width === one?.width, {
        one,
        two,
      });
      await page.waitForTimeout(1100);
      fact(`${on} ${tab}: it goes a second after the last scroll`, (await said(page)) === null);
      await page.locator('.pane.cur .view.feed:not([hidden])').evaluate((v) => v.scrollBy(0, 400));
      await page.waitForTimeout(250);
      fact(
        `${on} ${tab}: a scroll the reader did not make shows nothing`,
        (await said(page)) === null,
      );
      await page.locator('.pane.cur .view.feed:not([hidden])').focus();
      await page.keyboard.press('PageUp'); // scrolled down by now: the way back up is open
      await page.waitForTimeout(250);
      fact(`${on} ${tab}: a scrolling key shows it`, FORMAT.test((await said(page))?.text ?? ''));
      await page.waitForTimeout(1100);
    }
    await page.reload();
    await page.waitForSelector('.note');
    await page.waitForTimeout(800);
    fact(`${on}: no label when a reload puts the place back`, (await said(page)) === null);
    await page.context().close();
  }
}
