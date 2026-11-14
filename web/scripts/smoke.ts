// Browser smoke: the interactions the owner complained about, driven with a real pointer and keyboard against
// the mock build in ../dist. Prints one line per failed fact, then "ok smoke" (or exits 1).
// LKJSTR_CHROME=<path> picks the browser; --shot=<file> also writes one screenshot of the first page.
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright-core';

const here = new URL('..', import.meta.url).pathname;
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
}

if (!existsSync(`${here}../dist/index.html`)) throw new Error('build first: pnpm build');
const server: ChildProcess = spawn(
  process.execPath,
  [`${here}scripts/serve.ts`, `--port=${port}`],
  { stdio: 'pipe' },
);
await new Promise((r) => server.stdout?.once('data', r));
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
try {
  await run(browser);
} catch (e) {
  failures.push(`threw: ${(e as Error).message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) console.log(failures.join('\n')), process.exit(1);
console.log('ok smoke');
