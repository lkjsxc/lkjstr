import { feedWindowSize } from '$lib/events/feed-window';
import { readRelayPage } from '$lib/events/relay-page';
import { profileFromMetadataEvent } from '$lib/identity/profile-cache';
import type { ProfileSummary } from '$lib/identity/identity';
import type { NostrEvent } from '$lib/protocol';
import type { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
import { storeProfileEvent } from './profile-store';

type Request = {
  readonly posts: readonly NostrEvent[];
  readonly profile: ProfileSummary | null;
  readonly relays: readonly string[];
  readonly pubkey: string;
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: RelaySubscriptionManager;
};

export async function loadInitialProfilePage(request: Request) {
  const relayEvents = await readRelayPage({
    key: `${request.subId}:initial`,
    relays: request.relays,
    filters: [
      { kinds: [0], authors: [request.pubkey], limit: 1 },
      { kinds: [1], authors: [request.pubkey], limit: request.pageSize },
    ],
    pageSize: request.pageSize + 1,
    subscriptions: request.subscriptions,
  });
  await Promise.all(
    relayEvents.map((item) => storeProfileEvent(item.event, [item.relay])),
  );
  const meta = relayEvents.find((item) => item.event.kind === 0);
  return {
    profile: meta ? profileFromMetadataEvent(meta.event) : request.profile,
    posts: mergePosts(
      request.posts,
      relayEvents.map((item) => item.event),
    ),
    relays: [...new Set(relayEvents.map((item) => item.relay))],
  };
}

function mergePosts(
  current: readonly NostrEvent[],
  incoming: readonly NostrEvent[],
): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of [...current, ...incoming]) {
    if (event.kind === 1) byId.set(event.id, event);
  }
  return [...byId.values()]
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, feedWindowSize);
}
