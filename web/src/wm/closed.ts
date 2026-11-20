// The tabs closed in one workspace, newest last, each with the state it left and where it was, so the last one can
// be opened again as it was. Kept on this device: a reload does not forget them.
import { kv } from '../shared/storage.ts';
import { viewOf } from '../views/registry.ts';

export type ClosedTab = {
  readonly kind: string;
  readonly state: object;
  readonly pane: string;
  readonly index: number;
};
export type Closed = {
  push(tab: ClosedTab): void;
  pop(): ClosedTab | undefined;
  /** Takes back this very entry (an undone reset); false when it has already gone. */
  take(tab: ClosedTab): boolean;
  size(): number;
};

const CLOSED_MAX = 20;
export const closedKey = (space: string): string => `closed:${space}`;

/** What is stored, as far as it can still be opened (a kind that no longer exists is dropped). */
export function parseClosed(value: unknown): ClosedTab[] {
  if (!Array.isArray(value)) return [];
  const ok = (c: unknown): c is ClosedTab => {
    const x = c as Partial<ClosedTab> | null;
    return (
      typeof x === 'object' &&
      x !== null &&
      typeof x.kind === 'string' &&
      Boolean(viewOf(x.kind)) &&
      typeof x.state === 'object' &&
      x.state !== null &&
      typeof x.pane === 'string' &&
      typeof x.index === 'number' &&
      Number.isInteger(x.index) &&
      x.index >= 0
    );
  };
  return value.filter(ok).slice(-CLOSED_MAX);
}

export function createClosed(space: string): Closed {
  const key = closedKey(space);
  const list = parseClosed(kv.get(key)); // bound: CLOSED_MAX
  const write = (): void => (list.length ? kv.set(key, list) : kv.remove(key));
  return {
    push(tab) {
      list.push(tab);
      if (list.length > CLOSED_MAX) list.shift();
      write();
    },
    pop() {
      const tab = list.pop();
      write();
      return tab;
    },
    take(tab) {
      const i = list.lastIndexOf(tab);
      if (i < 0) return false;
      list.splice(i, 1);
      write();
      return true;
    },
    size: () => list.length,
  };
}
