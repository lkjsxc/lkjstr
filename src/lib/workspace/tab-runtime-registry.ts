import type { TabSnapshotPayload } from './tab-snapshot';

type SnapshotProvider = () => Partial<TabSnapshotPayload>;

const providers = new Map<string, SnapshotProvider>();
const lastSnapshots = new Map<string, Partial<TabSnapshotPayload>>();

export function registerTabRuntimeSnapshot(
  tabId: string,
  provider: SnapshotProvider,
): () => void {
  providers.set(tabId, provider);
  return () => {
    const last = providers.get(tabId)?.();
    if (last) lastSnapshots.set(tabId, last);
    providers.delete(tabId);
  };
}

export function captureRuntimeSnapshot(
  tabId: string,
): Partial<TabSnapshotPayload> | undefined {
  return providers.get(tabId)?.() ?? lastSnapshots.get(tabId);
}

export function clearRuntimeSnapshot(tabId: string): void {
  lastSnapshots.delete(tabId);
}
