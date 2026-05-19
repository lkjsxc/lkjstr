import type { RelaySnapshot } from './types';

type RelaySnapshotWindow = Window & {
  __lkjstrRelaySnapshotHistory?: Map<string, RelaySnapshot>;
};

export function relaySnapshotHistoryMap(): Map<string, RelaySnapshot> {
  if (typeof window === 'undefined') return new Map<string, RelaySnapshot>();
  const global = window as RelaySnapshotWindow;
  global.__lkjstrRelaySnapshotHistory ??= new Map<string, RelaySnapshot>();
  return global.__lkjstrRelaySnapshotHistory;
}

export function currentRelaySnapshots(): RelaySnapshot[] {
  return [...relaySnapshotHistoryMap().values()];
}

export function startRelaySnapshotPolling(
  setSnapshots: (snapshots: RelaySnapshot[]) => void,
): () => void {
  const refresh = () => setSnapshots(currentRelaySnapshots());
  const timer = setInterval(refresh, 250);
  refresh();
  return () => clearInterval(timer);
}
