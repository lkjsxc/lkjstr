import type { NostrEvent } from '$lib/protocol';
import { upsertEvent } from '$lib/events/repository';
import { cachedProfileFollowList } from '$lib/profile/profile-store';
import { saveAuthorRelayRoutes } from '$lib/relays/relay-route-store';

export async function loadCachedTargetFollowList(
  targetPubkey: string,
  seedEventId?: string,
): Promise<NostrEvent | undefined> {
  const cached = await cachedProfileFollowList(targetPubkey);
  if (!seedEventId) return cached;
  return cached?.id === seedEventId ? cached : cached;
}

export async function storeTargetFollowList(
  event: NostrEvent,
  relayUrls: readonly string[],
): Promise<void> {
  await upsertEvent(event, relayUrls);
  await saveAuthorRelayRoutes(
    relayUrls.map((relayUrl) => ({
      authorPubkey: event.pubkey,
      relayUrl,
      source: 'nip02' as const,
      purpose: 'read' as const,
      eventId: event.id,
    })),
  );
}

export function newestFollowList(
  a: NostrEvent | undefined,
  b: NostrEvent | undefined,
): NostrEvent | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.created_at !== b.created_at) return a.created_at > b.created_at ? a : b;
  return a.id <= b.id ? a : b;
}
