import { appendAppLog, boundedMessage } from '../log/app-log';
import type { PoolEvent } from './relay-pool';
import type { RelaySnapshot } from './types';

export type SubscriptionListener = (event: PoolEvent) => void;

export type SubscriptionEntry = {
  readonly subId: string;
  readonly key: string;
  readonly listeners: Set<SubscriptionListener>;
  readonly cleanup: () => void;
};

export function safeNotify(
  listener: SubscriptionListener,
  event: PoolEvent,
  subId: string,
): void {
  try {
    void Promise.resolve(listener(event)).catch((error) =>
      logListenerFailure(error, subId, event.relay),
    );
  } catch (error) {
    logListenerFailure(error, subId, event.relay);
  }
}

export function normalizeSnapshots(
  snapshots: readonly RelaySnapshot[],
  entries: readonly SubscriptionEntry[],
): RelaySnapshot[] {
  const logicalByRelay = new Map(entries.map((entry) => [entry.subId, entry]));
  return snapshots.map((snapshot) => {
    const eoseBySub = { ...snapshot.eoseBySub };
    const closedBySub = { ...snapshot.closedBySub };
    for (const [relaySubId, entry] of logicalByRelay) {
      if (snapshot.eoseBySub[relaySubId]) eoseBySub[entry.key] = true;
      if (snapshot.closedBySub[relaySubId])
        closedBySub[entry.key] = snapshot.closedBySub[relaySubId];
    }
    return { ...snapshot, eoseBySub, closedBySub };
  });
}

function logListenerFailure(
  error: unknown,
  subId: string,
  relay: string,
): void {
  appendAppLog({
    area: 'subscription',
    severity: 'error',
    code: 'listener-failed',
    message: boundedMessage(error),
    context: { subId, relay },
  });
}
