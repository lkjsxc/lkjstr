// Browser smoke: the interactions the owner complained about, driven with a real pointer and keyboard against
// the mock build in ../dist. Prints one line per failed fact, then "ok smoke" (or exits 1).
// LKJSTR_CHROME=<path> picks the browser; --shot=<file> also writes one screenshot of the first page.
import { type ChildProcess, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright-core';
import { PROTOCOL_VERSION } from '../src/engine/protocol.ts';
import { dayOf } from '../src/shared/format.ts';
import { KEYS } from '../src/shared/keys.ts';
import { browserTmp } from './browser-tmp.ts';
import { hiddenChecks } from './smoke-hidden.ts';
import { mentionChecks } from './smoke-mentions.ts';
import { momentChecks } from './smoke-moment.ts';
import { notesChecks } from './smoke-notes.ts';
import { pendingChecks } from './smoke-pending.ts';
import { replyChecks } from './smoke-reply.ts';
import { resetChecks } from './smoke-reset.ts';
import { stressChecks } from './smoke-stress.ts';
import { threadChecks } from './smoke-thread.ts';
import { timeLabelChecks } from './smoke-time-label.ts';
import { railSmoke } from './smoke-time-rail.ts';
import { viaChecks } from './smoke-via.ts';
import { wishes } from './smoke-wishes.mjs';
import { zoomChecks } from './smoke-zoom.ts';
import { seated, seatOf } from './thread-seat.ts';

const here = new URL('..', import.meta.url).pathname;
process.env.TMPDIR = browserTmp(process.env.TMPDIR ?? resolve(here, '../tmp/temp'));
process.env.XDG_CACHE_HOME ??= resolve(here, '../tmp/cache');
process.env.XDG_CONFIG_HOME ??= resolve(here, '../tmp/config');
process.env.XDG_DATA_HOME ??= resolve(here, '../tmp/data');
mkdirSync(process.env.TMPDIR, { recursive: true });
let base = '';
const chrome =
  process.env.LKJSTR_CHROME ??
  `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`;
const shot = process.argv.find((a) => a.startsWith('--shot='))?.slice(7);
const failures: string[] = [];
let facts = 0;
writeFileSync(resolve(here, '../tmp/audit-mock-progress.log'), '');
const fact = (name: string, ok: boolean, detail: unknown = ''): void => {
  facts++;
  appendFileSync(
    resolve(here, '../tmp/audit-mock-progress.log'),
    `${ok ? 'ok' : 'FAIL'} ${name}\n`,
  );
  if (!ok) failures.push(`${name}: ${JSON.stringify(detail)}`);
};

async function isolatedContext(
  browser: Browser,
  options: Parameters<Browser['newContext']>[0] = {},
) {
  const context = await browser.newContext(options);
  context.setDefaultTimeout(20000);
  await context.route('**/*', (route) =>
    route.request().url().startsWith(base)
      ? route.continue()
      : route.fulfill({ status: 204, body: '' }),
  );
  await context.routeWebSocket('**/*', (socket) => socket.close());
  return context;
}

/** A reader's own arrangement, saved on the device: most facts below are about tabs and tiles, not about the
 * default layout, and were written against this one. `fresh` in the store leaves the device empty instead. */
const tile = (id: string, tabs: string[]): unknown => ({ type: 'pane', id, tabs, active: tabs[0] });
const row = (id: string, dir: string, sizes: number[], children: unknown[]): unknown => ({
  type: 'split',
  id,
  dir,
  sizes,
  children,
});
const arranged = (width: number): unknown =>
  width < 760
    ? tile('a', ['home', 'notifications', 'global', 'compose'])
    : width < 1200
      ? row(
          'r',
          'row',
          [0.56, 0.44],
          [tile('a', ['home', 'global']), tile('b', ['notifications', 'compose'])],
        )
      : row(
          'r',
          'row',
          [0.38, 0.28, 0.34],
          [
            tile('a', ['home']),
            row('c', 'col', [0.64, 0.36], [tile('b', ['notifications']), tile('d', ['compose'])]),
            tile('e', ['global', 'bookmarks']),
          ],
        );

async function open(
  browser: Browser,
  path: string,
  given: Record<string, unknown>,
  size = { width: 1440, height: 900 },
  locale = 'en-US',
  touch = false,
): Promise<Page> {
  const { fresh, ...rest } = given;
  const store = fresh
    ? rest
    : {
        migration: 'owner-audit-1',
        'layout:main': arranged(size.width),
        'layout:guest': tile('g', ['global']),
        ...rest,
      };
  const ctx = await isolatedContext(browser, {
    viewport: size,
    locale,
    deviceScaleFactor: 1,
    hasTouch: touch,
  });
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
  await railSmoke(page, fact, process.env.LKJSTR_SHOTS === '1');
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
    'note opens right after its tab, focused, same tile',
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

  // A reply's thread opens on the reply itself, about a third down the tile, with what it answers above it in view.
  const seatNow = () => seatOf(page);
  await page.locator(`${home} .note:has(.ctx .clip) .text`).first().click();
  await page.locator('.th-focus').waitFor();
  await page.waitForTimeout(300);
  const seat = await seatNow();
  fact(
    'a thread opens on its focused note, the ancestors above in view',
    seated(seat) && (seat?.above ?? 0) > 0 && (seat?.top ?? 0) > 0,
    seat,
  );
  await page.waitForTimeout(400);
  fact(
    'and stays there',
    JSON.stringify(await seatNow()) === JSON.stringify(seat),
    await seatNow(),
  );
  // Closed tabs outlive a reload: the thread comes back, on the same note.
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector('.note');
  fact('after a reload the closed tab is still closed', (await count(page, '.th-focus')) === 0);
  await page.keyboard.press('Alt+Shift+T');
  await page.locator('.th-focus').waitFor();
  await page.waitForTimeout(300);
  fact('a tab closed before a reload opens again as it was', (await seatNow())?.top === seat?.top);
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
  const cards = await page.locator('.ncard b').allInnerTexts();
  fact(
    'New tab offers Documentation once, and none of its pages until one is named',
    cards.filter((c) => c === 'Documentation').length === 1 &&
      !cards.some((c) => /^(Shortcuts|Terms|Privacy policy|What lkjstr is)$/.test(c)),
    cards,
  );
  await page.keyboard.type('shortcuts');
  fact(
    'a typed page name comes first',
    (await page.locator('.ncard b').first().innerText()) === 'Shortcuts',
  );
  await page.locator('.view.launcher:visible > input').fill('');
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
  await page.locator('.brand').click();
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
  // Nothing is pressed: the head changes by itself and the new-notes control is never offered at the top.
  await ja.waitForFunction(
    (k) => document.querySelector('.view[data-kind="home"] .note')?.getAttribute('data-key') !== k,
    firstKey,
    { timeout: 20000 },
  );
  fact(
    'at the top new notes flow in without a press',
    (await view.evaluate((e) => e.scrollTop)) === 0 &&
      (await view.locator('.fresh').evaluate((e) => e.hasAttribute('hidden'))),
  );
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
  const heldHead = await view.locator('.note').first().getAttribute('data-key');
  await ja.locator('.view[data-kind="home"] .fresh:visible').waitFor({ timeout: 20000 });
  const after = await probe();
  fact(
    'scrolled down, the position holds',
    held[0] === after[0] && Math.abs(held[1] - after[1]) <= 1,
    [held, after],
  );
  // Back at the top by scrolling alone: what was counted is shown and the count goes.
  await view.evaluate((e) => e.scrollTo(0, 0));
  await ja.waitForFunction((k) => {
    const el = document.querySelector<HTMLElement>('.view[data-kind="home"]');
    return (
      el?.scrollTop === 0 &&
      el.querySelector('.fresh')?.hasAttribute('hidden') &&
      el.querySelector('.note')?.getAttribute('data-key') !== k
    );
  }, heldHead);
  fact('scrolling back to the top shows what arrived', true);
  const keysNow = await view
    .locator('.list > .note')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.key));
  fact('arrivals are drawn once', new Set(keysNow).size === keysNow.length, keysNow.length);
  await ja.mouse.wheel(0, 900);
  await ja.locator('.view[data-kind="home"] .fresh:visible').waitFor({ timeout: 20000 });
  await ja.locator('.view[data-kind="home"] .fresh').click();
  await ja.waitForFunction(() => {
    const el = document.querySelector<HTMLElement>('.view[data-kind="home"]');
    return el?.scrollTop === 0 && el.querySelector('.fresh')?.hasAttribute('hidden');
  });
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
  await accounts(browser);
  await place(browser, still);
  await keyboard(browser, still);
  await defaults(browser, still);
  await resetChecks((given) => open(browser, '/', { ...still, ...given }), fact);
  await zoomChecks((given, size) => open(browser, '/', { ...still, ...given }, size), fact);
  await pendingChecks((given) => open(browser, '/', given), fact);
  await threadChecks((path, given, size) => open(browser, path, given, size), fact);
  await momentChecks((path, given, size) => open(browser, path, given, size), fact);
  await stressChecks((given, size) => open(browser, '/', given, size), fact);
  await replyChecks((path, given, size) => open(browser, path, given, size), fact);
  await mentionChecks(
    (path, given, size, touch) => open(browser, path, given, size, 'en-US', touch),
    fact,
  );
  await timeLabelChecks((path, given, size) => open(browser, path, given, size), fact);
  await viaChecks((path, given, size) => open(browser, path, given, size), fact);
  await scrolling(still);
  await filtering(browser, still);
  await rooms(browser, still);
  const reader = await open(browser, '/', {
    mock: { live: true },
    'layout:main': tile('reader', ['global']),
  });
  await notesChecks(reader, fact);
  await reader.context().close();
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
/** A list keeps what was read above; the scrollbar is easy to catch and says the time while it is held; a zoomed
 * picture is moved by hand. */
async function scrolling(still: Record<string, unknown>): Promise<void> {
  // Headless Chromium hides scrollbars by default: this browser draws them, as a reader's does.
  const bars = await chromium.launch({
    executablePath: chrome,
    args: ['--no-sandbox'],
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
  const page = await open(bars, '/', still);
  const feed = '.view[data-kind="global"]';
  await page.locator('.tab[data-view="global"]').click();
  await page.locator(`${feed} .note`).first().waitFor();
  const firstKey = (): Promise<string | undefined> =>
    page
      .locator(`${feed} .list > .note`)
      .first()
      .evaluate((n) => (n as HTMLElement).dataset.key);
  const head = await firstKey();
  let most = 0;
  for (let i = 0; i < 14; i++) {
    await page.locator(feed).evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(160);
    most = Math.max(most, await count(page, `${feed} .list > .note`));
  }
  const kept = await count(page, `${feed} .list > .note`);
  fact(
    'scrolling far down keeps every row above',
    kept >= 150 && kept === most && (await firstKey()) === head,
    [kept, most],
  );
  const bar = await page
    .locator(feed)
    .evaluate((el) => (el as HTMLElement).offsetWidth - el.clientWidth);
  fact('time-ordered lists hide the native scrollbar', bar === 0, bar);
  const box = await page.locator(feed).boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 0) - 7;
  await page.locator(feed).evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
  await page.waitForTimeout(200);
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 60, { steps: 4 });
  await page.waitForTimeout(150);
  const said = await page.locator(`${feed} .time-rail .scrub`).evaluate((el) => ({
    shown: !(el as HTMLElement).hidden,
    text: el.textContent ?? '',
  }));
  fact(
    'a held scrollbar says the time of the row there',
    Boolean(said.shown) &&
      /^(\d{4}\/\d\d\/\d\d)?( ?\d\d:\d\d)?$/.test(said.text) &&
      said.text !== '',
    said,
  );
  await page.mouse.up();
  await page.waitForTimeout(1150);
  fact(
    'released, the label goes a second after the last scroll',
    await page
      .locator(`${feed} .time-rail .scrub`)
      .evaluate((el) => (el as HTMLElement).hidden === true),
  );

  // A zoomed picture: the wheel zooms about the pointer, a drag moves it.
  await page.locator(feed).evaluate((el) => el.scrollTo(0, 0));
  const pic = page.locator(`${feed} .mbox`).first();
  await pic.scrollIntoViewIfNeeded();
  await pic.click();
  await page.locator('.mstage img').waitFor();
  const stage = await center(page, '.mstage');
  await page.mouse.move(stage.x + 40, stage.y + 30);
  await page.mouse.wheel(0, -900);
  const at = (): Promise<string> =>
    page.locator('.mstage img').evaluate((i) => (i as HTMLElement).style.transform);
  const before = await at();
  await page.mouse.down();
  await page.mouse.move(stage.x - 80, stage.y - 40, { steps: 5 });
  const during = await page.locator('.mstage').evaluate((el) => el.classList.contains('held'));
  await page.mouse.up();
  const after = await at();
  fact(
    'a zoomed picture is grabbed and moved, and keeps its zoom',
    during && after !== before && after.split('scale')[1] === before.split('scale')[1],
    [before, after],
  );
  await bars.close();
}

/** The filter's query, period, people and notifications; the kinds of a profile. */
async function filtering(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', { ...still, fresh: true });
  const feed = '.view[data-kind="home"]';
  const field = page.locator(`${feed} .rbar input`);
  const settle = async (): Promise<void> => {
    await page.waitForTimeout(450);
  };
  const authors = (): Promise<string[]> =>
    page.locator(`${feed} .list > .note .nhead .name`).allInnerTexts();
  const all = await count(page, `${feed} .list > .note`);
  await field.fill('from:"Sam Rivera"');
  await settle();
  const sam = await authors();
  fact(
    'from: keeps one person’s notes',
    sam.length > 0 && sam.every((x) => x.includes('Sam Rivera')),
    sam,
  );
  await field.fill('has:image -霧');
  await settle();
  const pics = await page.locator(`${feed} .list > .note`).evaluateAll((notes) =>
    notes.map((n) => ({
      covered: n.classList.contains('hid') || Boolean(n.querySelector('.nrow > .nmain > .cw')),
      body: Boolean(n.querySelector('.nrow > .nmain > .content')),
      image: Boolean(n.querySelector('.mbox img, .mgrid img, .media img')),
      fog: n.textContent?.includes('霧'),
    })),
  );
  const visible = pics.filter((p) => !p.covered);
  const covered = pics.filter((p) => p.covered);
  fact(
    'has:image and -word narrow visible notes together',
    pics.length < all && visible.length > 0 && visible.every(({ image, fog }) => image && !fog),
    { all, filtered: pics.length, visible: visible.length },
  );
  fact(
    'has:image leaves covered slots without a body or image',
    covered.length > 0 && covered.every(({ body, image }) => !body && !image),
    covered.length,
  );
  await page.locator(`${feed} .rclear`).click();
  await settle();
  await page.locator(`${feed} .rtoggle`).click();
  const days = page.locator(`${feed} .pdays input`);
  fact(
    'the period is two days, written yyyy/mm/dd',
    (await days.count()) === 2 && (await days.first().getAttribute('placeholder')) === 'yyyy/mm/dd',
  );
  await days.nth(1).fill('2001/01/01');
  await days.nth(1).press('Enter');
  await settle();
  fact(
    'a period that ends before anything shows nothing',
    (await count(page, `${feed} .list > .note`)) === 0,
  );
  await page.locator(`${feed} .rclear`).click();
  await settle();
  await page.locator(`${feed} .rtoggle`).click();
  await page.locator(`${feed} .padd`).fill('aoi');
  await page.locator(`${feed} .padd`).press('Enter');
  await settle();
  const kept = await authors();
  fact(
    'a person on the list narrows the feed to them and stays as a chip',
    kept.length > 0 &&
      new Set(kept).size === 1 &&
      (await count(page, `${feed} .ppeople .chip`)) === 1,
    [...new Set(kept)],
  );
  await page.locator(`${feed} .ppeople .chip`).click();
  await settle();
  await page.locator(`${feed} .prow`).last().locator('.chip').first().click();
  await page.locator(`${feed} .list > .notif`).first().waitFor();
  fact(
    'notifications flow into the timeline when asked',
    (await count(page, `${feed} .list > .notif`)) > 0,
  );
  await page.locator(`${feed} .rclear`).click();
  await settle();
  fact('and leave again', (await count(page, `${feed} .list > .notif`)) === 0);

  // A profile lists by kind, in tabs under its header.
  await page.locator(`${feed} .note .avb`).first().click();
  const prof = '.pane.cur .view[data-kind="profile"]';
  await page.locator(`${prof} .pkinds`).waitFor();
  const kinds = await page.locator(`${prof} .pkind`).allInnerTexts();
  fact(
    'a profile’s kinds: posts, replies, reposts, reactions, media',
    kinds.join() === 'Posts,Replies,Reposts,Reactions,Media',
    kinds,
  );
  fact(
    'posts first, and none of them answers anybody',
    (await count(page, `${prof} .list > .note .ctx .i-reply`)) === 0,
  );
  await page.locator(`${prof} .pkind`).nth(4).click();
  await page.waitForTimeout(300);
  const media = await page
    .locator(`${prof} .list > .note`)
    .evaluateAll((notes) =>
      notes.map((n) => n.querySelector('.content img, .content video, .mbox') !== null),
    );
  fact(
    'media: every note carries a picture or a video',
    media.every(Boolean) && (await page.locator(`${prof} .pkind.on`).innerText()) === 'Media',
    media,
  );
  await page.context().close();
}

/** The layout of a device that holds nothing yet, for a reader and a visitor, with what lkjstr is in front of
 * Notifications; a saved arrangement kept until it is reset; a reset that loses no draft and can be undone. */
async function defaults(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const tiles = (page: Page): Promise<string[]> =>
    page
      .locator('.pane')
      .evaluateAll((panes) =>
        panes.map((p) =>
          [...p.querySelectorAll<HTMLElement>('.tab')]
            .map((t) => `${t.dataset.view}${t.classList.contains('active') ? '*' : ''}`)
            .join(' '),
        ),
      );
  /** The middle tile opens on what lkjstr is, its first lines in view, and the tab is named after that page. */
  const firstRead = async (page: Page, who: string): Promise<void> => {
    const docs = page.locator('.view[data-kind="docs"]:visible');
    const page1 = docs.locator('.dpage > p').first();
    await page1.waitFor();
    const top = await page1.evaluate((p) => {
      const tile = p.closest('.view') as HTMLElement;
      return Math.round(p.getBoundingClientRect().top - tile.getBoundingClientRect().top);
    });
    fact(
      `${who} first reads what lkjstr is`,
      (await docs.locator('.ditem.on').innerText()) === 'What lkjstr is' &&
        (await page.locator('.tab.active[data-view="docs"]').getAttribute('title')) ===
          'What lkjstr is' &&
        (await page1.innerText()).startsWith('lkjstr is a Nostr client') &&
        top < 400,
      top,
    );
  };
  const want = (front: string): string[] => [
    front === 'home' ? 'home* their-home~lkjsxc' : 'home their-home~lkjsxc*',
    'docs* notifications',
    'compose*',
    'account* settings',
  ];
  const page = await open(browser, '/', { ...still, fresh: true });
  fact(
    'a reader starts on the default layout',
    (await tiles(page)).join() === want('home').join(),
    await tiles(page),
  );
  const boxes = await page.locator('.pane').evaluateAll((panes) =>
    panes.map((p) => {
      const r = p.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.height)];
    }),
  );
  const [a = [], b = [], c = [], d = []] = boxes;
  fact(
    'Home, Documentation over Notifications, then the composer over Accounts in equal halves',
    a[0] === 0 &&
      (b[0] ?? 0) > 500 &&
      (c[0] ?? 0) > (b[0] ?? 0) + 380 &&
      c[0] === d[0] &&
      (d[1] ?? 0) > (c[1] ?? 0) &&
      Math.abs((c[2] ?? 0) - (d[2] ?? 0)) <= 2,
    boxes,
  );
  await firstRead(page, 'a reader');
  await page.locator('.tab[data-view="settings"]').click();
  const fresh = page.locator('.view[data-kind="settings"]:visible');
  await fresh.locator('[data-entry]').first().waitFor();
  await page.waitForTimeout(400);
  fact('Settings opens at its top', (await fresh.evaluate((el) => el.scrollTop)) === 0);
  await page.context().close();
  const guest = await open(browser, '/', { mock: { live: false, accounts: 'none' }, fresh: true });
  fact(
    'a visitor starts on the same layout',
    (await tiles(guest)).join() === want('lkjsxc').join(),
    await tiles(guest),
  );
  fact(
    "a visitor reads lkjsxc's Home where Global was",
    (await guest.locator('.tab.active[data-view="their-home~lkjsxc"]').getAttribute('title')) ===
      "lkjsxc's Home" && (await count(guest, '.view[data-kind="their-home"]:visible .note')) > 0,
  );
  await firstRead(guest, 'a visitor');
  fact(
    'the visitor sees the two ways in at once',
    (await count(guest, '.view[data-kind="account"] [data-f="extension"]:visible')) === 1,
  );
  await guest.context().close();

  // A saved arrangement stays the reader's through a reload, until they reset it.
  const p = await open(browser, '/', still);
  const own = await tiles(p);
  await p.reload();
  await p.waitForSelector('.note');
  fact('a saved arrangement survives the new default', (await tiles(p)).join() === own.join(), [
    own,
    await tiles(p),
  ]);
  // A second Post tab holding a draft, which the default does not have.
  await p.keyboard.press('Alt+Shift+N');
  await p.keyboard.type('Post');
  await p.keyboard.press('Enter');
  const draft = p.locator('.pane:has(.tab.active[data-view="compose~2"]) textarea');
  await draft.fill('kept through a reset');
  await p.waitForTimeout(500);
  // Settings resets this workspace (the tile menu has no reset), with Undo.
  const settingsTab = async () => {
    await p.locator('.bar [data-tab-search]').click();
    await p.locator('.tsearch input').fill('Settings');
    await p.locator('.tsearch input').press('Enter');
    const set = p.locator('.view[data-kind="settings"]:visible');
    await set.locator('[data-entry]').first().waitFor();
    return set;
  };
  let set = await settingsTab();
  const mine = await tiles(p);
  await set.getByRole('button', { name: 'Reset this workspace', exact: true }).click();
  await p.waitForSelector('.tab[data-view="notifications"]');
  fact(
    'Reset this workspace gives the default layout',
    (await tiles(p)).join() === want('home').join(),
    await tiles(p),
  );
  await p.locator('.toast.undo .lnk').click();
  await p.waitForSelector('.tab[data-view="compose~2"]');
  const undone = await tiles(p);
  await p.locator('.tab[data-view="compose~2"]').click();
  fact(
    'Undo puts the arrangement and the draft back',
    undone.join() === mine.join() && (await draft.inputValue()) === 'kept through a reset',
    [undone, mine],
  );
  // Again, without Undo: its closed tabs keep what they held, and a reload keeps the result.
  set = await settingsTab();
  await set.getByRole('button', { name: 'Reset this workspace', exact: true }).click();
  await p.waitForSelector('.tab[data-view="account"]');
  fact(
    'Settings resets this workspace to the default',
    (await tiles(p)).join() === want('home').join(),
    await tiles(p),
  );
  await p.waitForTimeout(600);
  await p.reload();
  await p.waitForSelector('.note');
  fact(
    'a reset survives a reload',
    (await tiles(p)).join() === want('home').join(),
    await tiles(p),
  );
  // Bookmarks closed last, so it comes back first; then Global (the default has lkjsxc's Home in its place); then
  // the Post tab with its draft.
  for (const kind of ['bookmarks', 'global', 'compose~']) {
    await p.locator('.pane .strip > .icon').first().click();
    await p.locator('.menu button', { hasText: 'Reopen closed tab' }).click();
    await p.waitForSelector(`.tab.active[data-view^="${kind}"]`);
  }
  fact(
    'the draft waits in the closed tabs',
    (await p.locator('.pane:has(.tab.active[data-view^="compose~"]) textarea').inputValue()) ===
      'kept through a reset',
  );
  await p.context().close();
}

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

  // Enter: the thread right after the feed, in its tile; Escape drops the selection there, then closes it and comes
  // back to the feed.
  const tabs = await count(page, '.tab');
  const panes = await count(page, '.pane');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pane.cur .view[data-kind="thread"] .note');
  const order = await page
    .locator('.pane.cur .tab')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-view') ?? ''));
  const at = order.findIndex((v) => v.startsWith('thread'));
  fact(
    'Enter opens the thread right after the feed, in its tile',
    (await count(page, '.tab')) === tabs + 1 &&
      (await count(page, '.pane')) === panes &&
      order[at - 1] === 'home',
    order,
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
  await page.waitForSelector('.pane.cur .view[data-kind="docs"] kbd');
  const caps = await page.locator('.view[data-kind="docs"] kbd').allInnerTexts();
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
  // Tab search: one key, a small field; it finds open tabs first and Enter goes there.
  await page.keyboard.press('Escape');
  await page.keyboard.press('o');
  await page.locator('.tsearch input').waitFor();
  const all = await count(page, '.tab');
  await page.keyboard.type('home');
  fact(
    'tab search lists the open tab first, then what could be opened',
    (await count(page, '.tsearch .titem.open')) >= 1 &&
      (await page.locator('.tsearch .titem').first().getAttribute('class'))?.includes('open') ===
        true,
  );
  await page.keyboard.press('Enter');
  fact(
    'Enter goes to the open tab and opens nothing',
    (await count(page, '.tsearch')) === 0 &&
      (await count(page, '.pane.cur .tab.active[data-view="home"]')) === 1 &&
      (await count(page, '.tab')) === all,
  );
  // The composer key returns to the composer that is open; a setting makes it open another.
  const composers = await count(page, '.tab[data-view^="compose"]');
  await page.keyboard.press('n');
  fact(
    'n goes to the Post tab that is open, with the caret in it',
    (await count(page, '.tab[data-view^="compose"]')) === composers &&
      (await page.evaluate(
        () => document.activeElement?.matches('.view[data-kind="compose"] textarea') === true,
      )) &&
      (await page.locator(area).inputValue()) === 'jng?',
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.setItem('lkjstr:settings', '{"composeNew":true}'));
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'lkjstr:settings', newValue: '{"composeNew":true}' }),
    ),
  );
  await page.keyboard.press('n');
  fact(
    'with the setting, n opens another Post tab',
    (await count(page, '.tab[data-view^="compose"]')) === composers + 1,
  );
  // One key closes the tab in front.
  await page.keyboard.press('Escape');
  await page.keyboard.press('x');
  fact('x closes the tab', (await count(page, '.tab[data-view^="compose"]')) === composers);
  await page.context().close();
}

/** The filter row, the media tab, the emoji picker, the notification toggles. */
async function reading(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', still);
  const home = '.pane:has(.tab.active[data-view="home"])';
  const feed = '.view[data-kind="home"]';
  // The filter row is the first row of the content: there by default, and it scrolls away with the notes.
  fact('the filter row is there by default', (await count(page, `${feed} .rbar`)) === 1);
  await page.locator(`${home} .strip > .icon`).first().click();
  fact(
    'the tile menu has no filter switch',
    !(await page.locator('.menu').innerText()).includes('ilter'),
  );
  await page.keyboard.press('Escape');
  await page.locator(feed).evaluate((el) => el.scrollTo(0, 600));
  await page.waitForTimeout(150);
  fact(
    'the filter row scrolls away with the notes',
    await page.locator(feed).evaluate((el) => {
      const bar = el.querySelector('.rbar')?.getBoundingClientRect();
      return Boolean(bar) && (bar?.bottom ?? 0) < el.getBoundingClientRect().top;
    }),
  );
  await page.keyboard.press('/');
  fact(
    '"/" puts the keyboard in the filter and brings it into view',
    await page.evaluate(() => {
      const a = document.activeElement;
      const view = a?.closest('.view');
      return (
        a?.matches('.rbar input') === true &&
        a.getBoundingClientRect().top >= (view?.getBoundingClientRect().top ?? 0)
      );
    }),
  );
  await page.keyboard.type('zzzz');
  await page.waitForTimeout(400);
  fact('a narrowing row offers its own way back', (await count(page, `${feed} .rclear`)) === 1);
  await page.locator(`${feed} .rclear`).click();
  await page.locator(`${feed} .note`).first().waitFor();
  fact(
    'clearing empties the field',
    (await page.locator(`${feed} .rbar input`).inputValue()) === '',
  );
  await page.locator(`${feed} .note`).first().waitFor();
  const times = await page.locator(`${feed} .note time`).evaluateAll(
    (els, today) =>
      els
        .filter((e) => !e.getAttribute('title')?.startsWith(today))
        .map((e) => {
          const text = e.textContent ?? '';
          const title = e.getAttribute('title') ?? '';
          // Dated feeds put the day in a divider, including just after midnight.
          // Require the matching divider and exact clock; quoted notes keep full dates.
          if (/^\d\d:\d\d$/.test(text) && !e.closest('.quote')) {
            let divider = e.closest('.list > *')?.previousElementSibling;
            while (divider && !divider.matches('.day')) divider = divider.previousElementSibling;
            return divider?.textContent === title.slice(0, 10) && text === title.slice(11, 16)
              ? `${divider.textContent} ${text}`
              : '';
          }
          return text === title.slice(0, 16) ? text : '';
        }),
    dayOf(Date.now()),
  );
  fact(
    'older notes carry their date',
    times.every((x) => /^\d{4}\/\d\d\/\d\d \d\d:\d\d$/.test(x)),
    times.slice(0, 3),
  );

  // A picture opens as a new tab right after Home, in Home's tile (owner, 2026-11-22); Escape closes it, Home comes
  // back where it was, and the keyboard is back on the picture.
  const panes = await count(page, '.pane');
  const tabCount = await count(page, '.tab');
  const box = page.locator(`${feed} .mbox`).first();
  await box.scrollIntoViewIfNeeded();
  const top = await page.locator(feed).evaluate((e) => e.scrollTop);
  await box.click();
  await page.locator('.view.mview .mstage img').waitFor();
  const tabsNow = await page
    .locator('.pane:has(.tab[data-view="home"]) .tab')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-view') ?? ''));
  fact(
    'a picture opens as a new tab right after Home, in its tile, with the keyboard',
    (await count(page, '.pane')) === panes &&
      (await count(page, '.tab')) === tabCount + 1 &&
      (await count(page, '.layer > *')) === 0 &&
      tabsNow[tabsNow.indexOf('home') + 1]?.startsWith('media') === true &&
      (await count(page, '.tab.active[data-view^="media"]')) === 1 &&
      (await page.evaluate(() => document.activeElement?.matches('.mview') === true)),
    tabsNow,
  );
  if (shot) await page.screenshot({ path: shot.replace(/\.png$/, '-media-1440.png') });
  const scale = (): Promise<string> => page.locator('.mscale').innerText();
  const fitted = await scale();
  const stage = await center(page, '.mstage');
  await page.mouse.move(stage.x, stage.y);
  await page.mouse.wheel(0, -400);
  fact('the wheel zooms', (await scale()) !== fitted, [fitted, await scale()]);
  await page.keyboard.press('Escape');
  fact(
    'Escape closes the picture tab: Home is back where it was, the keyboard on the picture',
    (await count(page, '.tab[data-view^="media"]')) === 0 &&
      (await count(page, '.tab.active[data-view="home"]')) === 1 &&
      (await page.evaluate(() => document.activeElement?.matches('.mbox') === true)) &&
      (await page.locator(feed).evaluate((e) => e.scrollTop)) === top,
  );
  await box.click();
  await page.locator('.tab.active[data-view^="media"] .x').click();
  fact(
    'its × does the same',
    (await count(page, '.tab[data-view^="media"]')) === 0 &&
      (await count(page, '.tab.active[data-view="home"]')) === 1 &&
      (await page.locator(feed).evaluate((e) => e.scrollTop)) === top,
  );

  // The picker: search in either language, the choice becomes the reader's reaction, the row keeps its place.
  await page.locator(feed).evaluate((e) => (e.scrollTop = 0));
  const note = page.locator(`${feed} .note`).nth(2);
  const smile = note.locator('.a-smile');
  await note.scrollIntoViewIfNeeded();
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
  // The preview strip: it describes what is under the pointer or has the keyboard, and nothing else moves.
  await page.locator('.epick .egroup[data-section="cat:0"] .ecell').first().waitFor();
  const pickerPlace = () =>
    page.locator('.epick').evaluate((p) => {
      const at = (s: string) => JSON.stringify(p.querySelector(s)?.getBoundingClientRect());
      return (
        at('.egrid') + at('.ecats') + at('input') + (p.querySelector('.egrid')?.scrollTop ?? 0)
      );
    });
  const steady = await pickerPlace();
  await page.locator('.epick .egroup[data-section="used"] .ecell').first().hover();
  const named = await page.locator('.eprev .ename').innerText();
  await page.locator('.epick input').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  const keyed = await page.locator('.eprev .ename').innerText();
  const strip = await page.locator('.eprev').boundingBox();
  fact(
    'the preview names the emoji under the pointer and the keyboard; the picker does not move',
    named.length > 0 && keyed.length > 0 && (await pickerPlace()) === steady,
    [named, keyed],
  );
  fact(
    'the preview strip takes no press',
    !!strip &&
      (await page.evaluate(
        ([x, y]) => !document.elementFromPoint(x ?? 0, y ?? 0)?.closest('.eprev'),
        [strip.x + strip.width / 2, strip.y + strip.height / 2],
      )),
  );
  await page.keyboard.press('Escape');
  // The custom tab: one button after frequently used, reached by the arrows too, goes to the reader's own list and
  // lights while any of their sets is in view; a typed code finds custom and standard emoji under their headings.
  await note.locator('.a-smile').click();
  await page.locator('.epick .egroup[data-cat="custom"] .ecell').first().waitFor();
  await page.locator('.epick .ecats button').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const customTab = await page.locator('.epick').evaluate((p) => {
    const grid = p.querySelector<HTMLElement>('.egrid');
    const first = p.querySelector<HTMLElement>('.egroup[data-cat="custom"]');
    return {
      keyed: document.activeElement?.getAttribute('data-section'),
      lit: p.querySelector('.ecats button.on')?.getAttribute('data-section'),
      top: !!grid && !!first && Math.abs(grid.scrollTop - first.offsetTop) <= 1,
      groups: [...p.querySelectorAll<HTMLElement>('.egroup[data-cat="custom"]')].map(
        (g) => g.dataset.section,
      ),
    };
  });
  fact(
    "the custom tab goes to the reader's own list, then each set under its own key",
    customTab.keyed === 'custom' &&
      customTab.lit === 'custom' &&
      customTab.top &&
      /^10030:\w+:,30030:\w+:kotoba,30030:\w+:kurashi$/.test(customTab.groups.join()),
    customTab,
  );
  const typedCode = async (code: string) => {
    await page.locator('.epick input').fill(code);
    return [
      (await page.locator('.epick .egrid .ehd').allTextContents()).join(),
      await page.locator('.epick .ecell').first().getAttribute('aria-label'),
      await page
        .locator('.epick .ecats')
        .evaluate((c) => c.querySelector('button.on')?.getAttribute('data-section') ?? ''),
    ].join();
  };
  const inTab = await typedCode(':ok');
  await page.locator('.epick input').fill('');
  const back = await page
    .locator('.epick .egrid')
    .evaluate(
      (g) =>
        g.scrollTop ===
        (g.querySelector<HTMLElement>('.egroup[data-cat="custom"]')?.offsetTop ?? -1),
    );
  await page.locator('.epick .ecats button[data-section="used"]').click();
  const elsewhere = (await typedCode(':ok')).split(',').slice(0, 3).join();
  fact(
    'in the custom tab a typed code finds custom emoji first under their heading, and back',
    inTab === 'Custom emoji,Standard emoji,:ok:,custom' && back,
    [inTab, back],
  );
  fact(
    'elsewhere the best match leads, so Enter takes what it took before',
    elsewhere === 'Standard emoji,Custom emoji,OK button',
    elsewhere,
  );
  await page.keyboard.press('Escape');
  // A custom emoji in a note says what it is in a popover that never takes the press meant for the note.
  const inline = page.locator(`${feed} .note .text img.emo`).first();
  await inline.scrollIntoViewIfNeeded();
  await inline.hover();
  await page.locator('.epeek:not([hidden])').waitFor();
  const peek = await page.locator('.epeek').boundingBox();
  fact(
    'a custom emoji shows its picture and code in a popover that takes no press',
    (await page.locator('.epeek .ename').innerText()) === (await inline.getAttribute('alt')) &&
      !!peek &&
      (await page.evaluate(
        ([x, y]) => !document.elementFromPoint(x ?? 0, y ?? 0)?.closest('.epeek'),
        [peek.x + peek.width / 2, peek.y + peek.height / 2],
      )),
  );
  await page.mouse.move(2, 2);
  // A Unicode emoji says what it is in the same popover: its name, from the table asked for only now, and its
  // shortcode.
  const unicode = page.locator(`${feed} .note .text .uemo`).first();
  await unicode.scrollIntoViewIfNeeded();
  await unicode.hover();
  await page.locator('.epeek .ename:not(:empty)').waitFor();
  fact(
    'a Unicode emoji shows its name and shortcode in the same popover',
    (await page.locator('.epeek .ebig').innerText()).length > 0 &&
      /^:[a-z0-9_+-]+:$/.test(await page.locator('.epeek .ecode').innerText()),
  );
  await page.mouse.move(2, 2);
  // The keyboard reaches a Unicode and a custom emoji in note text with Tab, and the popover follows each; a press on
  // either is still a press on the note.
  const owner = page
    .locator(`${feed} .note`)
    .filter({ has: page.locator('.text img.emo') })
    .filter({ has: page.locator('.text .uemo') })
    .first();
  await owner.scrollIntoViewIfNeeded();
  await owner.locator('.name').first().focus();
  const on = (q: string) => page.evaluate((s) => document.activeElement?.matches(s) === true, q);
  for (let n = 0; n < 12 && !(await on('.text .uemo, .text img.emo')); n++)
    await page.keyboard.press('Tab');
  await page.locator('.epeek .ename:not(:empty)').waitFor();
  const glyph = await page.evaluate(() => document.activeElement?.textContent ?? '');
  fact(
    'Tab reaches a Unicode emoji in a note and names it in its popover',
    (await on('.note .text .uemo')) && (await page.locator('.epeek .ebig').innerText()) === glyph,
  );
  await page.keyboard.press('Tab');
  await page.locator('.epeek img').waitFor();
  fact(
    'Tab reaches a custom emoji in a note and shows its popover',
    (await on('.note .text img.emo')) &&
      (await page.locator('.epeek .ename').innerText()) ===
        (await page.evaluate(() => document.activeElement?.getAttribute('alt'))),
  );
  await page.keyboard.press('Shift+Tab');
  await page.locator('.epeek .ebig:not(img)').waitFor();
  fact(
    'back with the keyboard, the popover is the Unicode emoji again',
    (await on('.note .text .uemo')) && (await page.locator('.epeek .ebig').innerText()) === glyph,
  );
  await page.keyboard.press('Shift+Tab');
  // What has the keyboard next decides: nothing, or a name that holds an emoji and shows that one instead.
  const after = await page.evaluate(() => {
    const at = document.activeElement;
    const held = at?.matches('.name, .lnk') ? at.querySelector('img.emo, .uemo') : null;
    return held instanceof HTMLImageElement ? held.alt : (held?.textContent ?? '');
  });
  fact(
    'leaving it with the keyboard closes the popover, or shows the one of what has the keyboard',
    !(await on('.uemo, img.emo')) &&
      (after
        ? (await page.locator('.epeek .ename').innerText()) === after ||
          (await page.locator('.epeek .ebig').innerText()) === after
        : (await count(page, '.epeek')) === 0),
    after,
  );
  // A name or a mention takes the keyboard for the emoji inside it: Tab onto one shows the popover, and no emoji
  // inside a control is a tab stop of its own.
  const nameWithEmoji = page.locator(`${feed} .note .nhead .name:has(.uemo)`).first();
  await nameWithEmoji.scrollIntoViewIfNeeded();
  await nameWithEmoji.locator('xpath=ancestor::article[1]').locator('.avb').first().focus();
  await page.keyboard.press('Tab');
  await page.locator('.epeek .ename:not(:empty)').waitFor();
  fact(
    'Tab onto a name shows the popover of its emoji',
    (await on('.nhead .name')) &&
      (await page.locator('.epeek .ebig').innerText()) ===
        (await nameWithEmoji.locator('.uemo').first().innerText()),
  );
  await page.keyboard.press('Shift+Tab');
  fact('leaving the name closes its popover', (await count(page, '.epeek')) === 0);
  const mention = page.locator(`${feed} .note .text .lnk:has(.uemo)`).first();
  await mention.scrollIntoViewIfNeeded();
  await mention.locator('xpath=ancestor::article[1]').locator('.nhead .name').first().focus();
  for (let n = 0; n < 8 && !(await on('.text .lnk')); n++) await page.keyboard.press('Tab');
  await page.locator('.epeek .ename:not(:empty)').waitFor();
  fact(
    'Tab onto a mention shows the popover of its emoji',
    (await on('.text .lnk')) &&
      (await page.locator('.epeek .ebig').innerText()) ===
        (await mention.locator('.uemo').first().innerText()),
  );
  fact(
    'no emoji inside a control is a tab stop of its own',
    await page.evaluate(
      () =>
        document.querySelectorAll(':is(button, a, [role="link"]) :is(.uemo, .emo)[tabindex]')
          .length === 0,
    ),
  );
  await owner.locator('.text .uemo').first().click();
  await page.locator('.th-focus').waitFor();
  fact('a press on a Unicode emoji opens its note', (await count(page, '.epeek')) === 0);
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });
  await page.locator(`${feed} .note`).first().waitFor();
  await inline.scrollIntoViewIfNeeded();
  await inline.click();
  await page.locator('.th-focus').waitFor();
  fact('a press on a custom emoji opens its note', (await count(page, '.epeek')) === 0);
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });
  await page.locator(`${feed} .note`).first().waitFor();
  // A picture that fails late, while its note is in view, keeps its box: nothing in the note moves, and the code is
  // drawn small inside it. Once the note has been out of sight the code is whole.
  await page.route('https://emoji.invalid/**', async (route) => {
    // Long enough that, whenever it was asked for, the failure comes after the note is in view.
    await new Promise((done) => setTimeout(done, 4000));
    // An empty answer is a picture that cannot be had, without an error in the console.
    await route.fulfill({ status: 204, body: '' });
  });
  await page.reload();
  const slowFirst = page.locator(`${feed} .note:has([alt=":slow-cat:"])`).first();
  await slowFirst.waitFor({ state: 'attached' });
  // Held by its key: the picture's alt goes with the picture.
  const slowKey = await slowFirst.getAttribute('data-key');
  const slowNote = page.locator(`${feed} .note[data-key="${slowKey}"]`);
  await slowNote.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  const shape = () =>
    slowNote.evaluate((n) => {
      const next = n.nextElementSibling?.getBoundingClientRect().top ?? 0;
      return `${n.getBoundingClientRect().height} ${next - n.getBoundingClientRect().top}`;
    });
  const inView = await shape();
  await slowNote.locator('.efail').waitFor({ timeout: 10000 });
  const failed = await shape();
  const held = await slowNote.locator('.efail.held').count();
  fact(
    'a picture that fails while its note is in view moves nothing; its code waits in its box',
    failed === inView && held === 1,
    { inView, failed, held },
  );
  await page.locator(feed).evaluate((e) => (e.scrollTop = 0));
  await page.waitForFunction(() => !document.querySelector('.efail.held'));
  await slowNote.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  fact(
    'out of sight, the failed emoji becomes its whole code',
    await slowNote
      .locator('.efail')
      .evaluate((e) => e.textContent === ':slow-cat:' && e.scrollWidth <= e.clientWidth),
  );
  await page.unroute('https://emoji.invalid/**');
  await page.locator(feed).evaluate((e) => (e.scrollTop = 0));

  const notes = '.view[data-kind="notifications"]';
  fact('four notification toggles', (await count(page, `${notes} .ntype`)) === 4);
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
  // A notification answers a press anywhere, as a note does; a face opens the person, as a name does.
  const npane = `.pane:has(.tab[data-view="notifications"])`;
  const news = page.locator(`${notes} .notif`).first();
  const nbox = await news.boundingBox();
  await page.mouse.click(
    (nbox?.x ?? 0) + (nbox?.width ?? 0) - 6,
    (nbox?.y ?? 0) + (nbox?.height ?? 0) - 4,
  );
  await page.locator(`${npane} .tab.active[data-view^="thread"]`).waitFor();
  fact('a press on a notification’s margin opens its note', true);
  await page.keyboard.press('Escape');
  await page.locator(`${notes} .notif .avb`).first().click();
  await page.locator(`${npane} .tab.active[data-view^="profile"]`).waitFor();
  fact('a face in a notification opens the person', true);
  const order = await page
    .locator(`${feed} .note .acts`)
    .first()
    .evaluate((el) => [...el.children].map((c) => c.className.match(/a-(\w+)/)?.[1]).join(' '));
  fact(
    'actions: reply, repost, reaction, then the rest',
    order.startsWith('reply repost heart zap smile'),
    order,
  );
  await page.context().close();

  // A phone: the picture is a new tab in the one tile; a finger gets 40px.
  const ctx = await isolatedContext(browser, {
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
  const phoneTabs = await count(phone, '.tab');
  await phone.locator('.mbox').first().tap();
  await phone.locator('.view.mview .mstage img').waitFor();
  const bar = await phone.locator('.mbar a.icon').boundingBox();
  fact(
    'phone: a picture is a new tab in the one tile',
    (await count(phone, '.pane')) === 1 &&
      (await count(phone, '.tab')) === phoneTabs + 1 &&
      (await count(phone, '.tab.active[data-view^="media"]')) === 1 &&
      (bar?.height ?? 0) >= 40 &&
      (await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
  );
  if (shot) await phone.screenshot({ path: shot.replace(/\.png$/, '-media-390.png') });
  await phone.locator('.tab.active .x').tap();
  fact(
    'phone: closing returns to the feed',
    (await count(phone, '.tab[data-view^="media"]')) === 0 &&
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

  // Relays shows state and edits nothing; the list is edited in Settings, one press away.
  const menu = async (label: string): Promise<void> => {
    await page.locator('.brand').click();
    await page.locator('.menu button', { hasText: label }).click();
  };
  // The account menu holds only what is the reader's own: their profile first, then the Accounts tab.
  await page.locator('.acct').click();
  const own = await page.locator('.menu button').allInnerTexts();
  fact(
    'the account menu: own profile, then Accounts; nothing reachable elsewhere',
    (own[0] ?? '').includes('Profile') &&
      own.at(-1) === 'Accounts' &&
      !own.some((x) => /Settings|Relays|Shortcuts|About/.test(x)),
    own,
  );
  await page.locator('.menu button').first().click();
  await page.locator('.pane.cur .tab.active[data-view^="profile"]').waitFor();
  fact(
    'the menu’s own row opens the reader’s profile',
    (await count(page, '.pane.cur .view[data-kind="profile"] .profile .pbtns .btn')) === 0,
  );
  await page.keyboard.press('Escape');
  await menu('Relays');
  const rv = '.view[data-kind="relays"]';
  await page.locator(`${rv} .rrow`).first().waitFor();
  fact(
    'relays: one flat list, the reader’s own first, nothing folded away',
    (await count(page, `${rv} .rrow:has(.ruse)`)) === 4 &&
      (await count(page, `${rv} .rrow`)) > 4 &&
      (await count(page, `${rv} details, ${rv} h3`)) === 0 &&
      (await count(page, `${rv} .rlist`)) === 1,
    [await count(page, `${rv} .rrow:has(.ruse)`), await count(page, `${rv} .rrow`)],
  );
  const texts = await page.locator(`${rv} .rrow:has(.ruse) .rsub`).allInnerTexts();
  fact(
    'relays: each says its state, an error in its own words',
    texts.some((x) => /^Connected · 42 ms/.test(x)) &&
      texts.some((x) => x.includes('connection refused')),
    texts,
  );
  fact(
    'relays: the tab only shows; what a relay is used for is words, not switches',
    (await count(page, `${rv} input, ${rv} .rtog, ${rv} .x, ${rv} form`)) === 0 &&
      (await page.locator(`${rv} .ruse`).first().innerText()) === 'Read · Write',
  );
  await page.locator('.pane:has(.view[data-kind="relays"]) [title="Tile menu"]').click();
  await page.locator('.menu button', { hasText: 'Edit the list in Settings' }).click();
  const rs = '.view[data-kind="settings"]:visible .sitem[data-entry="set.relayList"]';
  await page.locator(`${rs} .rrow`).first().waitFor();
  const mine = (): Promise<number> => count(page, `${rs} .rrow`);
  fact(
    'relays: Settings opens on the relay list, in view',
    (await mine()) === 4 &&
      (await page.locator(rs).evaluate((e) => {
        const view = e.closest('.view')?.getBoundingClientRect();
        const box = e.getBoundingClientRect();
        return view !== undefined && box.top >= view.top - 1 && box.top < view.bottom - 80;
      })),
    await mine(),
  );
  const slow = page.locator(`${rs} .rrow`, { hasText: 'slow.example.org' });
  await slow.locator('[data-f="write"]').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.sitem .rrow[data-key="wss://slow.example.org"] [data-f="write"]')
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
    .locator(`${rs} .rrow`, { hasText: 'nos.example.net' })
    .locator('[data-f="remove"]')
    .click();
  await page.locator('.toast.undo').waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.sitem[data-entry="set.relayList"] .rrow').length === 3,
  );
  fact(
    'relays: after a removal the keyboard is on the next row',
    await page.evaluate(() => document.activeElement?.closest('.rrow') !== null),
  );
  await page.locator('.toast.undo button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.sitem[data-entry="set.relayList"] .rrow').length === 4,
  );
  fact(
    'relays: undo puts it back where it was',
    (await page.locator(`${rs} .rrow .rhost`).nth(1).innerText()) === 'nos.example.net',
  );
  await page.locator(`${rs} .addrow input`).fill('not a relay');
  await page.keyboard.press('Enter');
  fact(
    'relays: a wrong address is refused and kept for fixing',
    (await count(page, `${rs} .addrow input[aria-invalid]`)) === 1,
  );
  await page.locator(`${rs} .addrow input`).fill('relay.new.example');
  await page.keyboard.press('Enter');
  await page.locator(`${rs} .rrow.s-connecting`, { hasText: 'relay.new.example' }).waitFor();
  await page.locator(`${rs} .rrow.s-connected`, { hasText: 'relay.new.example' }).waitFor();
  fact(
    'relays: an added relay connects in view, the field ready for the next',
    await page.evaluate(
      () =>
        document.activeElement?.matches('.addrow input') === true &&
        (document.activeElement as HTMLInputElement).value === '',
    ),
  );
  await page.locator('.tab.active[data-view^="settings"] > .x').click();

  // Docs: a tree about lkjstr; the shortcuts, the version facts and the policy are pages of it, each an ordinary tab.
  await menu('Documentation');
  const sv = '.pane.cur .view[data-kind="docs"]';
  await page.locator(`${sv} .dtree`).waitFor();
  const tree = await page
    .locator(`${sv} .dtree`)
    .evaluate((nav) =>
      [...nav.querySelectorAll('details')].map(
        (d) =>
          `${d.querySelector('summary')?.textContent}: ${[...d.querySelectorAll('.ditem')].map((b) => b.textContent).join(', ')}`,
      ),
    );
  fact(
    'docs: a tree of groups and pages',
    tree.join(' | ') ===
      'About lkjstr: What lkjstr is, Version and licence | Using it: Keys and safety, Private messages, Relays, Filters, Shortcuts | Legal: Privacy policy, Terms',
    tree,
  );
  fact(
    'docs: opens on what lkjstr is, and the tab is named after the page',
    (await page.locator(`${sv} .ditem.on`).innerText()) === 'What lkjstr is' &&
      (await page.locator('.pane.cur .tab.active > span').innerText()) === 'What lkjstr is' &&
      (await page.locator(`${sv} .dpage`).innerText()).includes('runs entirely in this browser'),
  );
  await page.locator(`${sv} .ditem`, { hasText: 'Shortcuts' }).click();
  const caps = await page.locator(`${sv} kbd`).allInnerTexts();
  fact(
    'shortcuts: the key table, as this device names the keys',
    (await count(page, `${sv} dt`)) === Object.keys(KEYS).length &&
      caps.includes('/') &&
      caps.includes('X') &&
      caps.includes('O') &&
      caps.includes('Alt+Shift+1 … 9') &&
      caps.includes('Ctrl+Enter') &&
      caps.includes('Space'),
    caps,
  );
  await page.locator(`${sv} .ditem`, { hasText: 'Version and licence' }).click();
  const about = await page.locator(`${sv} .dpage`).innerText();
  fact(
    'about: version, engine, source, licence',
    /lkjstr \d+\.\d+\.\d+/.test(about) &&
      about.includes(`mock, protocol ${PROTOCOL_VERSION}`) &&
      (await count(page, `${sv} a[href="https://github.com/lkjsxc/lkjstr"]`)) === 1 &&
      about.includes('Apache License 2.0'),
    about,
  );
  await page.locator(`${sv} .ditem`, { hasText: 'Privacy policy' }).click();
  fact(
    'the privacy policy and the terms are pages of the tree',
    (await page.locator(`${sv} .dpage`).innerText()).includes('no tracking cookies') &&
      (await page.locator('.pane.cur .tab.active > span').innerText()) === 'Privacy policy',
  );
  await page.locator(`${sv} .dgroup summary`).first().click();
  fact(
    'a group of the tree closes',
    !(await page.locator(`${sv} .ditem`, { hasText: 'What lkjstr is' }).isVisible()),
  );
  fact('no heading repeats a tab title', (await count(page, `${sv} h1, ${rv} h1`)) === 0);
  await page.keyboard.press('o');
  await page.keyboard.type('terms');
  await page.keyboard.press('Enter');
  await page.locator('.pane.cur .tab.active > span', { hasText: 'Terms' }).waitFor();
  fact('tab search goes to a docs page by its name', true);

  // Settings: the lists, each removal undoable.
  await menu('Settings');
  const set = '.view[data-kind="settings"]';
  await page.locator(`${set} .srow`).first().waitFor();
  const srows = (): Promise<number> => count(page, `${set} .srow:not(.rrow)`);
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
    () => document.querySelectorAll('.view[data-kind="settings"] .srow:not(.rrow)').length === 4,
  );
  fact(
    'settings: an emptied list says so',
    (await page.locator(`${set} .sitem[data-entry="set.mute.word"] .snone`).innerText()) ===
      'No muted words.',
  );
  await page.locator('.toast.undo button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow:not(.rrow)').length === 5,
  );
  await page.locator(`${set} .ssearch input`).fill('servers');
  await page.locator(`${set} .srow`, { hasText: 'media.example.jp' }).locator('.x').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow:not(.rrow)').length === 4,
  );
  await page.locator('.toast.undo button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.view[data-kind="settings"] .srow:not(.rrow)').length === 5,
  );
  fact(
    'settings: a media server comes back first, as it was',
    (await page.locator(`${set} .sitem:visible .srow .clip`).first().innerText()) ===
      'media.example.jp',
  );
  const offers = await page.locator(`${set} .soffers .chip`).allInnerTexts();
  fact(
    'media servers: a few choices, Blossom first',
    offers[0] === '+ blossom.band' && offers.length >= 3,
    offers,
  );
  await page.locator(`${set} .soffers .chip`).first().click();
  await page.locator(`${set} .srow`, { hasText: 'blossom.band' }).waitFor();
  fact(
    'the recommended Blossom server goes to the front and leaves the choices',
    (await page.locator(`${set} .sitem:visible .srow .clip`).first().innerText()) ===
      'blossom.band' &&
      !(await page.locator(`${set} .soffers .chip`).allInnerTexts()).includes('+ blossom.band'),
  );
  await page.context().close();

  // A phone: the action row has room, by the tile's width; the bookmark is in the "…" menu.
  const ctx = await isolatedContext(browser, {
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

/** Accounts: a first visit, every way in with its failure, the key of a created account, read-only, switching,
 * removing, signed out again; and a person whose name has not arrived. */
async function accounts(browser: Browser): Promise<void> {
  const page = await open(browser, '/', { mock: { live: false, accounts: 'none' } });
  const av = '.view[data-kind="account"]:visible';
  const text = (sel: string): Promise<string> => page.locator(sel).first().innerText();
  fact(
    'first visit: one tile of notes, nothing empty, the way in on the bar',
    (await count(page, '.pane')) === 1 &&
      (await count(page, '.tab')) === 1 &&
      (await count(page, '.tab[data-view="global"]')) === 1 &&
      (await count(page, '.fstate:not(:empty)')) === 0 &&
      (await text('.acct.out')) === 'Sign in' &&
      (await page.locator('.bar .icon:has(.i-pen)').isHidden()),
  );
  fact(
    'first visit: what would publish is drawn off, counts stay',
    (await count(page, '.note .act.a-reply.off')) > 0 &&
      (await count(page, '.note .act.a-smile')) === 0 &&
      (await count(page, '.note .act.a-more:not(.off)')) > 0,
  );
  await page.locator('.note .act.a-heart').first().click({ force: true });
  fact(
    'a visitor who presses like is told how to sign in',
    (await text('.toast.undo')).startsWith('Sign in to do this') &&
      (await text('.toast.undo button')) === 'Sign in',
  );
  // A list that belongs to an account, opened signed out, offers the way in instead of "nothing here".
  await page.keyboard.press('g');
  await page.keyboard.press('h');
  await page.locator('.view[data-kind="home"] .fstate .btn').click();
  await page.locator(`${av} [data-f="extension"]`).waitFor();
  fact(
    'a list of one’s own, signed out, leads to sign-in',
    (await count(page, `${av} .arow`)) === 0,
  );
  fact(
    'the tab starts with its content',
    (await count(page, `${av} h1, ${av} h2, ${av} h3`)) === 0,
  );

  // Every way in fails honestly, where it was pressed, with the way forward.
  await page.locator(`${av} [data-f="extension"]`).click();
  await page.locator(`${av} .asaid.error`).waitFor();
  fact(
    'no extension: said in words, with what to do',
    (await text(`${av} .asaid.error`)).startsWith('No signer extension was found.'),
  );
  const key = page.locator(`${av} input[type="password"]`);
  const between = await page.locator(`${av} .apair`).evaluate((el) => el.children.length);
  fact(
    'two ways in stand together; the key field waits behind one quiet line',
    between === 2 && !(await key.isVisible()),
    between,
  );
  await page.locator(`${av} [data-f="other"]`).click();
  fact(
    'the line opens the field with the keyboard in it',
    await key.evaluate((el) => el === document.activeElement),
  );
  await key.fill('hunter2 is not a key');
  await key.press('Enter');
  await page.locator(`${av} .asaid.error`, { hasText: 'not an nsec' }).waitFor();
  fact(
    'a wrong key: refused, the field emptied, the text nowhere on the page',
    (await key.inputValue()) === '' &&
      !(await page.locator('body').innerText()).includes('hunter2') &&
      (await count(page, `${av} .asaid.error`)) === 1,
  );
  await key.fill('bunker://00ffee00ffee?relay=wss://relay.example.jp&secret=refuse');
  await key.press('Enter');
  await page.locator(`${av} .asaid.error`, { hasText: 'remote signer' }).waitFor();
  await page.evaluate(() => {
    (window as { nostr?: unknown }).nostr = { getPublicKey: () => Promise.reject(new Error('no')) };
  });
  await page.locator(`${av} [data-f="extension"]`).click();
  await page.locator(`${av} .asaid.error`, { hasText: 'extension refused' }).waitFor();
  fact('every refusal has its own words', true);

  // A created account opens on its key, in the reader's own layout, and the key goes nowhere else.
  await page.locator(`${av} [data-f="create"]`).click();
  await page.locator(`${av} .kbox .kpassword`).waitFor();
  fact(
    'a created account opens protected backup with raw key folded',
    (await count(page, `${av} .kfield`)) === 0 &&
      (await page.locator(`${av} .kbox [type="submit"]`).isDisabled()),
  );
  await page.locator(`${av} [data-f="raw"]`).click();
  await page.locator(`${av} .kbox .kfield`).waitFor();
  await page.waitForFunction(
    () => document.querySelector<HTMLInputElement>('.kfield')?.value.startsWith('nsec1') === true,
  );
  const secret = await page.locator(`${av} .kfield`).inputValue();
  const leaks = (): Promise<boolean> =>
    page.evaluate(
      (k) =>
        document.body.innerText.includes(k) ||
        Object.keys(localStorage).some((x) => (localStorage.getItem(x) ?? '').includes(k)) ||
        location.href.includes(k),
      secret,
    );
  fact(
    'a created account: the ordinary layout arrives, and explicit raw backup stays covered',
    (await count(page, '.pane')) === 4 &&
      (await page.locator(`${av} .kfield`).getAttribute('type')) === 'password' &&
      (await text(`${av} .kbox [data-f="done"]`)) === 'I saved it' &&
      !(await leaks()),
  );
  fact(
    'someone without a profile is named by a short npub, never by hex',
    /^npub1.{5}…/.test(await text(`${av} .arow.on b`)) &&
      !/[0-9a-f]{64}/.test(await page.locator('body').innerText()),
    await text(`${av} .arow.on b`),
  );
  await page.locator(`${av} [data-f="show"]`).click();
  fact(
    'Show uncovers it; nothing is stored',
    (await page.locator(`${av} .kfield`).getAttribute('type')) === 'text' && !(await leaks()),
  );
  await page.locator(`${av} [data-f="done"]`).click();
  fact(
    'saved: the box is gone and Back up key offers it again',
    (await count(page, `${av} .kbox`)) === 0 &&
      (await count(page, `${av} [data-f="backup"]`)) === 1,
  );

  // A read-only account is plain at the composer and on every action before anything is pressed.
  await page.locator(`${av} [data-f="other"][aria-expanded="false"]`).click();
  await key.fill(`npub1${'q'.repeat(58)}`);
  await key.press('Enter');
  await page.locator('.acct .ro').waitFor();
  await page.locator('.view[data-kind="compose"] .cwho .badge').waitFor();
  fact(
    'read-only: the composer says so and cannot post; actions are off',
    (await text('.view[data-kind="compose"] .cwho .badge')) === 'Read-only' &&
      (await page.locator('.view[data-kind="compose"] .btn.primary:visible').isDisabled()) &&
      (await count(page, '.note .act.a-reply:not(.off)')) === 0 &&
      (await count(page, `${av} .arow`)) === 2,
  );
  // Switching: a press on the other account; the composer follows.
  await page.locator(`${av} .arow:not(.on) [data-f="use"]`).click();
  await page.waitForFunction(() => !document.querySelector('.acct .ro'));
  fact(
    'switching: the pressed account is in use and can post',
    (await count(page, '.view[data-kind="compose"] .cwho .badge')) === 0 &&
      (await count(page, '.note .act.off')) === 0 &&
      (await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.dataset.f === 'use',
      )),
  );
  fact(
    'wish-7 switching keeps bar, Accounts and posting faces together',
    await page.evaluate(() => {
      const faces = ['.acct', '.arow.on', '.view[data-kind="compose"] .cwho'].map(
        (s) => document.querySelector<HTMLElement>(`${s} [data-face]`)?.dataset.face,
      );
      return !!faces[0] && faces.every((face) => face === faces[0]);
    }),
  );
  // Removing: a key asks first, a public key goes at once and can be taken back.
  await page.locator(`${av} .arow.on [data-f="remove"]`).click();
  fact(
    'removing an account with a key asks first',
    (await count(page, `${av} .aask`)) === 1 && (await count(page, `${av} .arow`)) === 2,
  );
  await page.locator(`${av} [data-f="cancel"]`).click();
  await page.locator(`${av} .arow:not(.on) [data-f="remove"]`).click();
  await page.waitForFunction(() => document.querySelectorAll('.arow').length === 1);
  await page.locator('.toast.undo', { hasText: 'Removed' }).locator('button').click();
  await page.waitForFunction(() => document.querySelectorAll('.arow').length === 2);
  fact('a read-only account comes back with Undo', true);
  await page.locator(`${av} .arow:has(.badge) [data-f="use"]`).click();
  await page.locator('.acct .ro').waitFor();
  for (const _ of [1, 2]) {
    const n = await count(page, '.arow');
    const row = page.locator(`${av} .arow`).first();
    await row.locator('.ahead [data-f="remove"]').click();
    if (await row.locator('.aask').count()) await row.locator('.aask [data-f="remove"]').click();
    await page.waitForFunction((was) => document.querySelectorAll('.arow').length < was, n);
  }
  await page.locator('.acct.out').waitFor();
  fact(
    'signed out again: the visitor’s layout, nothing remembered',
    (await count(page, '.pane')) === 1 &&
      (await count(page, '.tab[data-view^="account"]')) === 0 &&
      (await page.evaluate(() => localStorage.getItem('lkjstr:account'))) === null &&
      (await page.evaluate(() => localStorage.getItem('lkjstr:account:face'))) === null,
  );
  await page.context().close();

  // Signed in from the first frame of a reload: no "Sign in" flashes before the engine has spoken.
  const back = await open(browser, '/', { mock: { live: false } });
  await back.locator('.acct .av img').waitFor();
  await back.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('.acct.out')) document.documentElement.dataset.flashed = '1';
    }).observe(document, { childList: true, subtree: true });
  });
  await back.reload();
  await back.locator('.view[data-kind="home"] .note').first().waitFor();
  fact(
    'a reload starts as the reader: their face and layout from the first frame',
    (await back.evaluate(() => document.documentElement.dataset.flashed)) === undefined,
  );
  // A person whose metadata has not arrived: short npub in the header and on the tab, no count that is not known.
  await back.keyboard.press('Alt+Shift+N');
  await back.keyboard.type(`npub1${'x'.repeat(58)}`);
  await back.keyboard.press('Enter');
  await back.locator('.profile.pending').waitFor();
  const pending = await back.evaluate(() => ({
    name: document.querySelector('.pname')?.textContent ?? '',
    tab: document.querySelector('.tab.active[data-view^="profile"] > span')?.textContent ?? '',
    stats: document.querySelector('.pstats')?.textContent ?? '',
    wide: (document.querySelector('.npub')?.getBoundingClientRect().height ?? 99) < 24,
  }));
  fact(
    'a profile without metadata: short npub, one line, labels without numbers',
    /^npub1.{5}…/.test(pending.name) &&
      pending.tab === pending.name &&
      !/\d/.test(pending.stats) &&
      pending.wide,
    pending,
  );
  await back.context().close();
}

/** The Stats tab and the channels. */
async function rooms(browser: Browser, still: Record<string, unknown>): Promise<void> {
  const page = await open(browser, '/', still);
  const launch = async (word: string, kind: string): Promise<void> => {
    await page.keyboard.press('Alt+Shift+N');
    await page.keyboard.type(word);
    await page.locator('.ncard > b').getByText(word, { exact: true }).click();
    await page.waitForSelector(`.view[data-kind="${kind}"] > *`);
  };
  await launch('Stats', 'stats');
  const sv = '.view[data-kind="stats"]';
  await page.locator(`${sv} .relay-stats tbody .stats-toggle`).first().waitFor();
  const figures = await page.locator(`${sv} .sval`).allInnerTexts();
  const hosts = (): Promise<string[]> =>
    page.locator(`${sv} .relay-stats .rhost`).allTextContents();
  fact(
    'stats: five figures, and the relays in trouble first, each with its mark',
    figures.length === 5 &&
      /^\d+\/\d+$/.test(figures[0] ?? '') &&
      /^\d+%$/.test(figures[2] ?? '') &&
      (await hosts())[0] === 'down.example.net' &&
      (await page.locator(`${sv} tr.m-failing .smark`).first().innerText()) === 'failing' &&
      (await page.locator(`${sv} tr.m-slow .rhost`).textContent()) === 'slow.example.org',
    [figures, await hosts()],
  );
  const firstRow = await page
    .locator(`${sv} .relay-stats tbody .stats-toggle`)
    .first()
    .elementHandle();
  await page.locator(`${sv} th.c-latency button`).click();
  fact(
    'stats: a column sorts by what it holds, a missing figure last',
    (await hosts())[0] === 'slow.example.org' &&
      (await page.locator(`${sv} th.c-latency`).getAttribute('aria-sort')) === 'descending' &&
      (await page
        .locator(`${sv} .relay-stats tbody .stats-toggle`)
        .last()
        .locator('.c-latency')
        .innerText()) === '—',
    await hosts(),
  );
  await page.waitForTimeout(2300);
  fact(
    'stats: a new answer keeps the rows it already drew',
    await page.evaluate(
      (tr) =>
        tr?.isConnected === true &&
        tr.parentElement?.querySelectorAll(':scope > .stats-toggle').length === 9,
      firstRow,
    ),
  );

  await launch('Channels', 'channels');
  const cv = '.view[data-kind="channels"]';
  const names = (): Promise<string[]> => page.locator(`${cv} .chan .name`).allInnerTexts();
  await page.locator(`${cv} .chan`).first().waitFor();
  fact(
    'channels: the joined ones first with what is unread, then the others, each offering to be joined',
    (await names()).slice(0, 3).join() === 'Nostr 日本語,lkjstr,写真部' &&
      (await page.locator(`${cv} .chan.unread .cnew`).allInnerTexts()).join() === '4,2' &&
      (await count(page, `${cv} .list > .day`)) === 1 &&
      (await count(page, `${cv} .chan [data-f="join"]`)) === 4,
    await names(),
  );
  await page.locator(`${cv} input[type="search"]`).fill('relay');
  await page.waitForFunction(() => document.querySelectorAll('.chan').length === 1);
  fact('channels: the field narrows the list by name', (await names())[0] === 'Relay operators');
  await page.locator(`${cv} input[type="search"]`).fill('');
  await page.waitForFunction(() => document.querySelectorAll('.chan').length === 7);
  await page.locator(`${cv} .chan`).first().click();
  const ch = '.view[data-kind="channel"]:visible';
  await page.locator(`${ch} .note`).first().waitFor();
  fact(
    'a channel: its head, its messages newest first, the tab named after it',
    (await page.locator(`${ch} .chead .pname`).innerText()) === 'Nostr 日本語' &&
      (await page.locator('.pane.cur .tab.active > span').innerText()) === 'Nostr 日本語' &&
      (await page.locator(`${ch} .note .text`).first().innerText()).startsWith('リレーを一つ') &&
      (await count(page, `${ch} .ctx.chan:visible`)) === 0,
  );
  await page.locator(`${ch} .csay .ctext`).fill('smoke says hello');
  await page.keyboard.press('Control+Enter');
  await page.waitForFunction(
    (sel) => document.querySelector(`${sel} .note .text`)?.textContent === 'smoke says hello',
    '.view[data-kind="channel"]',
  );
  fact(
    'a channel: what is typed under its head is said there, and the field is ready again',
    (await page.locator(`${ch} .csay .ctext`).inputValue()) === '' &&
      (await page.locator(`${ch} .chead .pname`).innerText()) === 'Nostr 日本語',
  );
  await page.locator('.pane.cur .tab[data-view="channels"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.chan.unread').length === 1);
  fact(
    'channels: a channel that was read has nothing unread, and says what was said last',
    (await page.locator(`${cv} .chan`).first().locator('.muted').innerText()).endsWith(
      'smoke says hello',
    ),
  );
  await page
    .locator(`${cv} .chan`, { hasText: 'Relay operators' })
    .locator('[data-f="join"]')
    .click();
  await page.waitForFunction(() => document.querySelectorAll('.chan [data-f="join"]').length === 3);
  fact(
    'channels: a joined channel moves up among the joined',
    (await names())[3] === 'Relay operators',
  );
  await page.locator(`${cv} [data-f="create"]`).click();
  await page.locator(`${cv} .cform [data-f="name"]`).fill('smoke room');
  await page.keyboard.press('Enter');
  await page.locator(`${ch} .chead [data-f="edit"]`).waitFor();
  fact(
    'channels: a created channel opens, joined and editable by its creator',
    (await page.locator(`${ch} .chead .pname`).innerText()) === 'smoke room' &&
      (await page.locator(`${ch} .chead [data-f="join"]`).getAttribute('aria-pressed')) === 'true',
  );
  await page.locator(`${ch} .chead [data-f="edit"]`).click();
  await page.locator(`${ch} .cform [data-f="name"]`).fill('smoke room two');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.view[data-kind="channel"] .chead .pname')].some(
      (e) => e.textContent === 'smoke room two',
    ),
  );
  fact(
    'channels: its creator renames it, and the tab follows',
    (await page.locator('.pane.cur .tab.active > span').innerText()) === 'smoke room two',
  );
}

if (!existsSync(`${here}../dist/index.html`)) throw new Error('build first: pnpm build');
const server: ChildProcess = spawn(
  process.execPath,
  [`${here}scripts/serve.ts`, '--port=0', '--test-relay=ws://127.0.0.1:1'],
  {
    stdio: 'pipe',
  },
);
base = await new Promise<string>((done, fail) => {
  const timer = setTimeout(() => fail(new Error('local server startup timeout')), 10_000);
  server.once('exit', (code) => {
    clearTimeout(timer);
    fail(new Error(`server exited ${code}`));
  });
  server.stdout?.once('data', (data) => {
    clearTimeout(timer);
    done(String(data).trim());
  });
});
let browser: Browser | undefined;
try {
  const launched = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
  browser = launched;
  await hiddenChecks(
    (path, given, size, touch) => open(launched, path, given, size, 'en-US', touch),
    fact,
  );
  if (!process.argv.includes('--only=hidden')) {
    await wishes({ browser, base, check: fact });
    await run(browser);
    const auditModule = './audit-owner.mjs';
    const { auditOwner } = await import(auditModule);
    await auditOwner({ browser, base, check: fact });
    for (const ref of ['af8c915e', 'dbd66e59']) {
      if (existsSync(`../tmp/history/${ref}/state-1440.json`))
        await auditOwner({ browser, base, check: fact, returning: ref });
    }
  }
} catch (e) {
  const at = /smoke\.ts:(\d+)/.exec((e as Error).stack ?? '')?.[1] ?? '?';
  failures.push(`threw at line ${at}: ${(e as Error).message.split('\n')[0]}`);
} finally {
  await browser?.close();
  server.kill();
}
writeFileSync(
  resolve(here, '../tmp/audit-smoke-count.json'),
  JSON.stringify({ checks: facts, failures: failures.length }),
);
writeFileSync(
  resolve(here, '../tmp/smoke-mock-report.json'),
  JSON.stringify({ checks: facts, failures: failures.length }),
);
if (failures.length) console.log(failures.join('\n')), process.exit(1);
console.log('ok smoke');
