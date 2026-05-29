import { upsertEvent } from '../events/repository';
import { readRelayPage } from '../events/relay-page';
import { kinds, normalizeRelayUrl } from '../protocol';
import type { RelayReadSubscriptions } from '../events/relay-page';
import { configuredDiscoveryRelays } from './relay-routing';
import { blockedRelayUrls } from './relay-route-store';

export async function discoverAuthorRelayRoutes(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly key: string;
  readonly subscriptions: RelayReadSubscriptions;
  readonly signal?: AbortSignal;
}): Promise<void> {
  const authors = [...new Set(input.authors)].slice(0, 50);
  if (authors.length === 0) return;
  const userBlocked = await blockedRelayUrls('user');
  const discoveryBlocked = await blockedRelayUrls('discovery');
  const discoveryRelays = await configuredDiscoveryRelays();
  const relays = [
    ...new Set(
      [
        ...input.selectedRelays
          .map(normalizeRelayUrl)
          .filter((relay): relay is string => Boolean(relay))
          .filter((relay) => !userBlocked.has(relay)),
        ...discoveryRelays.filter((relay) => !discoveryBlocked.has(relay)),
      ]
        .map(normalizeRelayUrl)
        .filter((relay): relay is string => Boolean(relay)),
    ),
  ];
  const events = await readRelayPage({
    key: input.key,
    relays,
    filters: [
      {
        kinds: [kinds.relayListMetadata],
        authors,
        limit: authors.length,
      },
    ],
    pageSize: authors.length,
    subscriptions: input.subscriptions,
    signal: input.signal,
    purpose: 'route-discovery',
  });
  await Promise.all(
    events.map((item) => upsertEvent(item.event, [item.relay])),
  );
}
