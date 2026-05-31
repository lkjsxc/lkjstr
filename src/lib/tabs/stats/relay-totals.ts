import type { RelaySessionStats, RelaySnapshot } from '$lib/relays/types';

export function totalStats(items: readonly RelaySnapshot[]) {
  return items.reduce(
    (sum, item) => ({
      relays: sum.relays + 1,
      open: sum.open + (item.state === 'open' ? 1 : 0),
      events: sum.events + stats(item).eventCount,
      bytes: sum.bytes + stats(item).receivedBytes + stats(item).sentBytes,
      ok: sum.ok + stats(item).okAcceptedCount,
      rejected: sum.rejected + stats(item).okRejectedCount,
      subs: sum.subs + stats(item).activeSubscriptionIds.length,
    }),
    { relays: 0, open: 0, events: 0, bytes: 0, ok: 0, rejected: 0, subs: 0 },
  );
}

export function stats(snapshot: RelaySnapshot): RelaySessionStats {
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
