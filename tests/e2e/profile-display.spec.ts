import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { installSyntheticRelay } from './timeline-relay-helpers';
import { openNewTabOption } from './workspace-helpers';

test('profile header, links, and copy menu match display contract', async ({
  page,
}) => {
  const key = generateSecretKey();
  const metadata = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000),
      kind: 0,
      tags: [],
      content: JSON.stringify({
        display_name: 'Profile Display Name',
        name: 'profile-name',
        nip05: 'profile@example.com',
        website: 'site.example',
        about: 'Visit about.example/path and javascript://bad.example',
        banner: bannerDataUrl(),
      }),
    },
    key,
  );
  const note = finalizeEvent(
    {
      created_at: Math.floor(Date.now() / 1000) - 1,
      kind: 1,
      tags: [],
      content: 'profile contract note',
    },
    key,
  );
  await installSyntheticRelay(page, { events: [metadata, note] });
  await page.goto('/');
  await openNewTabOption(page, 'Global');
  await expect(page.getByText('profile contract note')).toBeVisible();
  await page.locator('.event-row .avatar-button').first().click();

  const profile = page.locator(
    '.pane-body[data-active-tab="true"] .profile-tab',
  );
  await expect(
    profile.getByRole('heading', { name: 'Profile Display Name' }),
  ).toBeVisible();
  await expect(profile.locator('a[href="https://site.example/"]')).toHaveText(
    'site.example',
  );
  await expect(
    profile.locator('a[href="https://about.example/path"]'),
  ).toHaveText('about.example/path');
  await expect(profile.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(profile.getByText(/nprofile1/i)).toHaveCount(0);
  await expect(profile.getByText(/loaded posts/i)).toHaveCount(0);

  const metrics = await profile.evaluate((node) => {
    const banner = node.querySelector('.profile-card__banner-wrap');
    const checked = [
      '.profile-card__identity',
      '.profile-card__actions',
      '.profile-card__facts',
      'p',
    ].map((selector) => node.querySelector(selector));
    const bottom = banner?.getBoundingClientRect().bottom ?? 0;
    return checked.every(
      (item) => item && item.getBoundingClientRect().top >= bottom - 1,
    );
  });
  expect(metrics).toBe(true);

  await profile.locator('summary[aria-label="Profile copy menu"]').click();
  for (const label of [
    'Copy npub',
    'Copy nprofile',
    'Copy follow list JSON',
    'Copy relay sets JSON',
  ]) {
    await expect(profile.getByRole('button', { name: label })).toBeVisible();
  }
});

function bannerDataUrl(): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320">' +
    '<rect width="1200" height="320" fill="#1f7a8c"/></svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
