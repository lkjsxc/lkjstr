import type { RelaySet } from '../../relays/relay-types';
import { browserDb } from '../browser-db';
import { bestEffortStorageWrite, boundedStorageRead } from '../safe-storage';

export async function readRelaySetRows(
  fallback: RelaySet[],
): Promise<RelaySet[]> {
  return boundedStorageRead(
    () =>
      browserDb().relaySets.orderBy('updatedAt').reverse().limit(100).toArray(),
    fallback,
  );
}

export async function putRelaySetRows(
  relaySets: readonly RelaySet[],
): Promise<void> {
  await bestEffortStorageWrite(() =>
    browserDb().relaySets.bulkPut([...relaySets]),
  );
}
