import { createBoundedMap, type BoundedMap } from '../fp/bounded-map';
import type { RelayDiagnostic, RelaySnapshot } from './types';

const maxRelaySnapshots = 100;

type RelaySnapshotWindow = Window & {
  __lkjstrRelaySnapshotHistory?: BoundedMap<string, RelaySnapshot>;
};

export function relaySnapshotHistoryMap(): BoundedMap<string, RelaySnapshot> {
  if (typeof window === 'undefined')
    return createBoundedMap<string, RelaySnapshot>({
      maxSize: maxRelaySnapshots,
    });
  const global = window as RelaySnapshotWindow;
  global.__lkjstrRelaySnapshotHistory ??= createBoundedMap<
    string,
    RelaySnapshot
  >({ maxSize: maxRelaySnapshots });
  return global.__lkjstrRelaySnapshotHistory;
}

export function relaySnapshotHistorySizeForTests(): number {
  return relaySnapshotHistoryMap().size();
}

export function currentRelaySnapshots(): RelaySnapshot[] {
  return [...relaySnapshotHistoryMap().values()];
}

export function flattenRelayDiagnostics(
  snapshots: readonly RelaySnapshot[],
): RelayDiagnostic[] {
  return snapshots
    .flatMap((snapshot) => snapshot.diagnostics)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function startRelaySnapshotPolling(
  setSnapshots: (snapshots: RelaySnapshot[]) => void,
): () => void {
  const refresh = () => setSnapshots(currentRelaySnapshots());
  const timer = setInterval(refresh, 250);
  refresh();
  return () => clearInterval(timer);
}
