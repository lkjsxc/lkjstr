import { kinds, type NostrEvent } from '../protocol';
import type { RelayRoute, RelayRoutePurpose } from './relay-route-types';
import { saveAuthorRelayRoutes } from './relay-route-store';

export async function storeRoutesFromEvent(
  event: NostrEvent,
  relayUrls: readonly string[],
): Promise<void> {
  const inputs: Omit<RelayRoute, 'id' | 'updatedAt'>[] = [];
  if (event.kind === kinds.relayListMetadata)
    inputs.push(...nip65RouteInputs(event));
  if (event.kind === kinds.followList) inputs.push(...nip02RouteInputs(event));
  inputs.push(...receiptRouteInputs(event, relayUrls));
  await saveAuthorRelayRoutes(inputs);
}

function nip65RouteInputs(
  event: NostrEvent,
): Omit<RelayRoute, 'id' | 'updatedAt'>[] {
  return event.tags
    .filter((tag) => tag[0] === 'r' && tag[1])
    .map((tag) => ({
      authorPubkey: event.pubkey,
      relayUrl: tag[1],
      source: 'nip65' as const,
      purpose: nip65Purpose(tag[2]),
      eventId: event.id,
    }));
}

function nip02RouteInputs(
  event: NostrEvent,
): Omit<RelayRoute, 'id' | 'updatedAt'>[] {
  return event.tags
    .filter((tag) => tag[0] === 'p' && tag[1] && tag[2])
    .map((tag) => ({
      authorPubkey: tag[1],
      relayUrl: tag[2],
      source: 'nip02' as const,
      purpose: 'write' as const,
      eventId: event.id,
    }));
}

function receiptRouteInputs(
  event: NostrEvent,
  relayUrls: readonly string[],
): Omit<RelayRoute, 'id' | 'updatedAt'>[] {
  return relayUrls.map((relayUrl) => ({
    authorPubkey: event.pubkey,
    relayUrl,
    source: 'event-receipt' as const,
    purpose: 'write' as const,
    eventId: event.id,
  }));
}

function nip65Purpose(marker: string | undefined): RelayRoutePurpose {
  if (marker === 'read') return 'read';
  if (marker === 'write') return 'write';
  return 'both';
}
