import { getContext, setContext } from 'svelte';
import type { TabSnapshotCoordinator } from './tab-snapshot-coordinator';

const key = Symbol('tab-snapshot-coordinator');

type TabSnapshotCoordinatorContext = {
  current: () => TabSnapshotCoordinator;
};

export function setTabSnapshotCoordinator(
  current: () => TabSnapshotCoordinator,
): void {
  setContext(key, { current });
}

export function getTabSnapshotCoordinator():
  | TabSnapshotCoordinator
  | undefined {
  return getContext<TabSnapshotCoordinatorContext | undefined>(key)?.current();
}
