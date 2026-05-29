import { expect, test, type Page } from '@playwright/test';
import { feedDisplayKinds } from '../../src/lib/events/feed-kinds';
import { feedPageSize } from '../../src/lib/events/feed-window';
import { semanticFilterKey } from '../../src/lib/events/relay-page-scan-diagnostics';
import { finalizeEvent, generateSecretKey, getPublicKey } from '../../src/lib/protocol';
import { DEFAULT_RELAYS } from '../../src/lib/relays/default-relays';
import {
  pageIntentSemanticKey,
  routeGroupFingerprint,
} from '../../src/lib/relays/orchestration/page-reads';
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
  await seedProfileCoverage(page, pubkey, [note], selectedRelays);
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
  const coveredRelays = selectedRelays.filter((relay) => relay !== missingRelay);

  await installSyntheticRelay(page, { events: [relayNote] });
  await openCleanWorkspace(page);
  await addReadonlyAccount(page, pubkey);
  await seedProfileCoverage(page, pubkey, [cached], coveredRelays);
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

async function seedProfileCoverage(
  page: Page,
  pubkey: string,
  events: readonly Record<string, unknown>[],
  coveredRelays: readonly string[],
) {
  const groupKey = 'fallback:0';
  const since = Math.floor(Date.now() / 1000) - 180;
  const until = Math.floor(Date.now() / 1000) + 180;
  const filterKey = semanticFilterKey({
    kinds: feedDisplayKinds,
    authors: [pubkey],
    limit: feedPageSize,
  });
  const feedKey = pageIntentSemanticKey({
    surface: 'profile',
    owner: 'e2e',
    phase: 'bootstrap',
    selectedRelays,
    authors: [pubkey],
    pageSize: feedPageSize,
    direction: 'initial',
    purpose: 'feed',
    routeFingerprint: routeGroupFingerprint([
      { key: groupKey, relays: selectedRelays, authors: [pubkey], source: 'fallback' },
    ]),
  });
  await page.evaluate(async (input) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lkjstr');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(['events', 'feedCoverage'], 'readwrite');
    const receivedAt = Date.now();
    for (const event of input.events)
      tx.objectStore('events').put({
        ...event,
        receivedAt,
        relayUrls: [input.coveredRelays[0] ?? 'cache'],
      });
    for (const relayUrl of input.coveredRelays)
      tx.objectStore('feedCoverage').put({
        id: [
          input.feedKey,
          input.groupKey,
          relayUrl,
          input.filterKey,
          input.since,
          input.until,
        ].join('|'),
        feedKey: input.feedKey,
        relayUrl,
        groupKey: input.groupKey,
        filterKey: input.filterKey,
        status: 'complete',
        since: input.since,
        until: input.until,
        updatedAt: receivedAt,
      });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { coveredRelays, events, feedKey, filterKey, groupKey, since, until });
}

async function clearSyntheticRelayTraffic(page: Page) {
  await page.evaluate(() => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;
    for (const socket of window.__syntheticSockets ?? [])
      if (isRecord(socket) && Array.isArray(socket.sent)) socket.sent.length = 0;
  });
}

async function profilePageReadRelays(
  page: Page,
  pubkey: string,
  minimumUntil: number,
) {
  return page.evaluate(({ pubkey, minimumUntil }) => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;
    const isProfilePageRead = (message: string) => {
      try {
        const parsed = JSON.parse(message);
        if (!Array.isArray(parsed) || parsed[0] !== 'REQ') return false;
        return parsed.slice(2).some((filter) => {
          if (!isRecord(filter)) return false;
          const kinds = Array.isArray(filter.kinds) ? filter.kinds : [];
          const authors = Array.isArray(filter.authors) ? filter.authors : [];
          return (
            kinds.includes(1) &&
            authors.includes(pubkey) &&
            Number.isFinite(filter.until) &&
            Number(filter.until) >= minimumUntil
          );
        });
      } catch {
        return false;
      }
    };
    const sockets = (window.__syntheticSockets ?? []).filter(isRecord);
    return sockets
      .map((socket) => ({
        url: socket.url,
        sent: Array.isArray(socket.sent) ? socket.sent : [],
      }))
      .filter((socket) =>
        socket.sent.some((item) =>
          typeof item === 'string' && isProfilePageRead(item),
        ),
      )
      .map((socket) => String(socket.url))
      .sort();
  }, { pubkey, minimumUntil });
}
