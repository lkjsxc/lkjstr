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
  const picture = global.locator('.media a.mbox:has(img)').first();
  let mediaTab: string | null = null;
  let scale = '';
  if (await picture.count()) {
    await picture.click();
    await front('media').locator('.mstage img').waitFor();
    await page.waitForFunction(
      () => (document.querySelector('.mstage img') as HTMLImageElement)?.naturalWidth > 0,
    );
    await front('media').locator('.mscale').click();
    scale = await front('media').locator('.mscale').innerText();
    mediaTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
    await go('Global');
  }
  await go('Docs');
  await front('docs').getByText('Privacy policy', { exact: true }).click();
  await front('docs').locator('.dgroup').first().locator('summary').click();
  const docsTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Stats');
  await front('stats').locator('.stab tbody tr').first().waitFor();
  await front('stats').locator('th.c-latency button').click();
  const statsTab = await page.locator('.pane.cur .tab.active').getAttribute('data-view');
  await go('Settings');
  await front('settings').locator('.ssearch input').fill('relay');
  const relay = front('settings').getByLabel('Relay address', { exact: true });
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
    if (mediaTab) {
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
    }
    await show(docsTab);
    check(
      'view state: Docs page and tree choice survive reload',
      (await front('docs').locator('.ditem.on').innerText()) === 'Privacy policy' &&
        !(await front('docs')
          .locator('.dgroup')
          .first()
          .evaluate((e) => (e as HTMLDetailsElement).open)),
    );
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
        (await front('settings').getByLabel('Relay address', { exact: true }).inputValue()) ===
          'wss://unfinished.example',
    );
    await show(newTab);
    check(
      'view state: New tab search survives reload',
      (await page.locator('.launcher > input').inputValue()) === 'unfinished search',
    );
    await go('Global');
  };
}
