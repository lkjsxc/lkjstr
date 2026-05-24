import { expect, test, type Page } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from '../../src/lib/protocol';
import { installSyntheticRelay } from './timeline-relay-helpers';
import { openNewTabOption, pane } from './workspace-helpers';

const options = [
  'Welcome',
  'Home',
  'Global',
  'Relay Settings',
  'lkjstr Log',
  'Notifications',
  'Accounts',
  'Mine npub',
  'Tweet',
  'Profile Edit',
  'Settings',
  'Search',
  'Custom Request',
  'Stats',
  'Upload Settings',
] as const;

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`tabs avoid horizontal overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await assertNoHorizontalOverflow(page);
    for (const option of options) {
      await openNewTabOption(page, option);
      await assertNoHorizontalOverflow(page);
    }
  });
}

test('feed lists fill split tiles', async ({ page }) => {
  await page.goto('/');
  await pane(page, 0).getByRole('button', { name: 'Open tile menu' }).click();
  await page.getByRole('button', { name: 'Split right' }).click();
  await page
    .locator('.new-tab')
    .getByRole('button', { name: 'Global', exact: true })
    .click();
  const heights = await page
    .locator('.event-list')
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().height),
    );
  expect(heights.every((height) => height > 120)).toBe(true);
});

test('tab drag area does not extend past the close button', async ({
  page,
}) => {
  await page.goto('/');
  const frame = page.locator('.tab-frame').first();
  const close = frame.locator('.tab-close');
  const gap = await frame.evaluate((tab) => {
    const button = tab.querySelector('.tab-close');
    if (!button) return Number.POSITIVE_INFINITY;
    return (
      tab.getBoundingClientRect().right - button.getBoundingClientRect().right
    );
  });
  await expect(close).toBeVisible();
  expect(gap).toBeLessThanOrEqual(1);
});

test('global event scroller fills the tile body', async ({ page }) => {
  await installSyntheticRelay(page, { events: syntheticNotes(40) });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await expect(page.getByText('layout fit note 0')).toBeVisible();
  const heights = await page
    .locator('.pane-body[data-active-tab="true"] .event-list')
    .evaluate((list) => {
      const scroller = list.querySelector('.event-list__scroller');
      return {
        list: list.getBoundingClientRect().height,
        scroller: scroller?.getBoundingClientRect().height ?? 0,
      };
    });
  expect(heights.scroller).toBeGreaterThan(heights.list * 0.8);
});

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
  await expect(profile.getByText('profile flow note 0')).toBeVisible();
  await expect(profile.locator('.event-list__scroller')).toHaveCount(0);
  const metrics = await profile.evaluate((profileTab) => {
    const card = profileTab.querySelector('.profile-card') as HTMLElement;
    const notesSection = profileTab.querySelector(
      '.profile-notes',
    ) as HTMLElement;
    return {
      scrollable: profileTab.scrollHeight > profileTab.clientHeight + 1,
      notesAfterSummary:
        notesSection.getBoundingClientRect().top >
        card.getBoundingClientRect().bottom,
      rowCount: profileTab.querySelectorAll('.profile-notes .event-row').length,
    };
  });
  expect(metrics.scrollable).toBe(true);
  expect(metrics.notesAfterSummary).toBe(true);
  expect(metrics.rowCount).toBeGreaterThanOrEqual(30);
  const scrollTop = await profile.evaluate((profileTab) => {
    profileTab.scrollTop = profileTab.scrollHeight;
    profileTab.dispatchEvent(new Event('scroll'));
    return profileTab.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
  await expect(profile.getByText('profile flow note 29')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('form fields expose id or name attributes', async ({ page }) => {
  await page.goto('/');
  for (const option of ['Relay Settings', 'Accounts', 'Tweet', 'Settings']) {
    await openNewTabOption(page, option);
  }
  const missing = await page
    .locator('input, textarea, select')
    .evaluateAll(
      (fields) =>
        fields.filter(
          (field) => !field.getAttribute('id') && !field.getAttribute('name'),
        ).length,
    );
  expect(missing).toBe(0);
});

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const doc = document.documentElement;
        const panes = [...document.querySelectorAll('.pane, .pane-body')];
        return [
          doc.scrollWidth <= doc.clientWidth + 1,
          ...panes.map((pane) => pane.scrollWidth <= pane.clientWidth + 1),
        ].every(Boolean);
      }),
    )
    .toBe(true);
}

function syntheticNotes(
  count: number,
  key = generateSecretKey(),
  prefix = 'layout fit note',
) {
  return Array.from({ length: count }, (_, index) =>
    finalizeEvent(
      {
        created_at: Math.floor(Date.now() / 1000) - index,
        kind: 1,
        tags: [],
        content: `${prefix} ${index}`,
      },
      key,
    ),
  );
}
