import type { Page } from 'playwright-core';

type Check = (name: string, ok: boolean) => void;

/** Set choices through the UI, then verify them after the caller's live-minute and reload/remount. */
export async function prepareViewChecks(page: Page, check: Check): Promise<() => Promise<void>> {
  const go = async (word: string): Promise<void> => {
    await page.locator('.bar [data-tab-search]').click();
    await page.locator('.tsearch input').fill(word);
    await page.locator('.tsearch input').press('Enter');
  };
  const front = (kind: string) => page.locator(`.view[data-kind="${kind}"]:visible`);
  const global = front('global');
  await global.locator('.nhead .name').first().click();
  await front('profile').getByRole('tab', { name: 'Replies', exact: true }).click();
  const profileTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Global');
  const picture = global.locator('.media a.mbox:is([data-pending-image], :has(img))').first();
  const tabsHere = () =>
    page
      .locator('.pane.cur .tab')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-view') ?? ''));
  await picture.waitFor({ state: 'visible', timeout: 15_000 });
  await picture.scrollIntoViewIfNeeded();
  await picture.locator('img').waitFor({ state: 'visible', timeout: 15_000 });
  const source = (await page.locator('.pane.cur .tab.active').getAttribute('data-view')) ?? '';
  const before = await tabsHere();
  await picture.click();
  await front('media').locator('.mstage img').waitFor({ timeout: 15_000 });
  const after = await tabsHere();
  check(
    'view state: a picture opens as a new tab right after its own, in the same tile',
    after.length === before.length + 1 &&
      after[after.indexOf(source) + 1]?.startsWith('media') === true,
  );
  await page.waitForFunction(
    () => (document.querySelector('.mstage img') as HTMLImageElement)?.naturalWidth > 0,
  );
  await front('media').locator('.mscale').click();
  await page.waitForTimeout(500); // the scale slides there, and is kept a moment after it stops
  const scale = await front('media').locator('.mscale').innerText();
  const mediaTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Global');
  await go('Documentation');
  // A short tile keeps the page scrollable both ways, so neither a clamp nor an observer can hide a move undone.
  const moved = await front('docs').evaluate(async (el) => {
    const height = el.style.height;
    el.style.height = '240px';
    const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
    const seat = (id: string): number =>
      (el.querySelector(`.dpart[data-page="${id}"] .dhead`) as HTMLElement).getBoundingClientRect()
        .top - el.getBoundingClientRect().top;
    const go = async (id: string): Promise<number> => {
      el.querySelector<HTMLButtonElement>(`.dtoc [data-page="${id}"]`)!.click();
      for (let i = 0; i < 90 && Math.abs(seat(id) - 8) > 1; i++) await frame();
      await frame();
      await frame(); // Mutation and resize observers must not undo the move.
      return seat(id);
    };
    const first = await go('shortcuts');
    const second = await go('privacy');
    el.style.height = height;
    return Math.abs(first - 8) <= 1 && Math.abs(second - 8) <= 1;
  });
  check('view state: a Docs contents entry moves to its part, and nothing moves it back', moved);
  await front('docs').evaluate(async (el) => {
    el.scrollTop = 900;
    await new Promise((done) => setTimeout(done, 100)); // the real scroll event saves the place
  });
  const docsTop = await front('docs').evaluate((el) => el.scrollTop);
  const docsTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Stats');
  await front('stats').locator('.stab tbody tr').first().waitFor();
  await front('stats').locator('th.c-latency button').click();
  const statsTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Settings');
  await front('settings').locator('.ssearch input').fill('relay');
  const relay = front('settings')
    .locator('[data-entry="set.relayList"]')
    .getByLabel('Relay address', { exact: true });
  await relay.fill('wss://unfinished.example');
  const settingsTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await page.locator('.pane.cur .strip').getByTitle('New tab', { exact: true }).click();
  await page.locator('.launcher > input').fill('unfinished search');
  const newTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Global');
  return async () => {
    const show = async (tab: string | null): Promise<void> => {
      if (!tab) throw new Error('missing saved tab');
      await page.locator(`.tab[data-view="${tab}"]`).click();
    };
    await show(profileTab);
    check(
      'view state: profile kind survives live updates and reload',
      (await front('profile')
        .getByRole('tab', { name: 'Replies', exact: true })
        .getAttribute('aria-selected')) === 'true',
    );
    await show(mediaTab);
    await page.waitForFunction(
      () => (document.querySelector('.mstage img') as HTMLImageElement)?.naturalWidth > 0,
    );
    await page.waitForFunction(
      (expected) => document.querySelector('.mview .mscale')?.textContent === expected,
      scale,
    );
    check(
      'view state: media zoom survives remount and reload',
      (await front('media').locator('.mscale').innerText()) === scale,
    );
    await show(docsTab);
    await page.waitForFunction(
      (top) => document.querySelector('.pane.cur .view[data-kind="docs"]')?.scrollTop === top,
      docsTop,
    );
    check('view state: the place read in Docs survives reload', docsTop > 0);
    await show(statsTab);
    await front('stats').locator('.stab tbody tr').first().waitFor();
    check(
      'view state: Stats sort survives timer refresh and reload',
      (await front('stats').locator('th.c-latency').getAttribute('aria-sort')) === 'descending',
    );
    await show(settingsTab);
    check(
      'view state: Settings search and public draft survive reload',
      (await front('settings').locator('.ssearch input').inputValue()) === 'relay' &&
        (await front('settings')
          .locator('[data-entry="set.relayList"]')
          .getByLabel('Relay address', { exact: true })
          .inputValue()) === 'wss://unfinished.example',
    );
    await show(newTab);
    check(
      'view state: New tab search survives reload',
      (await page.locator('.launcher > input').inputValue()) === 'unfinished search',
    );
    await go('Global');
  };
}
