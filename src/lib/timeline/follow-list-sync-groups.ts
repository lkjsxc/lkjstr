import { discoveryRelays } from '../relays/relay-routing';
import { lookupEvents } from '../events/repository';
import { normalizeRelayUrl } from '../protocol';
import { blockedRelayUrls, authorRelayRoutes } from '../relays/relay-route-store';

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
}): Promise<PreferredFollowRelayGroups> {
  const blocked = await blockedRelayUrls();
  const selected = dedupePreserveOrder(
    input.selectedRelays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url))
      .filter((url) => !blocked.has(url)),
  );

  const routes = await authorRelayRoutes([input.activePubkey]);

  const nip65 = dedupePreserveOrder(
    routes
      .filter((r) => r.source === 'nip65')
      .filter((r) => r.purpose === 'read' || r.purpose === 'both')
      .map((r) => r.relayUrl)
      .filter((relay) => !blocked.has(relay)),
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
      .filter((e) => e.kind === 3 && e.pubkey === input.activePubkey)
      .map((e) => e.id),
  );
  const receiptKind3 = dedupePreserveOrder(
    receiptRoutes
      .filter((r) => kind3ReceiptEventIds.has(r.eventId!))
      .map((r) => r.relayUrl)
      .filter((relay) => !blocked.has(relay)),
  );

  // Bootstrap determinism: only add discovery relays when the caller did not
  // provide any selected relays. This keeps follow-list ownership scoped to
  // the intended relay set (important for tests and user-visible state).
  const discovery =
    selected.length > 0
      ? []
      : dedupePreserveOrder(
          discoveryRelays
            .map(normalizeRelayUrl)
            .filter((url): url is string => Boolean(url))
            .filter((url) => !blocked.has(url)),
        );

  return { selected, nip65, receiptKind3, discovery };
}

