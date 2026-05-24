import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from '../../src/lib/protocol';
import { installSyntheticRelay } from './timeline-relay-helpers';
import { openNewTabOption } from './workspace-helpers';

test('Profile tab scroll does not move the page', async ({ page }) => {
  const key = generateSecretKey();
  const metadata = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({
        display_name: 'Scroll Profile',
        about: Array.from({ length: 16 }, () => 'profile details').join('\n'),
      }),
    },
    key,
  );
  const notes = Array.from({ length: 50 }, (_, index) =>
    finalizeEvent(
      {
        created_at: Math.floor(Date.now() / 1000) - index,
        kind: 1,
        tags: [],
        content: `profile page scroll note ${index}`,
      },
      key,
    ),
  );
  await installSyntheticRelay(page, { events: [metadata, ...notes] });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await expect(page.getByText('profile page scroll note 0')).toBeVisible();
  await page.locator('.event-row .avatar-button').first().click();
  const profile = page.locator(
    '.pane-body[data-active-tab="true"] .profile-tab',
  );
  await expect(profile.getByText('profile page scroll note 0')).toBeVisible();

  const scrolls = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const tab = document.querySelector<HTMLElement>('.profile-tab');
    if (tab) tab.scrollTop = tab.scrollHeight;
    return {
      page: document.body.scrollTop + document.documentElement.scrollTop,
      profile: tab?.scrollTop ?? 0,
    };
  });
  expect(scrolls.page).toBe(0);
  expect(scrolls.profile).toBeGreaterThan(0);
});
