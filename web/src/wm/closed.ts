// The tabs closed in one workspace, newest last, each with the state it left and where it was, so it can be opened
// again as it was. Kept on this device: a reload does not forget them. Every change starts from what is stored, so
// what another browser tab closed or reset in the same workspace is never written over.
import { kv } from '../shared/storage.ts';
import { viewOf } from '../views/registry.ts';

export type ClosedTab = {
  /** The same across reloads and browser tabs: what Undo asks back for. */
  readonly id: string;
  readonly kind: string;
  readonly state: object;
  readonly pane: string;
  readonly index: number;
  /** Put away together by one reset (or its Undo); such tabs do not count against the tabs closed one by one. */
  readonly batch?: string;
};
export type Closing = Omit<ClosedTab, 'id' | 'batch'>;
export type Closed = {
  push(tab: Closing): ClosedTab;
  /** Puts away a reset's tabs in one write that survives a reload; undefined, changing nothing, when the device has
   * no room. Only then may the tabs' own state go. */
  pushBatch(tabs: readonly Closing[], batch: string): ClosedTab[] | undefined;
  pop(): ClosedTab | undefined;
  /** Whether this entry still waits (not reopened, here or in another browser tab). */
  has(id: string): boolean;
  /** Takes back this very entry (an undone reset); undefined when it has already gone. */
  take(id: string): ClosedTab | undefined;
  size(): number;
};

const CLOSED_MAX = 20; // tabs closed one by one
// Tabs put away by resets that hold nothing typed, oldest first; the latest reset keeps all of its own. One that holds
// something typed is never pushed out: it is what was stored as that tab before the reset, moved, not added.
const BATCH_MAX = 100;
const TYPED = new Set(['text', 'drafts', 'media']);
/** Whether a tab's state holds something typed: a text, a half-typed field, an attachment, an unsent post. */
export function holdsTyped(value: unknown, typed = false): boolean {
  if (typeof value === 'string') return typed && value.trim() !== '';
  if (Array.isArray(value)) return typed ? value.length > 0 : value.some((x) => holdsTyped(x));
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(([k, x]) => holdsTyped(x, typed || TYPED.has(k)));
}
export const closedKey = (space: string): string => `closed:${space}`;

let made = 0;
/** A new entry or batch id, unique on this device. */
export const closedId = (): string =>
  `${Date.now().toString(36)}.${(made++).toString(36)}.${Math.random().toString(36).slice(2, 8)}`;

/** Keeps the latest CLOSED_MAX single closes and BATCH_MAX tabs of resets with nothing typed (see above). */
function bound(list: readonly ClosedTab[]): ClosedTab[] {
  const latest = list.findLast((c) => c.batch)?.batch;
  const spare = (c: ClosedTab): boolean => Boolean(c.batch) && !holdsTyped(c.state);
  let singles = list.filter((c) => !c.batch).length - CLOSED_MAX;
  let grouped = list.filter(spare).length - BATCH_MAX;
  return list.filter((c) => {
    if (!c.batch) return singles-- <= 0;
    if (c.batch === latest || !spare(c) || grouped <= 0) return true;
    grouped--;
    return false;
  });
}

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
  // An entry stored before ids existed gets one by its place; the next write keeps it.
  return bound(
    value.filter(ok).map((c, i) => {
      const id = typeof c.id === 'string' && c.id ? c.id : `old.${i}`;
      const batch = typeof c.batch === 'string' && c.batch ? { batch: c.batch } : {};
      return { id, kind: c.kind, state: c.state, pane: c.pane, index: c.index, ...batch };
    }),
  );
}

/** The closed tabs of `space` (`main1`, `guest3`), read from storage on every call. */
export function createClosed(space: string): Closed {
  const key = closedKey(space);
  const read = (): ClosedTab[] => parseClosed(kv.get(key)); // bound: see `bound`
  const write = (list: readonly ClosedTab[]): void =>
    list.length ? kv.set(key, list) : kv.remove(key);
  return {
    push(tab) {
      const c: ClosedTab = { ...tab, id: closedId() };
      write(bound([...read(), c]));
      return c;
    },
    pushBatch(tabs, batch) {
      const put = tabs.map((tab): ClosedTab => ({ ...tab, id: closedId(), batch }));
      return !put.length || kv.durably(key, bound([...read(), ...put])) ? put : undefined;
    },
    pop() {
      const list = read();
      const tab = list.pop();
      if (tab) write(list);
      return tab;
    },
    has: (id) => read().some((c) => c.id === id),
    take(id) {
      const list = read();
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) return undefined;
      const [tab] = list.splice(i, 1);
      write(list);
      return tab;
    },
    size: () => read().length,
  };
}
