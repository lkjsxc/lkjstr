import { upsertEvent } from '../events/repository';
import { readRelayPage } from '../events/relay-page';
import { kinds, normalizeRelayUrl } from '../protocol';
import type { RelaySubscriptionManager } from './subscription-manager';
import { discoveryRelays } from './relay-routing';
import { blockedRelayUrls } from './relay-route-store';

export async function discoverAuthorRelayRoutes(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly key: string;
  readonly subscriptions: RelaySubscriptionManager;
}): Promise<void> {
  const authors = [...new Set(input.authors)].slice(0, 50);
  if (authors.length === 0) return;
  const blocked = await blockedRelayUrls();
  const relays = [
    ...new Set(
      [...input.selectedRelays, ...discoveryRelays]
        .map(normalizeRelayUrl)
        .filter((relay): relay is string => Boolean(relay))
        .filter((relay) => !blocked.has(relay)),
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
    purpose: 'route-discovery',
  });
  await Promise.all(
    events.map((item) => upsertEvent(item.event, [item.relay])),
  );
}
