// The thread tab (docs/interface-thread.md), by keyboard and pointer, from the mock's thread fixtures: it opens on
// its focus, seated a third down, without taking the keyboard; j and k walk notes and folds and pass the reply field; Enter opens a fold or
// a compact note in place; R on the focus is the field, on another note that note's thread; a draft outlives another
// tab in front, a reload and a closed tab reopened; a sent reply joins its branch; a missing note above holds its
// room while it is looked for and after; a long thread fits a phone.
import type { Page } from 'playwright-core';
import { idOf } from '../src/engine/mock/world.ts';
import { seated, seatOf } from './thread-seat.ts';

type Check = (name: string, ok: boolean, detail?: unknown) => void;
type Open = (
  path: string,
  given: Record<string, unknown>,
  size?: { width: number; height: number },
) => Promise<Page>;

const at = (n: number): string => `/n/note1${idOf(n).slice(0, 58)}`;
const view = '.view[data-kind="thread"]:visible';
const given = (tabs: string[]): Record<string, unknown> => ({
  mock: { live: false, threads: true },
  'layout:main': { type: 'pane', id: 'a', tabs, active: tabs[0] },
});
const focusTop = (page: Page): Promise<number> =>
  page.locator(view).evaluate((v) => {
    const f = v.querySelector('.th-focus');
    return f ? Math.round(f.getBoundingClientRect().top - v.getBoundingClientRect().top) : -999;
  });
const selected = (page: Page): Promise<string> =>
  page.locator(view).evaluate((v) => {
    const s = v.querySelector('.list > .sel');
    return s ? `${s.tagName}.${[...s.classList].join('.')}` : '';
  });
const field = (page: Page) => page.locator(`${view} .tsay textarea`);
const inField = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.activeElement?.matches('.tsay textarea') === true);

export async function threadChecks(open: Open, fact: Check): Promise<void> {
  const page = await open(at(7004), given(['home']));
  await page.locator(`${view} .th-focus`).waitFor();
  await page.waitForTimeout(700);
  fact(
    'a thread opens on its focus, whole, a third down with what it answers in view',
    seated(await seatOf(page)),
    await seatOf(page),
  );
  fact(
    'every note above has the action row; a compact one keeps its fixed height',
    (await page.locator(`${view} .th-compact`).count()) ===
      (await page.locator(`${view} .th-compact > .nrow > .nmain > .acts`).count()),
  );
  fact('the reply field waits without taking the keyboard', !(await inField(page)));
  // The keyboard walks notes and folds; the reply field and placeholders are passed over.
  await page.locator(view).focus();
  await page.keyboard.press('j');
  fact('j starts on the focus', (await selected(page)).includes('th-focus'), await selected(page));
  await page.keyboard.press('j');
  fact(
    'j passes over the reply field to the first reply',
    (await selected(page)).includes('th-reply'),
  );
  await page.keyboard.press('k');
  await page.keyboard.press('k');
  fact('k goes up to the note answered', (await selected(page)).includes('th-compact'));
  await page.keyboard.press('k');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  fact(
    'Enter on the fold shows every note above',
    (await page.locator(`${view} .th-compact`).count()) === 4 &&
      (await page.locator(`${view} .tfold.th-above`).count()) === 0,
  );
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  fact(
    'Enter on a compact note opens it in place',
    (await page.locator(`${view} .th-ancestor:not(.th-compact) .acts`).count()) === 1 &&
      (await page.locator('.tab[data-view^="thread"]').count()) === 1,
  );
  // R on the focus is the reply field; what is typed there stays with the tab.
  await page.keyboard.press('Escape');
  for (let n = 0; n < 8 && !(await selected(page)).includes('th-focus'); n++)
    await page.keyboard.press('j');
  await page.keyboard.press('r');
  fact('R on the focus puts the keyboard in the reply field', await inField(page));
  const draft = 'Trying the bus stop by the bridge tomorrow.';
  await page.keyboard.type(draft);
  await page.locator('.tab[data-view="home"]').click();
  await page.locator('.tab[data-view^="thread"]').click();
  fact('the draft stays while another tab is in front', (await field(page).inputValue()) === draft);
  await page.waitForTimeout(400);
  await page.reload();
  await page.locator(`${view} .th-focus`).waitFor();
  fact('the draft comes back after a reload', (await field(page).inputValue()) === draft);
  await page.locator('.tab[data-view^="thread"]').click({ button: 'middle' });
  await page.waitForTimeout(300);
  await page.keyboard.press('Alt+Shift+T');
  await page.locator(`${view} .th-focus`).waitFor();
  fact('and with the closed tab reopened', (await field(page).inputValue()) === draft);
  // Sending empties the field, keeps the keyboard there, and the reply joins the thread under its focus.
  await field(page).focus();
  await page.keyboard.press('ControlOrMeta+Enter');
  await page.locator(`${view} .th-reply`, { hasText: draft }).waitFor();
  fact(
    'a sent reply empties the field, which keeps the keyboard, and appears in the thread',
    (await field(page).inputValue()) === '' && (await inField(page)),
  );
  // R on another note opens its thread, with the keyboard in that thread's field.
  await page.locator(`${view} .th-reply .acts > .a-reply`).first().click();
  for (let n = 0; n < 30 && !(await inField(page)); n++) await page.waitForTimeout(100);
  fact(
    'reply on another note opens its thread with the keyboard in its field',
    (await page.locator('.tab[data-view^="thread"]').count()) === 2 && (await inField(page)),
    await page.evaluate(() => ({
      active: `${document.activeElement?.tagName}.${document.activeElement?.className}`,
      tabs: [...document.querySelectorAll('.tab')].map((t) => t.getAttribute('data-view')),
      replies: [...document.querySelectorAll('.th-reply')]
        .slice(0, 3)
        .map((r) => `${r.className}|${r.querySelector('.text')?.textContent?.slice(0, 20)}`),
    })),
  );
  await page.context().close();

  // A note above that nobody has: its room is held while it is looked for and after, and nothing moves.
  const lost = await open(at(7101), given(['home']));
  await lost.locator(`${view} .th-focus`).waitFor();
  const slot = lost.locator(`${view} .tslot`);
  await slot.waitFor();
  const looking = await slot.boundingBox();
  const seat = await focusTop(lost);
  await lost.locator(`${view} .tslot.missing`).waitFor({ timeout: 9000 });
  const missing = await slot.boundingBox();
  fact(
    'a missing note above holds the same room, looked for and then not found, and the focus stays',
    looking?.height === missing?.height && seat > 0 && (await focusTop(lost)) === seat,
    { looking, missing, seat },
  );
  await lost.context().close();

  // The long thread on a phone: one tile, nothing wider than the screen, seated on its focus.
  const phone = await open(at(7004), given(['home']), { width: 390, height: 844 });
  await phone.locator(`${view} .th-focus`).waitFor();
  await phone.waitForTimeout(700);
  fact(
    'a long thread fits a phone, on its focus',
    seated(await seatOf(phone)) &&
      (await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) &&
      (await phone.locator(`${view} .tfold`).count()) >= 2,
  );
  await phone.context().close();
}
