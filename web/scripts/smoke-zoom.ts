// Maximize and collapse (docs/design.md, the frame): the two icons between "…" and "+", which keep their place in
// every state, what each state draws, that both are saved through a reload, that Escape and the keys leave and move
// a maximized tile, that a collapsed tile keeps its tab's state, opens on a press or a dropped tab and maximizes at
// once, and that a lone tile offers neither.
import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  given: Record<string, unknown>,
  size?: { width: number; height: number },
) => Promise<Page>;

const pane = (id: string, tabs: string[]) => ({ type: 'pane', id, tabs, active: tabs[0] });
/** Home | Notifications | Post over Accounts. */
const FIXTURE = {
  type: 'split',
  id: 'r',
  dir: 'row',
  sizes: [0.4, 0.3, 0.3],
  children: [
    pane('a', ['home', 'global']),
    pane('b', ['notifications']),
    {
      type: 'split',
      id: 'c',
      dir: 'col',
      sizes: [0.5, 0.5],
      children: [pane('d', ['compose']), pane('e', ['account', 'settings'])],
    },
  ],
};

type Box = { x: number; y: number; width: number; height: number };
const boxes = (page: Page): Promise<Record<string, Box>> =>
  page.locator('.pane').evaluateAll((els) =>
    Object.fromEntries(
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [el.getAttribute('data-pane'), { x: r.x, y: r.y, width: r.width, height: r.height }];
      }),
    ),
  );
const near = (a?: Box, b?: Box): boolean =>
  !!a &&
  !!b &&
  ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k as 'x'] - b[k as 'x']) <= 1);
const settle = (page: Page): Promise<void> => page.waitForTimeout(600); // a layout is written 400ms after a change
/** A tile bar's buttons: each title and its place from the bar's left edge. */
const buttons = (page: Page, id: string): Promise<[string, number][]> =>
  page.locator(`.pane[data-pane="${id}"] > .strip > button`).evaluateAll((els) => {
    const left = els[0]?.parentElement?.getBoundingClientRect().left ?? 0;
    return els.map((e) => [
      e.getAttribute('title') ?? '',
      Math.round(e.getBoundingClientRect().left - left),
    ]);
  });

export async function zoomChecks(open: Open, check: Check): Promise<void> {
  const page = await open({ 'layout:main': FIXTURE });
  const bar = (id: string) => page.locator(`.pane[data-pane="${id}"] > .strip`);
  const titles = await bar('a')
    .locator(':scope > button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''));
  check(
    'a tile bar: the menu, maximize, collapse, then a new tab',
    titles.length === 4 &&
      titles[0] === 'Tile menu' &&
      titles[1]?.startsWith('Maximize tile') === true &&
      titles[2] === 'Collapse tile' &&
      titles[3] === 'New tab',
    titles,
  );
  const open4 = await buttons(page, 'a');
  await bar('a').getByTitle('Tile menu', { exact: true }).click();
  const items = await page.locator('.menu button').allInnerTexts();
  check('the tile menu offers no reset', !items.some((x) => /reset/i.test(x)), items);
  await page.keyboard.press('Escape');

  const composer = page.locator('.view[data-kind="compose"] textarea');
  await composer.fill('kept while hidden');
  const wm = await page.locator('.wm').boundingBox();
  const before = await boxes(page);
  await bar('a')
    .getByTitle(/^Maximize tile/)
    .click();
  const max = await boxes(page);
  check(
    'maximized, Home fills the workspace alone',
    Object.keys(max).join() === 'a' && near(max.a, wm ?? undefined),
    [max, wm],
  );
  const unfill = bar('a').locator('.zoom.on');
  check(
    'maximized, the same four buttons stand where they stood; maximize, indigo, shows all tiles again',
    (await unfill.count()) === 1 &&
      (await unfill.getAttribute('title')) === 'Show all tiles (Esc)' &&
      JSON.stringify((await buttons(page, 'a')).map(([, x]) => x)) ===
        JSON.stringify(open4.map(([, x]) => x)) &&
      (await buttons(page, 'a'))[2]?.[0] === 'Collapse tile',
    [open4, await buttons(page, 'a')],
  );
  await settle(page);
  await page.reload();
  await page.waitForSelector('.note');
  check('a maximized tile stays so through a reload', (await page.locator('.pane').count()) === 1);
  await page.keyboard.press('Escape');
  const back = await boxes(page);
  check(
    'Escape shows every tile where it was, and the hidden draft is kept',
    ['a', 'b', 'd', 'e'].every((id) => near(back[id], before[id])) &&
      (await composer.inputValue()) === 'kept while hidden',
    [before, back],
  );
  await page.locator('.tab[data-view="notifications"]').click();
  await page.keyboard.press('Alt+Shift+F');
  check('Alt+Shift+F maximizes the current tile', Object.keys(await boxes(page)).join() === 'b');
  await page.keyboard.press('Alt+Shift+ArrowDown');
  check(
    'the next tile, by keys, is maximized instead',
    Object.keys(await boxes(page)).join() === 'd',
  );
  await page.keyboard.press('Alt+Shift+F');
  check('Alt+Shift+F again shows every tile', (await page.locator('.pane').count()) === 4);

  // Collapse: Notifications in the row stands upright; Post in the column becomes its bar.
  await bar('b').getByTitle('Collapse tile', { exact: true }).click();
  await bar('d').getByTitle('Collapse tile', { exact: true }).click();
  const folded = await boxes(page);
  const upright = page.locator('.pane[data-pane="b"].min.upright .tab[data-view="notifications"]');
  check(
    'collapsed in a row: a narrow upright strip that still shows its tab, its room given to Home',
    (folded.b?.width ?? 99) <= 40 &&
      (await upright.isVisible()) &&
      (folded.a?.width ?? 0) > (before.a?.width ?? 0) + 200,
    folded,
  );
  check(
    'collapsed in a column: its bar alone, Accounts taking its height',
    (folded.d?.height ?? 99) <= 40 &&
      (folded.e?.height ?? 0) > (before.e?.height ?? 0) + 300 &&
      (await page.locator('.view[data-kind="compose"]').isVisible()) === false,
    folded,
  );
  check(
    'the last open tile of a split cannot collapse',
    await bar('e').getByTitle('Collapse tile', { exact: true }).isDisabled(),
  );
  await settle(page);
  await page.reload();
  await page.waitForSelector('.note');
  check(
    'collapsed tiles stay so through a reload',
    (await page.locator('.pane.min').count()) === 2,
  );
  await page.locator('.pane[data-pane="d"] .tab[data-view="compose"]').click();
  check(
    'a press on a collapsed tab opens its tile with what it held',
    (await page.locator('.pane[data-pane="d"].min').count()) === 0 &&
      (await composer.inputValue()) === 'kept while hidden',
  );
  // A tab dropped onto the upright strip goes in and opens it.
  const from = await page.locator('.tab[data-view="global"]').boundingBox();
  const into = await page.locator('.pane[data-pane="b"]').boundingBox();
  await page.mouse.move((from?.x ?? 0) + 20, (from?.y ?? 0) + 10);
  await page.mouse.down();
  await page.mouse.move((from?.x ?? 0) + 40, (from?.y ?? 0) + 60, { steps: 4 });
  await page.mouse.move((into?.x ?? 0) + 12, (into?.y ?? 0) + 300, { steps: 8 });
  await page.mouse.up();
  check(
    'a tab dropped onto a collapsed tile opens it',
    (await page.locator('.pane[data-pane="b"]:not(.min) .tab[data-view="global"]').count()) === 1,
    await boxes(page),
  );
  // Collapsed, the bar keeps the four buttons where they were, and maximize acts from there at once.
  const openD = await buttons(page, 'd');
  await bar('d').getByTitle('Collapse tile', { exact: true }).click();
  const foldD = await buttons(page, 'd');
  check(
    'collapsed, the same four buttons stand where they stood, collapse indigo',
    JSON.stringify(foldD.map(([, x]) => x)) === JSON.stringify(openD.map(([, x]) => x)) &&
      foldD.map(([title]) => title).join('|') ===
        'Tile menu|Maximize tile (Alt+Shift+F)|Expand tile|New tab' &&
      (await bar('d').locator('.zoom.on').getAttribute('title')) === 'Expand tile',
    [openD, foldD],
  );
  await bar('d')
    .getByTitle(/^Maximize tile/)
    .click();
  check(
    'a collapsed tile maximizes at once, with what it held',
    Object.keys(await boxes(page)).join() === 'd' &&
      (await composer.inputValue()) === 'kept while hidden',
    await boxes(page),
  );
  await page.keyboard.press('Escape');
  await page.context().close();

  const phone = await open({}, { width: 390, height: 844 });
  check(
    'a lone tile offers neither maximize nor collapse',
    (await phone.locator('.pane').count()) === 1 && (await phone.locator('.zoom').count()) === 0,
  );
  await phone.context().close();
}
