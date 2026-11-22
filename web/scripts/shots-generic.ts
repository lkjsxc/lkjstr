// S4 N2/N7 signed-out/public mock visual cases. Real signed link reads are smoke-tested separately.
import type { Page } from 'playwright-core';

type Scene = (
  name: string,
  path: string,
  act: (page: Page) => Promise<void>,
  mock?: string,
) => Promise<void>;

async function showAll(page: Page): Promise<void> {
  const all = page
    .locator('.pkinds [role="tab"]')
    .filter({ hasText: /^All$|^すべて$/ })
    .first();
  await all.waitFor();
  await all.click();
  await page
    .locator('.pkinds [aria-selected="true"]')
    .filter({ hasText: /^All$|^すべて$/ })
    .waitFor();
  await page
    .locator('.view[data-kind="profile"] .note')
    .filter({ hasText: 'Afternoon Nostr Meetup' })
    .waitFor();
}
export async function genericShots(scene: Scene): Promise<void> {
  await scene('profile-all', '/p/komorebi', async (page) => {
    await showAll(page);
    await page
      .locator('.view[data-kind="profile"] .note')
      .filter({ hasText: 'Public collection of developer tools' })
      .waitFor();
  });
  await scene('view-generic', '/p/komorebi', async (page) => {
    await showAll(page);
    await page
      .locator('.view[data-kind="profile"] .note')
      .filter({ hasText: 'Afternoon Nostr Meetup' })
      .first()
      .click();
    await page.locator('.view[data-kind="thread"] .th-focus .generic-face').waitFor();
    if (await page.locator('.view[data-kind="thread"] .generic-tags:visible').count())
      throw new Error('details did not begin folded');
  });
  await scene('view-generic-data', '/p/komorebi', async (page) => {
    await showAll(page);
    await page
      .locator('.view[data-kind="profile"] .note')
      .filter({ hasText: 'Relay availability data' })
      .first()
      .click();
    await page.locator('.view[data-kind="thread"] .th-focus .generic-data').waitFor();
    await page.locator('.view[data-kind="thread"] .th-focus .generic-disclosure').click();
    await page.locator('.view[data-kind="thread"] .th-focus .generic-tags:visible').waitFor();
  });
  await scene(
    'link-any-kind',
    '/p/komorebi',
    async (page) => {
      await showAll(page);
      await page
        .locator('.view[data-kind="profile"] .note')
        .filter({ hasText: 'Afternoon Nostr Meetup' })
        .first()
        .click();
      await page.locator('.view[data-kind="thread"] .th-focus .generic-face').waitFor();
      await page.locator('.acct.out').waitFor();
    },
    '{"live":false,"accounts":"none"}',
  );
}
