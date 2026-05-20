import { compareEventsDesc, type NostrEvent } from '../protocol';
import type { FeedCursorPoint, FeedEvent } from './types';

export const feedPageSize = 30;
export const feedWindowSize = 180;
export const threadWindowSize = 240;
export const nearEndPixels = 900;
export const metadataPageLimit = 30;

export type WindowedFeed<T> = {
  readonly items: T[];
  readonly prunedNewer: boolean;
  readonly prunedOlder: boolean;
};

export type FeedWindowSnapshot<T> = WindowedFeed<T> & {
  readonly newestCursor?: FeedCursorPoint;
  readonly oldestCursor?: FeedCursorPoint;
};

export class FeedWindow<T extends { event: NostrEvent }> {
  readonly #items = new Map<string, T>();

  constructor(
    readonly limit = feedWindowSize,
    private readonly compare = compareFeedItems<T>,
  ) {}

  merge(
    incoming: readonly T[],
    options: { readonly keepOlder?: boolean } = {},
  ): FeedWindowSnapshot<T> {
    for (const item of incoming) {
      const existing = this.#items.get(item.event.id);
      this.#items.set(
        item.event.id,
        existing ? this.#merge(existing, item) : item,
      );
    }
    return this.#prune(Boolean(options.keepOlder));
  }

  replace(items: readonly T[]): FeedWindowSnapshot<T> {
    this.#items.clear();
    return this.merge(items);
  }

  items(): T[] {
    return [...this.#items.values()].sort(this.compare);
  }

  #prune(keepOlder: boolean): FeedWindowSnapshot<T> {
    const ordered = this.items();
    const prunedNewer = ordered.length > this.limit && keepOlder;
    const prunedOlder = ordered.length > this.limit && !keepOlder;
    const kept =
      ordered.length <= this.limit
        ? ordered
        : keepOlder
          ? ordered.slice(-this.limit)
          : ordered.slice(0, this.limit);
    this.#items.clear();
    kept.forEach((item) => this.#items.set(item.event.id, item));
    return { items: kept, prunedNewer, prunedOlder, ...boundaryCursors(kept) };
  }

  #merge(existing: T, incoming: T): T {
    const relays = relayArray(existing, incoming);
    const event =
      this.compare(existing, incoming) <= 0 ? existing.event : incoming.event;
    return relays ? ({ ...incoming, event, relays } as T) : incoming;
  }
}

export function mergeFeedWindow(
  existing: readonly FeedEvent[],
  incoming: readonly FeedEvent[],
  windowSize = feedWindowSize,
  keepOlder = false,
): WindowedFeed<FeedEvent> {
  const items = mergeFeedItems(existing, incoming);
  if (items.length <= windowSize)
    return { items, prunedNewer: false, prunedOlder: false };
  return keepOlder
    ? { items: items.slice(-windowSize), prunedNewer: true, prunedOlder: false }
    : {
        items: items.slice(0, windowSize),
        prunedNewer: false,
        prunedOlder: true,
      };
}

export function mergeFeedItems(
  a: readonly FeedEvent[],
  b: readonly FeedEvent[],
): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()].sort((left, right) =>
    compareEventsDesc(left.event, right.event),
  );
}

export function oldestCreatedAt(
  items: readonly { event: NostrEvent }[],
): number | undefined {
  return items.at(-1)?.event.created_at;
}

export function cursorPoint(
  item: { event: NostrEvent } | undefined,
): FeedCursorPoint | undefined {
  if (!item) return undefined;
  return { createdAt: item.event.created_at, id: item.event.id };
}

export function boundaryCursors(items: readonly { event: NostrEvent }[]): {
  newestCursor?: FeedCursorPoint;
  oldestCursor?: FeedCursorPoint;
} {
  return {
    newestCursor: cursorPoint(items.at(0)),
    oldestCursor: cursorPoint(items.at(-1)),
  };
}

export function isNearEnd(
  scrollOffset: number,
  viewportSize: number,
  scrollSize: number,
  threshold = nearEndPixels,
): boolean {
  return scrollOffset + viewportSize >= scrollSize - threshold;
}

export function isNearStart(
  scrollOffset: number,
  threshold = nearEndPixels,
): boolean {
  return scrollOffset <= threshold;
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}

function compareFeedItems<T extends { event: NostrEvent }>(a: T, b: T): number {
  return compareEventsDesc(a.event, b.event);
}

function relayArray<T>(a: T, b: T): string[] | undefined {
  const left = (a as { relays?: readonly string[] }).relays;
  const right = (b as { relays?: readonly string[] }).relays;
  return left && right ? [...new Set([...left, ...right])] : undefined;
}
