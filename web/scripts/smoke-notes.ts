// Reader-state regressions shared by mock and real Worker smoke runs.
import type { Page } from 'playwright-core';
import { prepareAudioCheck } from './smoke-audio.ts';
import { prepareViewChecks } from './smoke-view-state.ts';

type Check = (name: string, ok: boolean) => void;
export async function notesChecks(
  page: Page,
  check: Check,
  id?: string,
  waitMs = 61_000,
): Promise<void> {
  const view = '.view[data-kind="global"]:visible';
  let row = id
    ? page.locator(`${view} [data-key="${id}"]`).first()
    : page.locator(`${view} .note:has(.cw)`).first();
  await row.waitFor();
  const noteId = (await row.getAttribute('data-note')) ?? (await row.getAttribute('data-key'));
  if (!noteId) throw new Error('reader fixture id');
  row = page.locator(`${view} .list > [data-key="${noteId}"]`).first();
  if (await row.locator(':scope > .lnk').count()) await row.locator(':scope > .lnk').click();
  await row.locator('.cw').first().click();
  // The real fixture is long; the mock warning fixture may have a short body.
  const showMore = row.locator('.fold[aria-expanded="false"]');
  if (await showMore.count()) await showMore.click();
  if (id) {
    await row.locator('.link-card:not(.loading)').waitFor();
    check(
      'preview: real Worker replaces the reserved card with service metadata',
      (await row.locator('.lctitle').innerText()).includes('local fixture'),
    );
    check(
      'reader: preview patch keeps the long text unfolded',
      (await row.locator('.text.open').count()) === 1,
    );
  }
  const previewRequests = id
    ? (await (await page.request.get(new URL('/__test_preview_counts', page.url()).href)).json())
        .previewRequests
    : 0;
  const audio = await prepareAudioCheck(page, view, check);
  const original = await row.locator('.content').innerText();
  const change = async (patch: Record<string, unknown>): Promise<void> => {
    await page.evaluate((p) => {
      const key = 'lkjstr:settings';
      const value = JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), ...p });
      localStorage.setItem(key, value);
      dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
    }, patch);
    await page.waitForTimeout(150);
  };
  await change({ theme: 'dark', textSize: 16 });
  await audio.redrawn();
  row = page.locator(`${view} [data-note="${noteId}"]`).first();
  check(
    'reader: warning stays open through settings redraw',
    (await row.locator('.content').innerText()) === original,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await change({ language: 'ja' });
  row = page.locator(`${view} [data-note="${noteId}"]`).first();
  check(
    'reader: resize and language remount preserve the reveal',
    (await row.locator('.content').count()) === 1,
  );
  await change({ language: 'en', textSize: 15 });
  const verifyViews = await prepareViewChecks(page, check);
  // A minute of real timers, with relay/mock updates supplied by the caller.
  await page.waitForTimeout(waitMs);
  check(
    'reader: live updates never cover a revealed note',
    (await row.locator('.content').count()) === 1,
  );
  if (id)
    check(
      'preview: redraws and live updates fetch each link once',
      (await (await page.request.get(new URL('/__test_preview_counts', page.url()).href)).json())
        .previewRequests === previewRequests,
    );
  await page.reload();
  row = page.locator(`${view} [data-note="${noteId}"]`).first();
  await row.locator('.content').waitFor();
  check(
    'reader: reload preserves the reveal and unfolded text',
    (await row.locator('.content.folded').count()) === 0 &&
      (!id || (await row.locator('.fold[aria-expanded="true"]').count()) === 1),
  );
  // Closing/reopening saves the entire tab state, including reader state.
  await page.locator(view).evaluate((el) => (el as HTMLElement).focus());
  await page.keyboard.press('Alt+Shift+W');
  // The last tab may have become a New tab page, whose field owns typing keys.
  await page
    .locator('input:focus')
    .evaluateAll((fields) => fields.forEach((f) => (f as HTMLInputElement).blur()));
  await page.keyboard.press('Alt+Shift+T');
  await page.locator(`${view} [data-note="${noteId}"] .content`).waitFor();
  check('reader: closed-tab recovery preserves note choices', true);
  await verifyViews();
  await audio.restored();
  await periodChecks(page, check);
  await tabSearchChecks(page, check);
}

export async function periodChecks(page: Page, check: Check): Promise<void> {
  const view = '.view[data-kind="global"]:visible';
  const toggle = page.locator(`${view} .rtoggle`).first();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const start = page.locator(`${view} input[placeholder="yyyy/mm/dd"]`).first();
  await start.fill('11月15日');
  check('date: focused text stays as typed', (await start.inputValue()) === '11月15日');
  await start.press('Tab');
  const year = await page.evaluate(() => new Date().getFullYear());
  check(
    'date: Japanese month/day is normalized after blur',
    (await start.inputValue()) === `${year}/11/15`,
  );
  await start.fill('3d');
  await start.press('Enter');
  const expected = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  });
  check('date: relative days normalize on Enter', (await start.inputValue()) === expected);
  const before = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('lkjstr:view:'))
      .map((k) => JSON.parse(localStorage.getItem(k) ?? '{}').filter?.start)
      .filter(Boolean)
      .join(),
  );
  await start.fill('abc');
  await start.press('Tab');
  check(
    'date: unreadable text and hint remain',
    (await start.inputValue()) === 'abc' &&
      (await page.locator(`${view} .date-hint:visible`).count()) === 1,
  );
  const after = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('lkjstr:view:'))
      .map((k) => JSON.parse(localStorage.getItem(k) ?? '{}').filter?.start)
      .filter(Boolean)
      .join(),
  );
  check('date: unreadable text keeps the last good filter', before === after);
}

export async function tabSearchChecks(page: Page, check: Check): Promise<void> {
  await page.evaluate(() => {
    const family = document.querySelector('.acct.out') ? 'guest' : 'main';
    localStorage.setItem(
      `lkjstr:layout:${family}:7`,
      JSON.stringify({ type: 'pane', id: 'remote', tabs: ['docs'], active: 'docs' }),
    );
    localStorage.setItem(
      `lkjstr:view:${family}7:docs`,
      JSON.stringify({ title: 'Other workspace manual', page: 'privacy' }),
    );
  });
  // Reload reads the second workspace into the WM store, as on the next start.
  await page.reload();
  const button = page.locator('.bar [data-tab-search]');
  await button.click();
  check(
    'tabs: button focuses search',
    await page.locator('.tsearch input').evaluate((e) => e === document.activeElement),
  );
  await page.locator('.tsearch input').fill('Other workspace manual');
  check(
    'tabs: another workspace carries its number',
    (await page.locator('.tworkspace').innerText()) === '7',
  );
  await page.locator('.tsearch input').press('Enter');
  await page.locator('.view[data-kind="docs"] .dpage').waitFor();
  check(
    'tabs: Enter switches workspace and fronts its tab',
    (await page.locator('lkjstr-spaces button.on').innerText()) === '7',
  );
  await button.click();
  await button.click();
  check('tabs: a second press closes search', (await page.locator('.tsearch').count()) === 0);
  await button.click();
  await page.keyboard.press('Escape');
  check('tabs: Escape closes search', (await page.locator('.tsearch').count()) === 0);
  const fits = await page.locator('.bar').evaluate((bar) => {
    const r = bar.getBoundingClientRect();
    return [...bar.querySelectorAll<HTMLElement>('button')]
      .filter((e) => e.getBoundingClientRect().width)
      .every((e) => {
        const b = e.getBoundingClientRect();
        return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom;
      });
  });
  check('tabs: 390px top bar fits all nine chips and controls', fits);
}
