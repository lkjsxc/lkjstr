import { expect, test } from '@playwright/test';
import { generateSecretKey, finalizeEvent } from '../../src/lib/protocol';
import { encodeNpub } from '../../src/lib/protocol/nip19';
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
  await expect(
    profile.getByRole('heading', { name: 'Long Profile' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(profile.locator('.profile-notes')).toHaveCount(0);
  const scroller = profile.locator('[data-scroll-owner]');
  await expect(scroller).toHaveCount(1);
  const headerMetrics = await profile.evaluate((profileTab) => {
    const card = profileTab.querySelector('.profile-card') as HTMLElement;
    const listViewport = profileTab.querySelector(
      '.event-list__viewport',
    ) as HTMLElement | null;
    const owner = profileTab.querySelector('[data-scroll-owner]');
    return {
      headerInOwner: card.closest('[data-scroll-owner]') === owner,
      scrollbarGutter: listViewport
        ? getComputedStyle(listViewport).scrollbarGutter
        : '',
    };
  });
  expect(headerMetrics.headerInOwner).toBe(true);
  expect(headerMetrics.scrollbarGutter).toBe('stable');
  const scrollTop = await scroller.evaluate((node) => {
    const card = node.querySelector<HTMLElement>('.profile-card');
    node.scrollTop = (card?.offsetHeight ?? 600) + 20;
    node.dispatchEvent(new Event('scroll', { bubbles: true }));
    return node.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
  await expect(profile.getByText('profile flow note 0')).toBeVisible();
  const rowInOwner = await profile.evaluate((profileTab) => {
    const owner = profileTab.querySelector('[data-scroll-owner]');
    const firstRow = profileTab.querySelector('.event-row');
    return Boolean(owner && firstRow?.closest('[data-scroll-owner]') === owner);
  });
  expect(rowInOwner).toBe(true);
  await assertNoHorizontalOverflow(page);
});

test('empty profile keeps status rows in the profile scroll owner', async ({
  page,
}) => {
  const targetKey = generateSecretKey();
  const openerKey = generateSecretKey();
  const targetMetadata = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({ display_name: 'Empty Profile' }),
    },
    targetKey,
  );
  const openerNote = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000) - 1,
      kind: 1,
      tags: [],
      content: `open nostr:${encodeNpub(targetMetadata.pubkey)}`,
    },
    openerKey,
  );
  await installSyntheticRelay(page, { events: [targetMetadata, openerNote] });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await page.locator('.content-mention-token').click();

  const profile = page.locator(
    '.pane-body[data-active-tab="true"] .profile-tab',
  );
  await expect(
    profile.getByRole('heading', { name: 'Empty Profile' }),
  ).toBeVisible();
  await expect(profile.locator('[data-scroll-owner]')).toHaveCount(1);
  await expect(
    profile.getByText('No notes have been received for this profile.'),
  ).toBeVisible();
  const inFlow = await profile.evaluate((profileTab) => {
    const owner = profileTab.querySelector('[data-scroll-owner]');
    const empty = [...profileTab.querySelectorAll('p')].find((node) =>
      node.textContent?.includes('No notes have been received'),
    );
    return Boolean(owner && empty?.closest('[data-scroll-owner]') === owner);
  });
  expect(inFlow).toBe(true);
});
