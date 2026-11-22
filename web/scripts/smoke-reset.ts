// Resetting a workspace (Settings) and its Undo never lose a draft: a tab opened or reopened after the reset, more tabs than the closed
// list holds one by one, the same workspace in a second browser tab, and "Reset every layout" with a draft waiting in
// a workspace that is not on screen. Each sequence is a reviewed repro of draft loss (2026-11-20).
import type { BrowserContext, Page } from 'playwright-core';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (given: Record<string, unknown>) => Promise<Page>;

const tile = (id: string, tabs: string[], active = tabs[0]): unknown => ({
  type: 'pane',
  id,
  tabs,
  active,
});
/** A saved arrangement that the default lacks two tabs of: a second Post tab holding `draft`, and Bookmarks. */
const extraPost = (draft: string): Record<string, unknown> => ({
  'layout:main': {
    type: 'split',
    id: 'r',
    dir: 'row',
    sizes: [0.5, 0.5],
    children: [tile('a', ['home', 'compose~2'], 'compose~2'), tile('b', ['global', 'bookmarks'])],
  },
  'view:main1:compose~2': { text: draft },
});
const stored = (page: Page, key: string): Promise<unknown> =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(`lkjstr:${k}`) ?? 'null'), key);
const closedTexts = async (page: Page, space = 'main1'): Promise<string[]> =>
  (((await stored(page, `closed:${space}`)) ?? []) as { state: { text?: string } }[]).map(
    (c) => c.state.text ?? '',
  );
const textOf = async (page: Page, view: string): Promise<string | undefined> =>
  ((await stored(page, `view:main1:${view}`)) as { text?: string } | null)?.text;
const draftField = (page: Page, view: string) =>
  page.locator(`.pane:has(.tab.active[data-view="${view}"]) textarea`);
/** Settings: "Reset this workspace" (Settings opens first where it is not in the layout). */
const menuReset = async (page: Page): Promise<void> => {
  await page.locator('.bar [data-tab-search]').click();
  await page.locator('.tsearch input').fill('Settings');
  await page.locator('.tsearch input').press('Enter');
  await page
    .locator('.view[data-kind="settings"]:visible')
    .getByRole('button', { name: 'Reset this workspace', exact: true })
    .click();
  await page.waitForSelector('.tab[data-view="notifications"]');
};
const newPost = async (page: Page): Promise<void> => {
  await page.keyboard.press('Alt+Shift+N');
  await page.keyboard.type('Post');
  await page.keyboard.press('Enter');
};
const undoShown = async (page: Page): Promise<number> => page.locator('.toast.undo').count();
/** The repro presses Undo here; once the offer has ended there is nothing to press. */
const pressUndo = async (page: Page): Promise<void> => {
  const undo = page.locator('.toast.undo .lnk');
  if (await undo.count()) await undo.first().click();
};
const settle = (page: Page): Promise<void> => page.waitForTimeout(600); // the layout is written 400ms after a change
/** The default is drawn: its middle tile opens on Documentation, which has no notes to wait for. */
const DRAWN = '.view[data-kind="docs"] .dpage > p';

export async function resetChecks(open: Open, check: Check): Promise<void> {
  // 1. A Post tab opened after the reset takes the free id compose~2; Undo must not bring the old one over it.
  {
    const page = await open(extraPost('old draft'));
    await menuReset(page);
    await newPost(page);
    await draftField(page, 'compose~2').fill('new draft');
    check('a tab opened after a reset ends its Undo', (await undoShown(page)) === 0);
    await pressUndo(page);
    await settle(page);
    await page.reload();
    await page.waitForSelector(DRAWN);
    check(
      'the new Post keeps its draft, the old one waits in the closed tabs',
      (await draftField(page, 'compose~2').inputValue()) === 'new draft' &&
        (await closedTexts(page)).includes('old draft'),
      [await textOf(page, 'compose~2'), await closedTexts(page)],
    );
    await page.context().close();
  }
  // 2. The Post tab the reset put away, reopened and edited: the edit stays, in the field and in storage.
  {
    const page = await open(extraPost('first words'));
    await menuReset(page);
    // Bookmarks and Global (which the default no longer has) come back before it.
    for (let i = 0; i < 3 && !(await page.locator('.tab[data-view="compose~2"]').count()); i++)
      await page.keyboard.press('Alt+Shift+T');
    await page.waitForSelector('.tab.active[data-view="compose~2"]');
    await draftField(page, 'compose~2').fill('first words, edited');
    check('reopening a tab the reset put away ends its Undo', (await undoShown(page)) === 0);
    await pressUndo(page);
    await settle(page);
    await page.reload();
    await page.waitForSelector(DRAWN);
    check(
      'the reopened draft keeps its edit through a reload',
      (await draftField(page, 'compose~2').inputValue()) === 'first words, edited',
      await textOf(page, 'compose~2'),
    );
    await page.context().close();
  }
  // 3. More tabs than the closed list keeps one by one, and closed tabs from before: Undo gives every draft back.
  {
    const extra = Array.from({ length: 21 }, (_, i) => `compose~${i + 2}`);
    const before = Array.from({ length: 20 }, (_, i) => ({
      kind: 'thread',
      state: { text: `closed ${i}` },
      pane: 'a',
      index: 0,
    }));
    const page = await open({
      'layout:main': {
        type: 'split',
        id: 'r',
        dir: 'row',
        sizes: [0.5, 0.5],
        children: [tile('a', ['home']), tile('b', extra)],
      },
      ...Object.fromEntries(extra.map((v) => [`view:main1:${v}`, { text: `draft ${v}` }])),
      'closed:main1': before,
    });
    await menuReset(page);
    const put = await closedTexts(page);
    check(
      'a reset keeps every tab it put away and every tab closed before',
      put.length === 41 && put.includes('closed 0') && put.includes('draft compose~2'),
      put.length,
    );
    await page.locator('.toast.undo .lnk').click();
    await page.waitForSelector('.tab[data-view="compose~22"]');
    const texts = await Promise.all(extra.map((v) => textOf(page, v)));
    check(
      'Undo gives all 21 drafts back',
      texts.every((x, i) => x === `draft ${extra[i]}`) &&
        (await draftField(page, 'compose~2').inputValue()) === 'draft compose~2',
      texts,
    );
    check(
      'and leaves the closed tabs as they were',
      (await closedTexts(page)).join() === before.map((c) => c.state.text).join(),
    );
    await page.context().close();
  }
  // 4. The same workspace in two browser tabs: B adopts A's reset, then closes Settings; A's put-away draft stays.
  {
    const a = await open(extraPost('from tab A'));
    const ctx: BrowserContext = a.context();
    const b = await ctx.newPage();
    await b.goto(a.url());
    await b.waitForSelector('.note');
    await a.bringToFront(); // a page behind has its timers slowed: act on the one in front
    await menuReset(a);
    await settle(a);
    await b.bringToFront();
    await b.waitForSelector('.tab[data-view="notifications"]');
    await b.locator('.tab[data-view="settings"]').click({ button: 'middle' });
    await b.waitForSelector('.tab[data-view="settings"]', { state: 'detached' });
    await settle(b);
    const both = await closedTexts(b);
    check(
      'a second browser tab closing a tab keeps what the reset put away',
      both.includes('from tab A') &&
        ((await stored(b, 'closed:main1')) as { kind: string }[]).some(
          (c) => c.kind === 'settings',
        ),
      both,
    );
    await a.bringToFront();
    await a.waitForSelector('.tab[data-view="settings"]', { state: 'detached' });
    check('a change in the other browser tab ends the Undo', (await undoShown(a)) === 0);
    await ctx.close();
  }
  // 5. "Reset every layout" with a Post draft waiting in workspace 2: it waits in workspace 2's closed tabs.
  {
    const page = await open({});
    await page.keyboard.press('Alt+Shift+2');
    await page.waitForSelector('.tab[data-view="bookmarks"]');
    await newPost(page);
    await draftField(page, 'compose').fill('in workspace 2');
    await page.keyboard.press('Alt+Shift+1');
    await page.waitForSelector('.tab[data-view="home"]');
    await page.locator('.bar [data-tab-search]').click();
    await page.locator('.tsearch input').fill('Settings');
    await page.locator('.tsearch input').press('Enter');
    const set = page.locator('.view[data-kind="settings"]:visible');
    await set.getByRole('button', { name: 'Reset every layout', exact: true }).click();
    await page.waitForSelector('.tab[data-view="notifications"]');
    check(
      'every layout: the draft of workspace 2 waits in its closed tabs',
      (await closedTexts(page, 'main2')).includes('in workspace 2'),
      await closedTexts(page, 'main2'),
    );
    await page.keyboard.press('Alt+Shift+2');
    await page.waitForSelector('.tab[data-view="bookmarks"]');
    await page.keyboard.press('Alt+Shift+T');
    await page.waitForSelector('.tab.active[data-view="compose"]');
    check(
      'and comes back there with Reopen',
      (await draftField(page, 'compose').inputValue()) === 'in workspace 2',
    );
    await page.context().close();
  }
}
