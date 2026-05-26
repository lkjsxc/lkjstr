import { expect, test } from '@playwright/test';
import { generateSecretKey, finalizeEvent } from '../../src/lib/protocol';
import { installSyntheticRelay } from './timeline-relay-helpers';
import { assertNoHorizontalOverflow, syntheticNotes } from './layout-helpers';
import { openNewTabOption } from './workspace-helpers';

test('profile notes follow the summary in the profile scroll flow', async ({
  page,
}) => {
  const key = generateSecretKey();
  const metadata = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({
        display_name: 'Long Profile',
        about: Array.from({ length: 12 }, () => 'profile details').join('\n'),
      }),
    },
    key,
  );
  const notes = syntheticNotes(45, key, 'profile flow note');
  await installSyntheticRelay(page, { events: [metadata, ...notes] });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await expect(page.getByText('profile flow note 0')).toBeVisible();
  await page.locator('.event-row .avatar-button').first().click();
  await expect(page.getByRole('region', { name: 'Profile' })).toBeVisible();
  const profile = page.locator(
    '.pane-body[data-active-tab="true"] .profile-tab',
  );
  await expect
    .poll(() => profile.locator('.profile-notes .event-row').count(), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  await expect(profile.getByText('profile flow note 0')).toBeVisible();
  const scroller = profile.locator('.profile-notes .event-list__scroller');
  await scroller.hover();
  await page.mouse.wheel(0, 1200);
  await expect(scroller).toHaveCount(1);
  const metrics = await profile.evaluate((profileTab) => {
    const card = profileTab.querySelector('.profile-card') as HTMLElement;
    const notesSection = profileTab.querySelector(
      '.profile-notes',
    ) as HTMLElement;
    const listViewport = profileTab.querySelector(
      '.profile-notes .event-list__viewport',
    ) as HTMLElement | null;
    return {
      notesAfterSummary:
        notesSection.getBoundingClientRect().top >
        card.getBoundingClientRect().bottom,
      scrollbarGutter: listViewport
        ? getComputedStyle(listViewport).scrollbarGutter
        : '',
    };
  });
  expect(metrics.notesAfterSummary).toBe(true);
  expect(metrics.scrollbarGutter).toBe('stable');
  const scrollTop = await profile.evaluate(() => {
    const scrollers = [
      ...document.querySelectorAll<HTMLElement>(
        '.profile-notes .event-list__scroller, .profile-notes .event-list__scroller *',
      ),
    ].filter((node) => node.scrollHeight > node.clientHeight + 8);
    for (const node of scrollers) node.scrollTop = node.scrollHeight;
    return Math.max(0, ...scrollers.map((node) => node.scrollTop));
  });
  expect(scrollTop).toBeGreaterThan(0);
  await assertNoHorizontalOverflow(page);
});
