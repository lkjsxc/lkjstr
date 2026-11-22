// Relay text far past any sane length (the mock's `stress` world: names with nowhere to break, right-to-left names,
// emoji runs, long addresses, words, client names, card titles, chip codes, channel and set names) never breaks a
// row. In every view the reader walks through, at desktop and phone width: nothing reaches past its view (the time,
// the actions and close buttons stay on screen), no view or page scrolls sideways, and text cut with an ellipsis
// keeps its whole self in a tooltip.
import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  given: Record<string, unknown>,
  size: { width: number; height: number },
) => Promise<Page>;
type Shot = (page: Page, name: string) => Promise<void>;

const tile = (id: string, tabs: string[]): unknown => ({ type: 'pane', id, tabs, active: tabs[0] });
/** The narrow tiles of a desktop, where long text runs out of room first; on a phone, one tile. */
const layout = (width: number): unknown =>
  width < 760
    ? tile('a', ['home', 'notifications', 'channels', 'account', 'compose'])
    : {
        type: 'split',
        id: 'r',
        dir: 'row',
        sizes: [0.4, 0.3, 0.3],
        children: [
          tile('a', ['home', 'channels']),
          tile('b', ['notifications', 'compose']),
          tile('c', ['account']),
        ],
      };

/** What breaks a row, as `view: element path`, at most 24 lines. */
export function overflows(): string[] {
  const bad: string[] = [];
  const name = (e: Element): string =>
    e.tagName.toLowerCase() +
    (typeof e.className === 'string' && e.className.trim()
      ? `.${e.className.trim().split(/\s+/).join('.')}`
      : '');
  const path = (e: Element, stop: Element): string => {
    const parts: string[] = [];
    for (let x: Element | null = e; x && x !== stop && parts.length < 4; x = x.parentElement)
      parts.unshift(name(x));
    return parts.join(' > ');
  };
  const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const page = document.documentElement;
  if (page.scrollWidth > innerWidth) bad.push(`page scrolls sideways: ${page.scrollWidth}`);
  // Views, and what floats over them: tab search, the emoji picker.
  for (const view of document.querySelectorAll<HTMLElement>('.view, .tsearch, .epick')) {
    const box = view.getBoundingClientRect();
    if (!box.width || !view.checkVisibility()) continue;
    const kind = view.dataset.kind ?? view.classList[0] ?? '?';
    if (view.scrollWidth > view.clientWidth + 1)
      bad.push(`${kind} scrolls sideways: ${view.scrollWidth} > ${view.clientWidth}`);
    for (const e of view.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || (r.right <= box.right + 1 && r.left >= box.left - 1)) continue;
      let clipped = false; // cut inside the view by a box that hides what is past it
      for (let a = e.parentElement; a && a !== view && !clipped; a = a.parentElement) {
        if (getComputedStyle(a).overflowX === 'visible') continue;
        const ar = a.getBoundingClientRect();
        clipped = ar.right <= box.right + 1 && ar.left >= box.left - 1;
      }
      if (!clipped)
        bad.push(`${kind}: ${path(e, view)} reaches ${Math.round(r.right - box.right)}px past`);
    }
    for (const e of view.querySelectorAll<HTMLElement>('*')) {
      if (getComputedStyle(e).textOverflow !== 'ellipsis' || e.scrollWidth <= e.clientWidth + 1)
        continue;
      const text = flat(e.textContent ?? '');
      const holder = e.closest('[title]');
      const tip = holder && view.contains(holder) ? flat(holder.getAttribute('title') ?? '') : '';
      // Text the code already shortened ("via A long na…") is whole when each word it shows in full is there.
      const shown = text.endsWith('…')
        ? text
            .split(' ')
            .slice(0, -1)
            .every((word) => tip.includes(word))
        : tip.includes(text);
      if (text && !shown) bad.push(`${kind}: ${path(e, view)} is cut, its tooltip lacks it`);
    }
  }
  for (const tab of document.querySelectorAll<HTMLElement>('.tab')) {
    const box = tab.getBoundingClientRect();
    const x = tab.querySelector('.x')?.getBoundingClientRect();
    if (x && box.width && (x.right > box.right + 1 || x.left < box.left - 1))
      bad.push(`tab ${tab.dataset.view}: its close button is outside it`);
    const title = tab.querySelector<HTMLElement>(':scope > span');
    if (title && title.scrollWidth > title.clientWidth + 1 && tab.title !== title.textContent)
      bad.push(`tab ${tab.dataset.view}: its cut title is not its tooltip`);
  }
  return [...new Set(bad)].slice(0, 24);
}

export async function stressChecks(open: Open, check: Check, shot?: Shot): Promise<void> {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    const page = await open(
      { mock: { live: false, stress: true }, 'layout:main': layout(width) },
      { width, height },
    );
    const front = async (kind: string): Promise<void> => {
      await page.locator(`.tab[data-view="${kind}"]`).click();
      await page.locator(`.view[data-kind="${kind}"]:visible`).first().waitFor();
      await page.waitForTimeout(300);
    };
    const look = async (scene: string): Promise<void> => {
      const bad = await page.evaluate(overflows);
      check(`long text keeps ${scene} whole at ${width}`, bad.length === 0, bad);
      await shot?.(page, `${scene}-${width}`);
    };
    await page.locator('.view[data-kind="home"] .note[data-key] .via').first().waitFor();
    await look('home');
    await front('notifications');
    await page.locator('.view[data-kind="notifications"]:visible .list > *').first().waitFor();
    await look('notifications');
    await front('account');
    await look('accounts');
    await front('channels');
    await page.locator('.view[data-kind="channels"]:visible .chan').first().waitFor();
    await look('channels');
    // The person with the longest name: their profile, named after them in its tab.
    await front('home');
    await page.locator('.view[data-kind="home"]:visible .note .nhead .name').first().click();
    await page.locator('.view[data-kind="profile"]:visible .profile').waitFor();
    await look('profile');
    // The note they wrote, quoted and answered: its thread.
    await front('home');
    await page.locator('.view[data-kind="home"]:visible .note .text').first().click();
    await page.locator('.view[data-kind="thread"]:visible .th-focus').waitFor();
    await look('thread');
    // A mention of them, chosen in the composer, is a chip under the field.
    await front('compose');
    const field = page.locator('.view[data-kind="compose"]:visible textarea');
    await field.fill('');
    await field.type('@Sam_R');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await look('compose');
    // The emoji picker names the reader's sets; its custom tab lists them.
    await page.locator('.view[data-kind="compose"]:visible .icon[title="Emoji"]').first().click();
    await page.locator('.epick').waitFor();
    await page.locator('.epick .egroup .ehd').first().waitFor();
    await look('emoji');
    await page.keyboard.press('Escape');
    // Tab search lists the open tabs by their titles, the long ones too.
    await page.locator('.bar [data-tab-search]').click();
    await page.locator('.tsearch .titem').first().waitFor();
    await look('tabsearch');
    await page.keyboard.press('Escape');
    await page.context().close();
  }
}
