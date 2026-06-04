import type { Page } from '@playwright/test';
import { feedDisplayKinds } from '../../src/lib/events/feed-kinds';
import { feedPageSize } from '../../src/lib/events/feed-window';
import { semanticFilterKey } from '../../src/lib/events/relay-page-scan-diagnostics';
import {
  pageIntentSemanticKey,
  routeGroupFingerprint,
} from '../../src/lib/relays/orchestration/page-read-keys';
import {
  eventSteps,
  feedCoverageStep,
  runEventGraphBatch,
} from './sqlite-event-helpers';

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
  const updatedAt = Date.now();
  const coverageRows = input.coveredRelays.map((relayUrl) => ({
    id: [feedKey, groupKey, relayUrl, filterKey, since, until].join('|'),
    feedKey,
    relayUrl,
    groupKey,
    filterKey,
    status: 'complete',
    since,
    until,
    updatedAt,
  }));
  await runEventGraphBatch(page, [
    ...eventSteps(input.events, [input.coveredRelays[0] ?? 'cache']),
    ...coverageRows.map(feedCoverageStep),
  ]);
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
