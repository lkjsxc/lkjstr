import { configuredDiscoveryRelays } from '../relays/relay-routing';
import { lookupEvents } from '../events/repository';
import { normalizeRelayUrl } from '../protocol';
import {
  blockedRelayUrls,
  authorRelayRoutes,
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

  const nip65 = dedupePreserveOrder(
    routes
      .filter((r) => r.source === 'nip65')
      .filter((r) => r.purpose === 'read' || r.purpose === 'both')
      .map((r) => r.relayUrl)
      .filter((relay) => !userBlocked.has(relay)),
  );

  // Receipt routes contain `eventId`, so we can confirm the event is the
  // latest kind `3` follow list for the active pubkey.
  const receiptRoutes = routes.filter(
    (r) => r.source === 'event-receipt' && Boolean(r.eventId),
  );
  const receiptEventIds = dedupePreserveOrder(
    receiptRoutes.map((r) => r.eventId!).filter(Boolean),
  );
  const receiptEvents = await lookupEvents(receiptEventIds);
  const kind3ReceiptEventIds = new Set(
    receiptEvents
      .filter(
        (e) => e.event.kind === 3 && e.event.pubkey === input.activePubkey,
      )
      .map((e) => e.event.id),
  );
  const receiptKind3 = dedupePreserveOrder(
    receiptRoutes
      .filter((r) => kind3ReceiptEventIds.has(r.eventId!))
      .map((r) => r.relayUrl)
      .filter((relay) => !userBlocked.has(relay)),
  );

  const allowDiscovery = input.allowDiscoveryFallback || selected.length === 0;
  const discovery = allowDiscovery
    ? dedupePreserveOrder(
        (await configuredDiscoveryRelays()).filter(
          (url) => !discoveryBlocked.has(url),
        ),
      )
    : [];

  return { selected, nip65, receiptKind3, discovery };
}
