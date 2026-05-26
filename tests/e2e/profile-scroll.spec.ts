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
  await expect
    .poll(() => profile.locator('.profile-notes .event-row').count(), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);

  const scroller = profile.locator('.profile-notes .event-list__scroller');
  await scroller.hover();
  await page.mouse.wheel(0, 1200);
  const scrolls = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const scrollers = [
      ...document.querySelectorAll<HTMLElement>(
        '.profile-tab .event-list__scroller, .profile-tab .event-list__scroller *',
      ),
    ].filter((node) => node.scrollHeight > node.clientHeight + 8);
    for (const node of scrollers) node.scrollTop = node.scrollHeight;
    return {
      page: document.body.scrollTop + document.documentElement.scrollTop,
      profile: Math.max(0, ...scrollers.map((node) => node.scrollTop)),
    };
  });
  expect(scrolls.page).toBe(0);
  expect(scrolls.profile).toBeGreaterThan(0);
});
