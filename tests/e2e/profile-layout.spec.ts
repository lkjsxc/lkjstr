import { expect, test } from '@playwright/test';
import { generateSecretKey, finalizeEvent } from '../../src/lib/protocol';
import { encodeNpub } from '../../src/lib/protocol/nip19';
import { installSyntheticRelay } from './timeline-relay-helpers';
import { assertNoHorizontalOverflow, syntheticNotes } from './layout-helpers';
import { openNewTabOption, pane } from './workspace-helpers';

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
  const mention = page.locator('.content-mention-token');
  await expect(mention).toBeVisible({ timeout: 15_000 });
  await mention.click();

  const profile = page.locator(
    '.pane-body[data-active-tab="true"] .profile-tab',
  );
  await expect(
    profile.getByRole('heading', { name: 'Empty Profile' }),
  ).toBeVisible({ timeout: 15_000 });
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

for (const target of [
  { name: 'desktop', width: 1280, height: 800, split: false },
  { name: 'mobile', width: 390, height: 844, split: false },
  { name: 'split pane', width: 900, height: 700, split: true },
]) {
  test(`profile identity wraps at ${target.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: target.width, height: target.height });
    const key = generateSecretKey();
    const metadata = finalizeEvent(
      {
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        content: JSON.stringify({
          display_name: 'DisplayName'.repeat(18),
          nip05: `${'identity'.repeat(12)}@example.com`,
          website: `${'website'.repeat(10)}.example.com/${'path'.repeat(12)}`,
          about: `${'about'.repeat(20)} https://${'link'.repeat(
            12,
          )}.example.com/${'route'.repeat(10)}`,
        }),
      },
      key,
    );
    const note = finalizeEvent(
      {
        created_at: Math.floor(Date.now() / 1000) - 1,
        kind: 1,
        tags: [],
        content: 'profile wrap note',
      },
      key,
    );
    await installSyntheticRelay(page, { events: [metadata, note] });
    await page.goto('/');
    if (target.split) {
      await pane(page, 0)
        .getByRole('button', { name: 'Open tile menu' })
        .click();
      await page.getByRole('button', { name: 'Split right' }).click();
    }
    await openNewTabOption(page, 'Global');
    await expect(page.getByText('profile wrap note')).toBeVisible();
    await page.locator('.event-row .avatar-button').first().click();

    const profile = page.locator(
      '.pane-body[data-active-tab="true"] .profile-tab',
    );
    await expect(profile.locator('.profile-card__identity')).toBeVisible();
    const fits = await profile.evaluate((profileTab) =>
      [
        '.profile-card__identity',
        '.profile-card__facts',
        '.profile-card__about',
      ].every((selector) => {
        const item = profileTab.querySelector<HTMLElement>(selector);
        return item ? item.scrollWidth <= item.clientWidth + 1 : true;
      }),
    );
    expect(fits).toBe(true);
    await assertNoHorizontalOverflow(page);
  });
}
