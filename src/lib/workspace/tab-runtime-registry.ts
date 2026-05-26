import type { TabSnapshotPayload } from './tab-snapshot';

type SnapshotProvider = () => Partial<TabSnapshotPayload>;

const providers = new Map<string, SnapshotProvider>();

export function registerTabRuntimeSnapshot(
  tabId: string,
  provider: SnapshotProvider,
): () => void {
  providers.set(tabId, provider);
  return () => {
    providers.delete(tabId);
  };
}

export function captureRuntimeSnapshot(
  tabId: string,
): Partial<TabSnapshotPayload> | undefined {
  return providers.get(tabId)?.();
}
