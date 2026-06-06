import { configuredDiscoveryRelays } from '../relays/relay-routing';
import { lookupEvents } from '../events/repository';
import { normalizeRelayUrl } from '../protocol';
import {
  blockedRelayUrls,
  authorRelayRoutes,
  routeAllowed,
} from '../relays/relay-route-store';

function dedupePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export type PreferredFollowRelayGroups = {
  readonly selected: string[];
  readonly nip65: string[];
  readonly receiptKind3: string[];
  readonly provenance: string[];
  readonly discovery: string[];
};

export async function buildPreferredRelayGroups(input: {
  readonly activePubkey: string;
  readonly selectedRelays: readonly string[];
  readonly allowDiscoveryFallback?: boolean;
}): Promise<PreferredFollowRelayGroups> {
  const userBlocked = await blockedRelayUrls('user');
  const discoveryBlocked = await blockedRelayUrls('discovery');
  const selected = dedupePreserveOrder(
    input.selectedRelays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url))
      .filter((url) => !userBlocked.has(url)),
  );

  const routes = await authorRelayRoutes([input.activePubkey]);
  const readRoutes = routes.filter((route) => routeAllowed(route, 'read'));
  const nip65 = dedupePreserveOrder(
    readRoutes
      .filter((route) => route.source === 'nip65')
      .map((route) => route.relayUrl)
      .filter((relay) => !userBlocked.has(relay)),
  );

  const receiptRoutes = readRoutes.filter(
    (route) => route.source === 'event-receipt' && Boolean(route.eventId),
  );
  const receiptEventIds = dedupePreserveOrder(
    receiptRoutes.map((route) => route.eventId!).filter(Boolean),
  );
  const receiptEvents = await lookupEvents(receiptEventIds);
  const kind3ReceiptEventIds = new Set(
    receiptEvents
      .filter(
        (event) =>
          event.event.kind === 3 && event.event.pubkey === input.activePubkey,
      )
      .map((event) => event.event.id),
  );
  const receiptKind3 = dedupePreserveOrder(
    receiptRoutes
      .filter((route) => kind3ReceiptEventIds.has(route.eventId!))
      .map((route) => route.relayUrl)
      .filter((relay) => !userBlocked.has(relay)),
  );

  const alreadyPlanned = new Set([...selected, ...nip65, ...receiptKind3]);
  const provenance = dedupePreserveOrder(
    readRoutes
      .filter((route) =>
        ['event-receipt', 'event-hint', 'nip02'].includes(route.source),
      )
      .map((route) => route.relayUrl)
      .filter((relay) => !userBlocked.has(relay))
      .filter((relay) => !alreadyPlanned.has(relay)),
  );

  const allowDiscovery = input.allowDiscoveryFallback || selected.length === 0;
  const discovery = allowDiscovery
    ? dedupePreserveOrder(
        (await configuredDiscoveryRelays()).filter(
          (url) => !discoveryBlocked.has(url) && !userBlocked.has(url),
        ),
      )
    : [];

  return { selected, nip65, receiptKind3, provenance, discovery };
}
