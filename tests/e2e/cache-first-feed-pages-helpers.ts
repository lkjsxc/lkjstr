import type { Page } from '@playwright/test';
import { feedDisplayKinds } from '../../src/lib/events/feed-kinds';
import { feedPageSize } from '../../src/lib/events/feed-window';
import { semanticFilterKey } from '../../src/lib/events/relay-page-scan-diagnostics';
import {
  pageIntentSemanticKey,
  routeGroupFingerprint,
} from '../../src/lib/relays/orchestration/page-reads';

export async function seedProfileCoverage(
  page: Page,
  input: {
    readonly pubkey: string;
    readonly events: readonly Record<string, unknown>[];
    readonly coveredRelays: readonly string[];
    readonly selectedRelays: readonly string[];
  },
) {
  const groupKey = 'fallback:0';
  const since = Math.floor(Date.now() / 1000) - 180;
  const until = Math.floor(Date.now() / 1000) + 180;
  const filterKey = semanticFilterKey({
    kinds: feedDisplayKinds,
    authors: [input.pubkey],
    limit: feedPageSize,
  });
  const feedKey = profileFeedKey(input, groupKey);
  await page.evaluate(
    async (input) => {
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
    },
    { ...input, feedKey, filterKey, groupKey, since, until },
  );
}

export async function clearSyntheticRelayTraffic(page: Page) {
  await page.evaluate(() => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null;
    for (const socket of window.__syntheticSockets ?? [])
      if (isRecord(socket) && Array.isArray(socket.sent))
        socket.sent.length = 0;
  });
}

export async function profilePageReadRelays(
  page: Page,
  pubkey: string,
  minimumUntil: number,
) {
  return page.evaluate(
    ({ pubkey, minimumUntil }) => {
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
          socket.sent.some(
            (item) => typeof item === 'string' && isProfilePageRead(item),
          ),
        )
        .map((socket) => String(socket.url))
        .sort();
    },
    { pubkey, minimumUntil },
  );
}

function profileFeedKey(
  input: {
    readonly pubkey: string;
    readonly selectedRelays: readonly string[];
  },
  groupKey: string,
) {
  return pageIntentSemanticKey({
    surface: 'profile',
    owner: 'e2e',
    phase: 'bootstrap',
    selectedRelays: input.selectedRelays,
    authors: [input.pubkey],
    pageSize: feedPageSize,
    direction: 'initial',
    purpose: 'feed',
    routeFingerprint: routeGroupFingerprint([
      {
        key: groupKey,
        relays: input.selectedRelays,
        authors: [input.pubkey],
        source: 'fallback',
      },
    ]),
  });
}
