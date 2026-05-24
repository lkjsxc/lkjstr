import { writable, type Writable } from 'svelte/store';
import type { TabDropZone } from './tab-drop-zone';

export type TabDragTarget = {
  readonly paneId: string;
  readonly zone: TabDropZone;
};

export type TabDragState = {
  readonly target: Writable<TabDragTarget | undefined>;
  readonly setTarget: (target?: TabDragTarget) => void;
};

export const tabDragStateKey = Symbol('tab-drag-state');

export function createTabDragState(): TabDragState {
  const target = writable<TabDragTarget | undefined>();
  return { target, setTarget: (next) => target.set(next) };
}
