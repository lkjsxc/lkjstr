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
  await expect(
    profile.getByRole('heading', { name: 'Scroll Profile' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(profile.locator('[data-scroll-owner]')).toHaveCount(1);

  const scroller = profile.locator('[data-scroll-owner]');
  const before = await profile.locator('.profile-card').boundingBox();
  await scroller.evaluate((node) => {
    const card = node.querySelector<HTMLElement>('.profile-card');
    node.scrollTop = (card?.offsetHeight ?? 600) + 20;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  const scrolls = await profile.evaluate((profileTab) => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const owner = profileTab.querySelector<HTMLElement>('[data-scroll-owner]');
    const card = profileTab.querySelector<HTMLElement>('.profile-card');
    return {
      page: document.body.scrollTop + document.documentElement.scrollTop,
      profile: owner?.scrollTop ?? 0,
      headerTop: card?.getBoundingClientRect().top ?? null,
    };
  });
  expect(scrolls.page).toBe(0);
  expect(scrolls.profile).toBeGreaterThan(0);
  expect(
    scrolls.headerTop === null || scrolls.headerTop < (before?.y ?? 0),
  ).toBe(true);
  await expect(profile.getByText('profile page scroll note 0')).toBeVisible();
});
