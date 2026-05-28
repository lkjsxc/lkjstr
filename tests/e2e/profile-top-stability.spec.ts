import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from '../../src/lib/protocol';
import {
  installSyntheticRelay,
  waitForSyntheticEvent,
} from './timeline-relay-helpers';
import { openNewTabOption } from './workspace-helpers';

test('profile top stays newest and future notes stay hidden', async ({
  page,
}) => {
  const key = generateSecretKey();
  const now = Math.floor(Date.now() / 1000);
  const metadata = finalizeEvent(
    {
      created_at: now,
      kind: 0,
      tags: [],
      content: JSON.stringify({ display_name: 'Stable Profile' }),
    },
    key,
  );
  const notes = Array.from({ length: 240 }, (_, index) =>
    finalizeEvent(
      {
        created_at: now - index,
        kind: 1,
        tags: [],
        content: `profile stability note ${index}`,
      },
      key,
    ),
  );
  const future = finalizeEvent(
    {
      created_at: now + 3600,
      kind: 1,
      tags: [],
      content: 'profile future note',
    },
    key,
  );

  await installSyntheticRelay(page, { events: [metadata, future, ...notes] });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await waitForSyntheticEvent(page, notes[0]!.id);
  await expect(page.getByText('profile stability note 0')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('profile future note')).toHaveCount(0);
  await page.locator('.event-row .avatar-button').first().click();

  const profile = page.locator(
    '.pane-body[data-active-tab="true"] .profile-tab',
  );
  await expect(
    profile.getByRole('heading', { name: 'Stable Profile' }),
  ).toBeVisible({ timeout: 15_000 });
  const scroller = profile.locator('[data-scroll-owner]');
  await expect(scroller).toHaveCount(1);

  const midScroll = await scroller.evaluate((node) => {
    const target = Math.min(
      600,
      Math.max(0, node.scrollHeight - node.clientHeight - 80),
    );
    node.scrollTop = target;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
    return {
      scrollTop: node.scrollTop,
      maxScrollTop: node.scrollHeight - node.clientHeight,
    };
  });
  expect(midScroll.scrollTop).toBeGreaterThan(0);
  expect(midScroll.scrollTop).toBeLessThan(midScroll.maxScrollTop);

  await scroller.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBe(0);
  await page.waitForTimeout(1_500);

  await expect(profile.getByText('profile stability note 0')).toBeVisible();
  await expect(profile.getByText('profile stability note 239')).toHaveCount(0);
  await expect(profile.getByText('profile future note')).toHaveCount(0);
});
