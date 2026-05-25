import type { NostrEvent } from '../protocol';
import {
  incMemoryCounter,
  decMemoryCounter,
  setMemoryCounter,
} from '../app/memory-counters';
import type { PublishResult } from './relay-pool';

type PublishWaiter = {
  readonly event: NostrEvent;
  readonly relay: string;
  readonly promise: Promise<PublishResult>;
  readonly resolve: (result: PublishResult) => void;
  readonly timer: ReturnType<typeof setTimeout>;
};

export type RelayPublishWaiters = ReturnType<typeof createRelayPublishWaiters>;

export function createRelayPublishWaiters() {
  const waitersByEvent = new Map<string, Map<string, PublishWaiter>>();

  const remove = (
    eventId: string,
    relay: string,
  ): PublishWaiter | undefined => {
    const waiters = waitersByEvent.get(eventId);
    const waiter = waiters?.get(relay);
    if (!waiters || !waiter) return undefined;
    waiters.delete(relay);
    if (waiters.size === 0) waitersByEvent.delete(eventId);
    clearTimeout(waiter.timer);
    decMemoryCounter('active-timers');
    decMemoryCounter('active-relay-publish-waiters');
    return waiter;
  };

  return {
    begin: (
      event: NostrEvent,
      relay: string,
      timeoutMs: number,
      onTimeout: () => void,
    ): {
      readonly promise: Promise<PublishResult>;
      readonly created: boolean;
    } => {
      const existing = waitersByEvent.get(event.id)?.get(relay);
      if (existing) return { promise: existing.promise, created: false };
      let resolve!: (result: PublishResult) => void;
      const promise = new Promise<PublishResult>((settle) => {
        resolve = settle;
      });
      const waiter: PublishWaiter = {
        event,
        relay,
        promise,
        resolve,
        timer: setTimeout(onTimeout, timeoutMs),
      };
      const waiters = waitersByEvent.get(event.id) ?? new Map();
      waiters.set(relay, waiter);
      waitersByEvent.set(event.id, waiters);
      incMemoryCounter('active-timers');
      incMemoryCounter('active-relay-publish-waiters');
      return { promise, created: true };
    },
    settle: (
      eventId: string,
      relay: string,
      result: PublishResult,
    ): boolean => {
      const waiter = remove(eventId, relay);
      if (!waiter) return false;
      waiter.resolve(result);
      return true;
    },
    pendingEventsForRelay: (relay: string): NostrEvent[] =>
      [...waitersByEvent.values()]
        .map((waiters) => waiters.get(relay)?.event)
        .filter((event): event is NostrEvent => Boolean(event)),
    eventHasWaiters: (eventId: string): boolean => waitersByEvent.has(eventId),
    settleAll: (message: string): void => {
      for (const [eventId, waiters] of [...waitersByEvent.entries()]) {
        for (const relay of [...waiters.keys()]) {
          const result = { relay, accepted: false, message };
          const waiter = remove(eventId, relay);
          waiter?.resolve(result);
        }
      }
      setMemoryCounter('active-relay-publish-waiters', 0);
      setMemoryCounter('active-timers', 0);
    },
    clear: (): void => {
      for (const waiters of waitersByEvent.values())
        for (const waiter of waiters.values()) clearTimeout(waiter.timer);
      waitersByEvent.clear();
      setMemoryCounter('active-relay-publish-waiters', 0);
      setMemoryCounter('active-timers', 0);
    },
  };
}
