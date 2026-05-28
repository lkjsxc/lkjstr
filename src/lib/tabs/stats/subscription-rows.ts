import type {
  RelaySessionStats,
  RelaySnapshot,
  RelaySubscriptionDescriptor,
} from '$lib/relays/types';

export type StatsSubscriptionRow = RelaySubscriptionDescriptor & {
  readonly key: string;
  readonly relay: string;
  readonly shortId: string;
};

export function relaySubscriptionRows(
  snapshots: readonly RelaySnapshot[],
): StatsSubscriptionRow[] {
  return snapshots.flatMap((snapshot) =>
    descriptors(stats(snapshot)).map((item) => ({
      ...item,
      relay: snapshot.url,
      key: `${snapshot.url}:${item.id}`,
      shortId: shortSubscriptionId(item.id),
    })),
  );
}

function descriptors(
  stats: RelaySessionStats,
): readonly RelaySubscriptionDescriptor[] {
  if (stats.activeSubscriptionDescriptors.length > 0)
    return stats.activeSubscriptionDescriptors;
  return stats.activeSubscriptionIds.map((id) => ({
    id,
    label: 'Relay subscription',
  }));
}

function stats(snapshot: RelaySnapshot): RelaySessionStats {
  return (
    snapshot.stats ?? {
      receivedBytes: 0,
      sentBytes: 0,
      eventCount: 0,
      eoseCount: 0,
      noticeCount: 0,
      authCount: 0,
      closedCount: 0,
      okAcceptedCount: 0,
      okRejectedCount: 0,
      parseErrorCount: 0,
      activeSubscriptionIds: [],
      activeSubscriptionDescriptors: [],
    }
  );
}

function shortSubscriptionId(id: string): string {
  return id.length > 24 ? `${id.slice(0, 24)}...` : id;
}
