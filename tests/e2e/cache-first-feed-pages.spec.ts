import { expect, test } from '@playwright/test';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from '../../src/lib/protocol';
import { DEFAULT_RELAYS } from '../../src/lib/relays/default-relays';
import {
  clearSyntheticRelayTraffic,
  profilePageReadRelays,
  seedProfileCoverage,
} from './cache-first-feed-pages-helpers';
import {
  addReadonlyAccount,
  installSyntheticRelay,
  openCleanWorkspace,
} from './timeline-relay-helpers';
import { openNewTabOption } from './workspace-helpers';

const selectedRelays = DEFAULT_RELAYS.map((relay) => new URL(relay).href);

test('profile feed uses complete local coverage without page relay reads', async ({
  page,
}) => {
  const key = generateSecretKey();
  const pubkey = getPublicKey(key);
  const now = Math.floor(Date.now() / 1000) - 5;
  const note = finalizeEvent(
    { created_at: now, kind: 1, tags: [], content: 'cached profile note' },
    key,
  );

  await installSyntheticRelay(page, { events: [] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, pubkey);
  await seedProfileCoverage(page, {
    pubkey,
    events: [note],
    coveredRelays: selectedRelays,
    selectedRelays,
  });
  await clearSyntheticRelayTraffic(page);
  const openedAt = Math.floor(Date.now() / 1000);
  await openNewTabOption(page, 'My Profile', 1);

  await expect(page.getByText('cached profile note')).toBeVisible({
    timeout: 15_000,
  });
  expect(await profilePageReadRelays(page, pubkey, openedAt)).toEqual([]);
});

test('profile feed queries only uncovered relay requirements', async ({
  page,
}) => {
  const key = generateSecretKey();
  const pubkey = getPublicKey(key);
  const now = Math.floor(Date.now() / 1000) - 5;
  const cached = finalizeEvent(
    { created_at: now, kind: 1, tags: [], content: 'covered profile note' },
    key,
  );
  const relayNote = finalizeEvent(
    { created_at: now - 1, kind: 1, tags: [], content: 'uncovered relay note' },
    key,
  );
  const missingRelay = selectedRelays.at(-1)!;
  const coveredRelays = selectedRelays.filter(
    (relay) => relay !== missingRelay,
  );

  await installSyntheticRelay(page, { events: [relayNote] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, pubkey);
  await seedProfileCoverage(page, {
    pubkey,
    events: [cached],
    coveredRelays,
    selectedRelays,
  });
  await clearSyntheticRelayTraffic(page);
  const openedAt = Math.floor(Date.now() / 1000);
  await openNewTabOption(page, 'My Profile', 1);

  await expect(page.getByText('covered profile note')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('uncovered relay note')).toBeVisible({
    timeout: 15_000,
  });
  expect(await profilePageReadRelays(page, pubkey, openedAt)).toEqual([
    missingRelay,
  ]);
});
