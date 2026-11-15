// Browser smoke: the interactions the owner complained about, driven with a real pointer and keyboard against
// the mock build in ../dist. Prints one line per failed fact, then "ok smoke" (or exits 1).
// LKJSTR_CHROME=<path> picks the browser; --shot=<file> also writes one screenshot of the first page.
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright-core';
import { dayOf } from '../src/shared/format.ts';
import { KEYS } from '../src/shared/keys.ts';

const here = new URL('..', import.meta.url).pathname;
process.env.TMPDIR ??= resolve(here, '../tmp/temp');
process.env.XDG_CACHE_HOME ??= resolve(here, '../tmp/cache');
process.env.XDG_CONFIG_HOME ??= resolve(here, '../tmp/config');
process.env.XDG_DATA_HOME ??= resolve(here, '../tmp/data');
mkdirSync(process.env.TMPDIR, { recursive: true });
const port = 18400 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
const chrome =
  process.env.LKJSTR_CHROME ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const shot = process.argv.find((a) => a.startsWith('--shot='))?.slice(7);
const failures: string[] = [];
const fact = (name: string, ok: boolean, detail: unknown = ''): void => {
  if (!ok) failures.push(`${name}: ${JSON.stringify(detail)}`);
};

async function open(
  browser: Browser,
  path: string,
  store: Record<string, unknown>,
  size = { width: 1440, height: 900 },
  locale = 'en-US',
): Promise<Page> {
  const ctx = await browser.newContext({ viewport: size, locale, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => {
    for (const [k, v] of Object.entries(s))
      if (!localStorage.getItem(`lkjstr:${k}`))
        localStorage.setItem(`lkjstr:${k}`, JSON.stringify(v));
  }, store);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && failures.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  await page.goto(base + path);
  await page.waitForSelector('.note');
  return page;
}
const count = (page: Page, sel: string): Promise<number> => page.locator(sel).count();
const center = async (page: Page, sel: string): Promise<{ x: number; y: number }> => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

async function run(browser: Browser): Promise<void> {
  const still = { mock: { live: false } };
  const page = await open(browser, '/', still);
  if (shot) mkdirSync(dirname(shot), { recursive: true }), await page.screenshot({ path: shot });
  const home = '.pane:has(.tab.active[data-view="home"])';

  // Frame: three tiles, a close button on every tab, tabs comfortably large, circles for avatars.
  fact('panes', (await count(page, '.pane')) === 4, await count(page, '.pane'));
  fact('every tab has ×', (await count(page, '.tab')) === (await count(page, '.tab > .x:visible')));
  const tab = await page.locator('.tab').first().boundingBox();
  fact('tab height ≈ 29px', Math.abs((tab?.height ?? 0) - 28.8) < 1, tab?.height);
  fact(
    'avatars are circles',
    (await page
      .locator('.note .av')
      .first()
      .evaluate((e) => getComputedStyle(e).borderRadius)) === '50%',
  );
  fact('no heading repeats the tab', (await count(page, '.view h1, .view h2')) === 0);
  fact(
    'address is clean',
    new URL(page.url()).pathname === '/' && !page.url().includes('#') && !page.url().includes('?'),
  );
  fact('relay count hidden by default', !(await page.locator('.relays').isVisible()));
  fact(
    'time is HH:mm',
    /^\d\d:\d\d$/.test(await page.locator(`${home} .note time`).first().innerText()),
  );

  // A note opens as a tab in the same tile, right after the current one, in front.
  const before = await count(page, '.pane');
  await page.locator(`${home} .note .text`).first().click();
  const tabs = await page
    .locator('.pane')
    .first()
    .locator('.tab')
    .evaluateAll((els) =>
      els.map((e) => [e.getAttribute('data-view'), e.classList.contains('active')]),
    );
  fact(
    'note opens beside its tab, focused, same tile',
    before === (await count(page, '.pane')) &&
      tabs[0]?.[0] === 'home' &&
      String(tabs[1]?.[0]).startsWith('thread') &&
      tabs[1]?.[1] === true,
    tabs,
  );
  await page.locator('.th-focus').waitFor();
  fact('thread shows the focused note', (await count(page, '.th-focus')) === 1);
  // Middle click closes; the left neighbour comes back to the front.
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });
  fact(
    'middle click closes a tab',
    (await count(page, '.tab[data-view^="thread"]')) === 0 &&
      (await count(page, '.tab.active[data-view="home"]')) === 1,
  );

  // A reply's thread opens on the reply itself, at the top of the tile, with what it answers above it.
  const seatOf = (): Promise<{ top: number; above: number; scrolled: number } | null> =>
    page.evaluate(() => {
      const view = document.querySelector('.view[data-kind="thread"]');
      const focus = view?.querySelector('.th-focus');
      if (!view || !focus) return null;
      return {
        top: Math.round(focus.getBoundingClientRect().top - view.getBoundingClientRect().top),
        above: view.querySelectorAll('.th-ancestor').length,
        scrolled: Math.round(view.scrollTop),
      };
    });
  await page.locator(`${home} .note:has(.ctx .clip) .text`).first().click();
  await page.locator('.th-focus').waitFor();
  const seat = await seatOf();
  fact(
    'a thread opens on its focused note, the ancestors above',
    seat !== null && Math.abs(seat.top) <= 1 && seat.above > 0 && seat.scrolled > 0,
    seat,
  );
  await page.waitForTimeout(400);
  fact('and stays there', JSON.stringify(await seatOf()) === JSON.stringify(seat), await seatOf());
  // Closed tabs outlive a reload: the thread comes back, on the same note.
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector('.note');
  fact('after a reload the closed tab is still closed', (await count(page, '.th-focus')) === 0);
  await page.keyboard.press('Alt+Shift+T');
  await page.locator('.th-focus').waitFor();
  await page.waitForTimeout(300);
  fact('a tab closed before a reload opens again as it was', (await seatOf())?.top === seat?.top);
  // The tab in front is never hidden past an edge of its bar, however many tabs the tile holds.
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 3; i++) await page.locator(`.note .name`).first().click();
  const inBar = await page.evaluate(() => {
    const tab = document.querySelector('.pane.cur .tab.active')?.getBoundingClientRect();
    const bar = document.querySelector('.pane.cur .strip')?.getBoundingClientRect();
    return Boolean(tab && bar && tab.left >= bar.left && tab.right <= bar.right);
  });
  fact('the tab in front is in view in a full bar', inBar);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Alt+Shift+W');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });

  // Menus close on Escape, an outside press, a wheel, and after choosing.
  const more = `${home} .note .a-more`;
  const openMenu = async (): Promise<void> => {
    await page.locator(more).first().click();
    await page.locator('.menu').waitFor();
  };
  await openMenu();
  await page.keyboard.press('Escape');
  fact('menu closes on Escape', (await count(page, '.menu')) === 0);
  await openMenu();
  await page.mouse.click(700, 500);
  fact('menu closes on outside press', (await count(page, '.menu')) === 0);
  await openMenu();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  fact('menu closes on wheel', (await count(page, '.menu')) === 0);
  await openMenu();
  fact(
    'menu has no close button',
    (await page.locator('.menu button').allInnerTexts()).every((x) => x.length > 1),
  );
  await page.locator('.menu button').first().click();
  fact('menu closes after choosing', (await count(page, '.menu')) === 0);

  // Reacting patches the row in place: the note element stays the same node.
  await page
    .locator(`${home} .note`)
    .nth(1)
    .evaluate((e) => ((e as HTMLElement).dataset.probe = '1'));
  await page.locator(`${home} .note`).nth(1).locator('.a-heart').click();
  await page.locator(`${home} .note[data-probe] .a-heart.on`).waitFor();
  fact('a reaction keeps the drawn note', (await count(page, `${home} .note[data-probe]`)) === 1);

  // Overflowing strip: many tabs, wheel scrolls sideways, the edge says more exist.
  for (let i = 0; i < 9; i++)
    await page.locator(`${home} .note .name`).nth(i).click(),
      await page.locator('.tab[data-view="home"]').click();
  const strip = page.locator('.pane').first().locator('.strip');
  fact('strip says more to the right', await strip.evaluate((e) => e.classList.contains('more-r')));
  const s = await center(page, '.pane >> nth=0 >> .strip');
  await page.mouse.move(s.x, s.y);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(100);
  fact('wheel scrolls the strip', (await strip.evaluate((e) => e.scrollLeft)) > 100);
  fact('strip says more to the left', await strip.evaluate((e) => e.classList.contains('more-l')));

  // Dragging a tab to the right edge of another tile splits it; resizing moves the border.
  const from = await center(page, '.tab[data-view="global"]');
  const into = await page.locator('.pane:has(.tab[data-view="notifications"]) .body').boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 30, from.y + 40, { steps: 4 });
  await page.mouse.move((into?.x ?? 0) + (into?.width ?? 0) - 12, (into?.y ?? 0) + 80, {
    steps: 8,
  });
  fact('drag shows a split preview', (await count(page, '.layer .drop')) === 1);
  await page.mouse.up();
  fact(
    'drop splits the tile',
    (await count(page, '.pane')) === before + 1,
    await count(page, '.pane'),
  );
  const handle = await page.locator('.split.row > .handle').first().boundingBox();
  const width = async (): Promise<number> =>
    (await page.locator('.pane').first().boundingBox())?.width ?? 0;
  const w0 = await width();
  await page.mouse.move((handle?.x ?? 0) + 2, (handle?.y ?? 0) + 200);
  await page.mouse.down();
  await page.mouse.move((handle?.x ?? 0) - 118, (handle?.y ?? 0) + 200, { steps: 6 });
  await page.mouse.up();
  fact('resize follows the pointer', Math.abs(w0 - (await width()) - 120) < 4, [w0, await width()]);

  // The New tab page finds views in Japanese while the interface is English, and searches typed words.
  await page.locator('.pane').first().locator('.icon[title="New tab"]').click();
  await page.keyboard.type('通知');
  fact(
    'launcher matches Japanese in English mode',
    (await page.locator('.ncard b').first().innerText()) === 'Notifications',
  );
  await page.keyboard.press('Enter');
  fact(
    'Enter opens the first match',
    (await count(page, '.pane >> nth=0 >> .tab.active[data-view^="notifications"]')) === 1,
  );

  // Workspaces: the chip bar switches, the layout of each is its own, and a reload restores it.
  await page.locator('lkjstr-spaces button').nth(2).click();
  fact(
    'workspace 3 starts as a New tab page',
    (await count(page, '.tab')) === 1 && (await count(page, '.launcher')) === 1,
  );
  await page.keyboard.press('Alt+Shift+Digit1');
  fact('Alt+Shift+1 returns', (await count(page, '.pane')) === before + 1);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('.note');
  fact(
    'layout survives a reload',
    (await count(page, '.pane')) === before + 1,
    await count(page, '.pane'),
  );

  // Composer: draft, post, only the latest result. Settings take numbers.
  await page.locator('.ctext').first().fill('スモークテストです');
  await page.locator('.compose .btn.primary').first().click();
  await page.locator('.cresult:has-text("3 of 4")').waitFor({ timeout: 6000 });
  fact(
    'posting reports each relay',
    (await page.locator('.cresult').first().innerText()).includes('down.example.net'),
  );
  await page.locator('.acct').click();
  await page.locator('.menu button', { hasText: 'Settings' }).click();
  const size = page.locator('.sitem:has-text("Text size") input');
  await size.fill('19');
  await size.blur();
  fact(
    'text size is a number that applies',
    (await page.evaluate(() => document.documentElement.style.getPropertyValue('--text'))) ===
      '19px',
  );
  await page.context().close();

  // Japanese interface, live world: scrolled down, the position holds while notes arrive; at the top they flow in.
  const ja = await open(
    browser,
    '/',
    { settings: { language: 'ja' } },
    { width: 1024, height: 768 },
    'ja-JP',
  );
  fact(
    'Japanese labels',
    (await ja.locator('.tab[data-view="home"] > span').innerText()) === 'ホーム',
  );
  const view = ja.locator('.view[data-kind="home"]');
  const firstKey = await view.locator('.note').first().getAttribute('data-key');
  await ja.waitForFunction(
    (k) => document.querySelector('.view[data-kind="home"] .note')?.getAttribute('data-key') !== k,
    firstKey,
    { timeout: 15000 },
  );
  fact('at the top new notes flow in', (await view.evaluate((e) => e.scrollTop)) === 0);
  await view.hover();
  await ja.mouse.wheel(0, 900);
  await ja.waitForTimeout(300);
  const probe = (): Promise<[string, number]> =>
    view.evaluate((e) => {
      const top = e.getBoundingClientRect().top;
      const n = [...e.querySelectorAll<HTMLElement>('.note')].find(
        (x) => x.getBoundingClientRect().bottom > top + 60,
      );
      return [n?.dataset.key ?? '', Math.round(n?.getBoundingClientRect().top ?? 0)];
    });
  const held = await probe();
  await ja.locator('.view[data-kind="home"] .fresh:visible').waitFor({ timeout: 20000 });
  const after = await probe();
  fact(
    'scrolled down, the position holds',
    held[0] === after[0] && Math.abs(held[1] - after[1]) <= 1,
    [held, after],
  );
  await ja.locator('.view[data-kind="home"] .fresh').click();
  await ja.waitForFunction(() =>
    document.querySelector('.view[data-kind="home"] .fresh')?.hasAttribute('hidden'),
  );
  fact('the pill returns to the top', (await view.evaluate((e) => e.scrollTop)) === 0);
  await ja.context().close();

  // Incoming links open as a tab and the address returns to "/". A phone-width window is one tile.
  const link = await open(browser, '/p/aoi', still, { width: 390, height: 844 });
  await link.locator('.profile').waitFor();
  fact(
    'link opens a profile and cleans the address',
    new URL(link.url()).pathname === '/' &&
      (await link.locator('.pname').innerText()).includes('高橋'),
  );
  fact(
    'phone width is one tile, no sideways scroll',
    (await count(link, '.pane')) === 1 &&
      (await link.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
  );
  await link.locator('.npub').click();
  fact(
    'profile header scrolls away with the notes',
    (await link.locator('.profile').evaluate((e) => getComputedStyle(e).position)) === 'static',
  );
  await link.context().close();
  await reading(browser, still);
  await pages(browser, still);
  await place(browser, still);
  await keyboard(browser, still);
}

const FEED = '.view[data-kind="home"]';
/** The first row on screen in the home feed and how far its top is from the top of the tile. */
const anchor = (page: Page): Promise<{ key: string; off: number; top: number }> =>
  page.evaluate((sel) => {
    const view = document.querySelector(sel) as HTMLElement;
    const top = view.getBoundingClientRect().top;
    const row = [...view.querySelectorAll<HTMLElement>('.list > [data-key]:not(.day)')].find(
      (r) => r.getBoundingClientRect().bottom > top + 1,
    );
    return {
      key: row?.dataset.key ?? '',
      off: Math.round((row?.getBoundingClientRect().top ?? 0) - top),
      top: Math.round(view.scrollTop),
    };
  }, FEED);
const same = (a: { key: string; off: number }, b: { key: string; off: number }): boolean =>
  a.key === b.key && Math.abs(a.off - b.off) <= 1;

/** The reading position: the same note at the same height after a reload, another tab, another tile, another width,
 * a closed and reopened tab. */
async function place(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', still);
  const c = await center(page, FEED);
  await page.mouse.move(c.x, c.y);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 613), await page.waitForTimeout(40);
  await page.waitForTimeout(500);
  const was = await anchor(page);
  fact('scrolled well into the feed', was.top > 5000 && was.key !== '', was);

  // The very first frame that has notes already shows them where they were: nothing is seen at the top first.
  await page.addInitScript((sel) => {
    const seen: number[] = [];
    (window as unknown as { firstTops: number[] }).firstTops = seen;
    const tick = (): void => {
      const view = document.querySelector<HTMLElement>(sel);
      if (view?.querySelector('.note')) seen.push(view.scrollTop);
      if (seen.length < 3) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, FEED);
  await page.reload();
  await page.waitForSelector(`${FEED} .note`);
  await page.waitForTimeout(600);
  fact('reload: the same note at the same height', same(was, await anchor(page)), [
    was,
    await anchor(page),
  ]);
  const tops = await page.evaluate(() => (window as unknown as { firstTops: number[] }).firstTops);
  fact(
    'reload: no frame at the top before the place is back',
    tops.length > 0 && tops.every((x) => x > 1000),
    tops,
  );
  fact(
    'reload: the address stays clean',
    new URL(page.url()).pathname === '/' && !page.url().includes('?'),
  );

  // Another tab of the tile in front, and back.
  const home = '.pane:has(.tab[data-view="home"])';
  await page.keyboard.press('Alt+Shift+N');
  await page.waitForSelector(`${home} .view.launcher`);
  await page.keyboard.press('Escape');
  await page.waitForSelector(`${FEED} .note`);
  fact('another tab and back: the same place', same(was, await anchor(page)), await anchor(page));

  // Another width (text wraps again, every row above changes height), then another tile.
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.waitForTimeout(300);
  fact('another width: the same place', same(was, await anchor(page)), await anchor(page));
  await page.keyboard.press('Alt+Shift+Enter');
  await page.waitForTimeout(300);
  fact('another tile: the same place', same(was, await anchor(page)), await anchor(page));
  fact('another tile: the tab really moved', (await count(page, `${home} .tab`)) > 1);

  // Closed and opened again: it comes back where it was, at the note that was being read.
  const tabs = await count(page, '.tab');
  await page.keyboard.press('Alt+Shift+W');
  fact(
    'Alt+Shift+W closes the tab',
    (await count(page, '.tab')) === tabs - 1 && (await count(page, FEED)) === 0,
  );
  await page.keyboard.press('Alt+Shift+T');
  await page.waitForSelector(`${FEED} .note`);
  await page.waitForTimeout(300);
  fact('a reopened tab is where it was left', same(was, await anchor(page)), await anchor(page));

  // A picture that arrives late above the place does not move it.
  const before = await anchor(page);
  await page.evaluate((sel) => {
    const first = document.querySelector<HTMLElement>(`${sel} .list > .note`);
    first
      ?.querySelector('.nmain')
      ?.append(Object.assign(document.createElement('div'), { style: 'height:333px' }));
  }, FEED);
  await page.waitForTimeout(200);
  fact(
    'rows that grow above do not push what is read',
    same(before, await anchor(page)),
    await anchor(page),
  );
  await page.context().close();
}

/** The keys of a list: a selection that is drawn calmly, acts once per press, and never while typing. */
async function keyboard(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', still);
  const sel = `${FEED} .list > .sel`;
  const key = (): Promise<string> =>
    page.evaluate((s) => document.querySelector<HTMLElement>(s)?.dataset.key ?? '', sel);
  await page.locator(`${FEED} .note time`).first().hover();
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape');
  fact('nothing is selected until a key asks', (await count(page, sel)) === 0);
  const hearts = await count(page, `${FEED} .a-heart.on`);
  await page.keyboard.press('l');
  const first = await key();
  fact(
    'a note key with nothing selected only shows the selection',
    first !== '' &&
      (await count(page, `${FEED} .a-heart.on`)) === hearts &&
      (await count(page, '.toast')) === 0,
  );
  await page.keyboard.press('j');
  const second = await key();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('k');
  fact(
    'j, k and the arrows walk the notes',
    second !== first && (await key()) === second && (await count(page, sel)) === 1,
  );
  // Composing Japanese text is not a key press.
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', isComposing: true, bubbles: true }),
    ),
  );
  fact('a key of the input method moves nothing', (await key()) === second);

  // A held key acts once.
  const liked = (): Promise<number> => count(page, `${sel} .a-heart.on`);
  const start = await liked();
  await page.keyboard.down('l');
  await page.keyboard.down('l');
  await page.keyboard.down('l');
  await page.keyboard.up('l');
  await page.locator('.toast.undo').waitFor();
  fact('l likes once however long it is held', (await liked()) === 1 - start, await liked());
  await page.locator('.toast.undo button').click();
  await page.waitForFunction((s) => !document.querySelector(`${s} .a-heart.on`) === true, sel);
  fact('a like can be taken back', (await liked()) === 0 && (await key()) === second);

  await page.keyboard.press('t');
  fact(
    't opens repost and quote with the keyboard in the menu',
    await page.evaluate(() => document.activeElement?.matches('.menu button') === true),
  );
  await page.keyboard.press('j');
  fact('single keys rest while a menu is open', (await key()) === second);
  await page.keyboard.press('Enter');
  await page.locator('.toast.undo').waitFor();
  fact('repost from the keyboard', (await count(page, `${sel} .a-repost.on`)) === 1);
  await page.locator('.toast.undo button').last().click();
  await page.waitForFunction((s) => !document.querySelector(`${s} .a-repost.on`), sel);
  await page.keyboard.press('j');
  await page.keyboard.press('k');
  fact('after a menu, j and k go on from the same note', (await key()) === second);

  // Enter: the thread in the neighbouring tile; Escape drops the selection there, then closes it and comes back.
  const tabs = await count(page, '.tab');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pane.cur .view[data-kind="thread"] .note');
  fact(
    'Enter opens the thread in the neighbouring tile',
    (await count(page, '.tab')) === tabs + 1 &&
      (await count(page, `.pane.cur ${FEED}`)) === 0 &&
      (await key()) === second,
  );
  await page.keyboard.press('j');
  fact('the keys follow into the thread', (await count(page, '.pane.cur .list > .sel')) === 1);
  await page.keyboard.press('Escape');
  fact(
    'Escape first drops the selection',
    (await count(page, '.pane.cur .list > .sel')) === 0 && (await count(page, '.tab')) === tabs + 1,
  );
  await page.keyboard.press('Escape');
  fact(
    'Escape then closes the thread and the keys are back in the feed',
    (await count(page, '.tab')) === tabs && (await count(page, `.pane.cur ${FEED}`)) === 1,
  );
  await page.keyboard.press('j');
  fact('back in the feed the selection moves on', ![first, second, ''].includes(await key()));

  // Going places, a new note, the list of keys; nothing fires while typing.
  await page.keyboard.press('g');
  await page.keyboard.press('b');
  fact(
    'g b shows Bookmarks in the same tile',
    (await count(page, '.pane.cur .tab.active[data-view^="bookmarks"]')) === 1,
  );
  fact(
    'g b did not bookmark the selected note',
    (await count(page, '.toast')) + (await count(page, `${FEED} .sel .bmark:not([hidden])`)) === 0,
  );
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  fact(
    'g h returns to the Home that is there',
    (await count(page, '.pane.cur .tab.active[data-view="home"]')) === 1 &&
      (await count(page, '.tab[data-view^="home"]')) === 1,
  );
  await page.keyboard.press('n');
  await page.waitForSelector('.pane.cur .view[data-kind="compose"] textarea');
  const area = '.pane.cur .view[data-kind="compose"] textarea';
  fact(
    'n opens a new note with the caret in it and no stray letter',
    await page
      .locator(area)
      .evaluate((a) => a === document.activeElement && (a as HTMLTextAreaElement).value === ''),
  );
  const before = await count(page, '.tab');
  await page.keyboard.type('jng?');
  fact(
    'typing is only typing',
    (await page.locator(area).inputValue()) === 'jng?' && (await count(page, '.tab')) === before,
  );
  await page.keyboard.press('Escape');
  fact(
    'Escape leaves the field',
    await page.evaluate(() => document.activeElement?.matches('.view') === true),
  );
  await page.keyboard.press('Shift+?');
  await page.waitForSelector('.pane.cur .view[data-kind="shortcuts"] kbd');
  const caps = await page.locator('.view[data-kind="shortcuts"] kbd').allInnerTexts();
  fact(
    '? lists the keys, pairs and mouse gestures',
    ['G H', 'J', 'Alt+Shift+T', 'Middle click', 'Shift+Click'].every((x) => caps.includes(x)),
    caps.slice(0, 12),
  );
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  fact(
    'Alt+Shift+← is the tab to the left',
    (await count(page, '.pane.cur .tab.active[data-view^="compose"]')) === 1,
  );
  await page.keyboard.press('Alt+Shift+W');
  await page.keyboard.press('Alt+Shift+T');
  fact('the draft is still there', (await page.locator(area).inputValue()) === 'jng?');
  if (shot) {
    await page.keyboard.press('g');
    await page.keyboard.press('h');
    await page.keyboard.press('j');
    await page.screenshot({ path: shot.replace(/\.png$/, '-keys.png') });
  }
  await page.context().close();
}

/** The filter bar that stays away, the media tab, the emoji picker, the notification toggles. */
async function reading(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', still);
  const home = '.pane:has(.tab.active[data-view="home"])';
  const feed = '.view[data-kind="home"]';
  fact('no filter bar until asked', (await count(page, `${feed} .rbar`)) === 0);
  await page.locator(`${home} .strip > .icon`).first().click();
  const item = page.locator('.menu button').first();
  fact('the tile menu offers the filter', (await item.innerText()).includes('Filter'));
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  fact(
    '"/" shows the filter with the keyboard in it',
    await page.evaluate(() => document.activeElement?.matches('.rbar input') === true),
  );
  await page.keyboard.type('zzzz');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  fact('a narrowing filter stays in view', (await count(page, `${feed} .rbar`)) === 1);
  await page.locator(`${feed} .rbar input`).fill('');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  fact('Escape puts an empty filter away', (await count(page, `${feed} .rbar`)) === 0);
  await page.locator(`${feed} .note`).first().waitFor();
  const times = await page
    .locator(`${feed} .note time`)
    .evaluateAll(
      (els, today) =>
        els
          .filter((e) => !e.getAttribute('title')?.startsWith(today))
          .map((e) => e.textContent ?? ''),
      dayOf(Date.now()),
    );
  fact(
    'older notes carry their date',
    times.every((x) => /^\d{4}\/\d\d\/\d\d \d\d:\d\d$/.test(x)),
    times.slice(0, 3),
  );

  // A picture opens as a tab in the neighbouring tile; Escape closes it and the keyboard is back on the picture.
  const panes = await count(page, '.pane');
  const box = page.locator(`${feed} .mbox`).first();
  await box.scrollIntoViewIfNeeded();
  const top = await page.locator(feed).evaluate((e) => e.scrollTop);
  await box.click();
  await page.locator('.mstage img').waitFor();
  fact(
    'media opens beside, as a tab, with the keyboard',
    (await count(page, '.pane')) === panes &&
      (await count(page, '.layer > *')) === 0 &&
      (await count(page, `${home} .tab[data-view^="media"]`)) === 0 &&
      (await count(page, '.tab.active[data-view^="media"]')) === 1 &&
      (await page.evaluate(() => document.activeElement?.matches('.mview') === true)),
  );
  const scale = (): Promise<string> => page.locator('.mscale').innerText();
  const fitted = await scale();
  const stage = await center(page, '.mstage');
  await page.mouse.move(stage.x, stage.y);
  await page.mouse.wheel(0, -400);
  fact('the wheel zooms', (await scale()) !== fitted, [fitted, await scale()]);
  await page.keyboard.press('Escape');
  fact(
    'Escape closes the media tab and returns to the picture',
    (await count(page, '.tab[data-view^="media"]')) === 0 &&
      (await page.evaluate(() => document.activeElement?.matches('.mbox') === true)) &&
      (await page.locator(feed).evaluate((e) => e.scrollTop)) === top,
  );

  // The picker: search in either language, the choice becomes the reader's reaction, the row keeps its place.
  await page.locator(feed).evaluate((e) => (e.scrollTop = 0));
  const note = page.locator(`${feed} .note`).nth(2);
  const smile = note.locator('.a-smile');
  const y = (await smile.boundingBox())?.y;
  await smile.click();
  await page.locator('.epick').waitFor();
  await page.locator('.ecell img').first().waitFor(); // the account's custom emoji arrive from the engine
  await page.keyboard.type('ねこ');
  await page.keyboard.press('Enter');
  await note.locator('.rchip.on').waitFor();
  fact(
    'a picked emoji is the reaction; the action row did not move',
    (await count(page, '.epick')) === 0 &&
      (await note.locator('.rchip.on').innerText()).includes('🐱') &&
      (await note.locator('.a-smile').boundingBox())?.y === y,
  );
  await note.locator('.a-smile').click();
  fact('the latest emoji comes first', (await page.locator('.ecell').first().innerText()) === '🐱');
  await page.keyboard.press('Escape');

  const notes = '.view[data-kind="notifications"]';
  fact('five notification toggles', (await count(page, `${notes} .ntype`)) === 5);
  await page.locator(`${notes} .ntype`).nth(3).click();
  await page.waitForTimeout(300);
  fact(
    'a toggle narrows notifications to its kind',
    (await count(page, `${notes} .notif`)) > 0 &&
      (await count(page, `${notes} .notif`)) ===
        (await count(page, `${notes} .notif:has(.k-zap)`)) &&
      (await count(page, `${notes} .note`)) === 0,
  );
  await page.reload();
  await page.locator(`${notes} .ntype.on`).waitFor();
  fact('the toggle is remembered', (await count(page, `${notes} .ntype.on`)) === 1);
  await page.context().close();

  // A phone: one tile, so the media tab opens in it; a finger gets 40px.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(() => localStorage.setItem('lkjstr:mock', '{"live":false}'));
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  await phone.goto(base);
  await phone.locator('.mbox').first().scrollIntoViewIfNeeded();
  const small = await phone
    .locator('.note .act, .strip > .icon')
    .evaluateAll(
      (els) =>
        els
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 40 || r.height < 32)).length,
    );
  fact('touch targets are finger sized', small === 0, small);
  await phone.locator('.mbox').first().tap();
  await phone.locator('.mstage img').waitFor();
  const bar = await phone.locator('.mbar a.icon').boundingBox();
  fact(
    'phone: media is a tab in the one tile',
    (await count(phone, '.pane')) === 1 &&
      (bar?.height ?? 0) >= 40 &&
      (await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
  );
  if (shot) await phone.screenshot({ path: shot.replace(/\.png$/, '-media-390.png') });
  await phone.locator('.tab.active .x').tap();
  fact(
    'phone: closing returns to the feed',
    (await count(phone, '.tab.active[data-view="home"]')) === 1,
  );
  await ctx.close();
}

/** The video and the sound, the Relays, Shortcuts and About tabs, the lists of Settings, the phone's action row. */
async function pages(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', still);
  const feed = '.view[data-kind="home"]';
  const video = (): Promise<{ paused: boolean; at: number; muted: boolean } | null> =>
    page.evaluate(() => {
      const v = document.querySelector<HTMLVideoElement>('.mstage video');
      return v ? { paused: v.paused, at: v.currentTime, muted: v.muted } : null;
    });
  fact(
    'a sound plays in the feed with its own controls',
    (await count(page, `${feed} .mbox.audio audio[controls]`)) > 0,
  );
  const clip = page.locator(`${feed} .mbox:has(video)`).first();
  await clip.scrollIntoViewIfNeeded();
  await clip.click();
  await page.locator('.mstage video').waitFor();
  await page.waitForFunction(() => {
    const v = document.querySelector<HTMLVideoElement>('.mstage video');
    return v !== null && !v.paused && v.currentTime > 0.2;
  });
  fact(
    'the pressed video plays, with controls',
    (await count(page, '.mstage video[controls]')) === 1,
  );
  await page.keyboard.press('Space');
  const stopped = await video();
  fact('Space pauses, once', stopped?.paused === true, stopped);
  await page.locator('.mstage video').click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(150);
  const afterClick = (await video())?.paused;
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  fact(
    'Space still toggles once after a press on the player',
    (await video())?.paused === !afterClick,
  );
  if (!(await video())?.paused) await page.keyboard.press('Space');
  await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('.mstage video');
    if (v) v.currentTime = 1;
  });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('m');
  await page.waitForTimeout(500);
  const moved = await video();
  fact(
    'arrows seek and M mutes',
    Math.abs((moved?.at ?? 0) - 5.9) < 1.2 && moved?.muted === true,
    moved,
  );
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  const kept = (await video())?.at ?? 0;
  await page.setViewportSize({ width: 1300, height: 860 });
  await page.waitForTimeout(300);
  const redrawn = await video();
  fact(
    'a redraw keeps the position and starts nothing',
    redrawn?.paused === true && Math.abs(redrawn.at - kept) < 0.1,
    redrawn,
  );
  await page.reload();
  await page.locator('.mstage video').waitFor();
  await page.waitForFunction(
    () => (document.querySelector<HTMLVideoElement>('.mstage video')?.readyState ?? 0) >= 1,
  );
  await page.waitForTimeout(300);
  const restored = await video();
  fact(
    'a reload continues from there, silent until asked, the volume choice kept',
    restored?.paused === true && Math.abs(restored.at - kept) < 0.6 && restored.muted,
    { restored, kept },
  );
  await page.keyboard.press('PageUp');
  fact('PageUp goes to the picture before the video', (await count(page, '.mstage img')) === 1);
  await page.keyboard.press('Escape');

  // Relays: honest states, switches that keep the keyboard, a removal that can be taken back.
  const menu = async (label: string): Promise<void> => {
    await page.locator('.acct').click();
    await page.locator('.menu button', { hasText: label }).click();
  };
  await menu('Relays');
  const rv = '.view[data-kind="relays"]';
  await page.locator(`${rv} .rrow`).first().waitFor();
  const mine = (): Promise<number> => count(page, `${rv} .rrow:has(.rtog)`);
  fact(
    'relays: the list, the others in use, the rest folded',
    (await mine()) === 4 && (await count(page, `${rv} .rfold:not([open])`)) === 1,
    await mine(),
  );
  const texts = await page.locator(`${rv} .rrow:has(.rtog) .rsub`).allInnerTexts();
  fact(
    'relays: each says its state, an error in its own words',
    texts.some((x) => /^Connected · 42 ms/.test(x)) &&
      texts.some((x) => x.includes('connection refused')),
    texts,
  );
  const slow = page.locator(`${rv} .rrow`, { hasText: 'slow.example.org' });
  await slow.locator('[data-f="write"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.rrow[data-key="wss://slow.example.org"] [data-f="write"]')
        ?.getAttribute('aria-pressed') === 'true',
  );
  fact(
    'relays: a switch keeps the keyboard',
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement | null)?.dataset.f === 'write' &&
        document.activeElement?.closest('.rrow')?.getAttribute('data-key') ===
          'wss://slow.example.org',
    ),
  );
  await page
    .locator(`${rv} .rrow`, { hasText: 'nos.example.net' })
    .locator('[data-f="remove"]')
    .click();
  await page.locator('.toast.undo').waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="relays"] .rrow:has(.rtog)').length === 3,
  );
  fact(
    'relays: after a removal the keyboard is on the next row',
    await page.evaluate(() => document.activeElement?.closest('.rrow') !== null),
  );
  fact(
    'relays: the removed relay waits in the folded list',
    (await page.locator(`${rv} .rfold summary`).innerText()).includes('4'),
  );
  await page.locator('.toast.undo button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="relays"] .rrow:has(.rtog)').length === 4,
  );
  fact(
    'relays: undo puts it back where it was',
    (await page.locator(`${rv} .rrow .rhost`).nth(1).innerText()) === 'nos.example.net',
  );
  await page.locator(`${rv} .addrow input`).fill('not a relay');
  await page.keyboard.press('Enter');
  fact(
    'relays: a wrong address is refused and kept for fixing',
    (await count(page, `${rv} .addrow input[aria-invalid]`)) === 1,
  );
  await page.locator(`${rv} .addrow input`).fill('relay.new.example');
  await page.keyboard.press('Enter');
  const added = page.locator(`${rv} .rrow`, { hasText: 'relay.new.example' });
  await added.locator('.rsub', { hasText: 'Connecting' }).waitFor();
  await added.locator('.rsub', { hasText: 'Connected' }).waitFor();
  fact(
    'relays: an added relay connects in view, the field ready for the next',
    await page.evaluate(
      () =>
        document.activeElement?.matches('.addrow input') === true &&
        (document.activeElement as HTMLInputElement).value === '',
    ),
  );

  await menu('Shortcuts');
  const sv = '.view[data-kind="shortcuts"]';
  const caps = await page.locator(`${sv} kbd`).allInnerTexts();
  fact(
    'shortcuts: the key table, as this device names the keys',
    (await count(page, `${sv} dt`)) === Object.keys(KEYS).length &&
      caps.includes('/') &&
      caps.includes('Alt+Shift+1 … 9') &&
      caps.includes('Ctrl+Enter') &&
      caps.includes('Space'),
    caps,
  );
  await menu('About');
  const about = await page.locator('.view[data-kind="about"]').innerText();
  fact(
    'about: version, engine, source, licence',
    /lkjstr \d+\.\d+\.\d+/.test(about) &&
      about.includes('mock, protocol 1') &&
      (await count(page, '.view[data-kind="about"] a[href="https://github.com/lkjsxc/lkjstr"]')) ===
        1 &&
      about.includes('Apache License 2.0'),
    about,
  );
  fact(
    'no heading repeats a tab title',
    (await count(page, `${sv} h1, ${rv} h1, .view[data-kind="about"] h1`)) === 0,
  );

  // Settings: the lists, each removal undoable.
  await menu('Settings');
  const set = '.view[data-kind="settings"]';
  await page.locator(`${set} .srow`).first().waitFor();
  const srows = (): Promise<number> => count(page, `${set} .srow`);
  fact(
    'settings: muted people, words, hashtags and the media servers',
    (await srows()) === 5,
    await srows(),
  );
  await page.locator(`${set} .ssearch input`).fill('ミュート');
  fact(
    'settings: the lists are found in either language',
    (await count(page, `${set} .sitem:visible`)) === 4,
  );
  await page.locator(`${set} .srow`, { hasText: 'airdrop' }).locator('.x').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow').length === 4,
  );
  fact(
    'settings: an emptied list says so',
    (await page.locator(`${set} .snone`).nth(1).innerText()) === 'No muted words.',
  );
  await page.locator('.toast.undo button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow').length === 5,
  );
  await page.locator(`${set} .ssearch input`).fill('servers');
  await page.locator(`${set} .srow`, { hasText: 'media.example.jp' }).locator('.x').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow').length === 4,
  );
  await page.locator('.toast.undo button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow').length === 5,
  );
  fact(
    'settings: a media server comes back first, as it was',
    (await page.locator(`${set} .sitem:visible .srow .clip`).first().innerText()) ===
      'media.example.jp',
  );
  await page.context().close();

  // A phone: the action row has room, by the tile's width; the bookmark is in the "…" menu.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(() => localStorage.setItem('lkjstr:mock', '{"live":false}'));
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
  await phone.goto(base);
  await phone.locator('.note .acts').first().waitFor();
  const rows = await phone.locator('.note .acts').evaluateAll((els) =>
    els.map((row) => {
      const kids = [...row.children].filter(
        (k) => getComputedStyle(k).display !== 'none',
      ) as HTMLElement[];
      const boxes = kids.map((k) => k.getBoundingClientRect());
      const text = kids.map((k) => k.querySelector('span')?.getBoundingClientRect());
      return {
        n: kids.length,
        small: boxes.some((b) => b.width < 40 || b.height < 40),
        // how far a count stays from the next button's icon (a button never overlaps the next)
        gap: Math.min(
          ...boxes.slice(0, -1).map((b, i) => {
            const icon = kids[i + 1]?.querySelector('svg')?.getBoundingClientRect();
            return (icon?.left ?? 0) - Math.max(b.right - 5, text[i]?.right ?? 0);
          }),
        ),
        // the last button is whole, short of the tile's edge
        inside: (boxes[boxes.length - 1]?.right ?? 0) <= innerWidth - 8,
        zap: kids.find((k) => k.classList.contains('a-zap'))?.innerText ?? '',
      };
    }),
  );
  const tight = rows.filter((r) => r.small || r.gap < 8 || !r.inside);
  fact(
    'phone: every action is 40px and none touches the next',
    tight.length === 0 && rows.some((r) => r.zap.length >= 4),
    tight.slice(0, 3),
  );
  fact(
    'phone: the row is always the same six buttons',
    rows.every((r) => r.n === 6),
  );
  await phone.locator('.note:not(:has(.a-bookmark.on)) .act.a-more').first().tap();
  fact(
    'phone: the bookmark is in the "…" menu',
    (await phone.locator('.menu button').first().innerText()) === 'Bookmark',
  );
  const marked = await count(phone, '.note .bmark:visible');
  await phone.locator('.menu button').first().tap();
  await phone.waitForFunction(
    (n) => document.querySelectorAll('.note .bmark:not([hidden])').length > n,
    marked,
  );
  const bm = await phone
    .locator('.note:has(.bmark:not([hidden]))')
    .first()
    .evaluate((note) => {
      const kids = [...(note.querySelector('.acts')?.children ?? [])].filter(
        (k) => getComputedStyle(k).display !== 'none',
      );
      const mark = note.querySelector('.bmark')?.getBoundingClientRect();
      const view = note.closest('.view') as HTMLElement;
      return {
        n: kids.length,
        mark: mark?.width ?? 0,
        right: Math.max(...kids.map((k) => k.getBoundingClientRect().right)),
        wide: view.scrollWidth - view.clientWidth,
      };
    });
  fact(
    'phone: a set bookmark is a mark in the header, the row stays six and nothing overflows',
    bm.n === 6 && bm.mark > 8 && bm.right <= 390 && bm.wide <= 0,
    bm,
  );
  if (shot) await phone.screenshot({ path: shot.replace(/\.png$/, '-acts-390.png') });
  await ctx.close();
}

if (!existsSync(`${here}../dist/index.html`)) throw new Error('build first: pnpm build');
const server: ChildProcess = spawn(
  process.execPath,
  [`${here}scripts/serve.ts`, `--port=${port}`],
  { stdio: 'pipe' },
);
await new Promise((r) => server.stdout?.once('data', r));
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  await run(browser);
} catch (e) {
  const at = /smoke\.ts:(\d+)/.exec((e as Error).stack ?? '')?.[1] ?? '?';
  failures.push(`threw at line ${at}: ${(e as Error).message.split('\n')[0]}`);
} finally {
  await browser?.close();
  server.kill();
}
if (failures.length) console.log(failures.join('\n')), process.exit(1);
console.log('ok smoke');
