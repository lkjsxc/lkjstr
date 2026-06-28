import { describe, expect, it } from 'vitest';
import { createEventTreeListNearEndSentinel } from '../../../src/lib/components/events/event-tree-list-near-end-sentinel';
import type { CreateEventTreeListNearEndObserver } from '../../../src/lib/components/events/event-tree-list-near-end-sentinel';

type FakeObserver = {
  readonly disconnects: string[];
  readonly observed: Element[];
  callback: IntersectionObserverCallback;
};

const root = {} as Element;
const sentinel = {} as Element;

describe('event tree list near-end sentinel owner', () => {
  it('observes the current sentinel and disconnects replaced observers', () => {
    const observers: FakeObserver[] = [];
    const owner = createEventTreeListNearEndSentinel({
      root: () => root,
      sentinel: () => sentinel,
      rootMargin: () => '1200px',
      enabled: () => true,
      onNearEnd: () => undefined,
      createObserver: fakeObserver(observers),
    });

    owner.observe();
    owner.observe();
    owner.disconnect();

    expect(observers).toHaveLength(2);
    expect(observers[0]?.disconnects).toEqual(['disconnect']);
    expect(observers[1]?.disconnects).toEqual(['disconnect']);
    expect(observers[1]?.observed).toEqual([sentinel]);
  });

  it('does not create observers while disabled or missing elements', () => {
    const observers: FakeObserver[] = [];
    const owner = createEventTreeListNearEndSentinel({
      root: () => root,
      sentinel: () => sentinel,
      rootMargin: () => '1200px',
      enabled: () => false,
      onNearEnd: () => undefined,
      createObserver: fakeObserver(observers),
    });
    const missing = createEventTreeListNearEndSentinel({
      root: () => undefined,
      sentinel: () => sentinel,
      rootMargin: () => '1200px',
      enabled: () => true,
      onNearEnd: () => undefined,
      createObserver: fakeObserver(observers),
    });

    owner.observe();
    missing.observe();

    expect(observers).toEqual([]);
  });

  it('dedupes intersecting callbacks while one is in flight', async () => {
    const observers: FakeObserver[] = [];
    let calls = 0;
    let release: () => void = () => undefined;
    const owner = createEventTreeListNearEndSentinel({
      root: () => root,
      sentinel: () => sentinel,
      rootMargin: () => '1200px',
      enabled: () => true,
      onNearEnd: () =>
        new Promise<void>((resolve) => {
          calls += 1;
          release = resolve;
        }),
      createObserver: fakeObserver(observers),
    });

    owner.observe();
    observers[0]?.callback([entry(true)], {} as IntersectionObserver);
    observers[0]?.callback([entry(true)], {} as IntersectionObserver);
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    await flushAsync();
    observers[0]?.callback([entry(true)], {} as IntersectionObserver);
    await Promise.resolve();
    expect(calls).toBe(2);
  });
});

function fakeObserver(
  observers: FakeObserver[],
): CreateEventTreeListNearEndObserver {
  return (callback, options) => {
    const observer: FakeObserver = {
      callback,
      disconnects: [],
      observed: [],
    };
    expect(options.root).toBe(root);
    expect(options.rootMargin).toBe('1200px');
    observers.push(observer);
    return {
      observe: (target) => observer.observed.push(target),
      disconnect: () => observer.disconnects.push('disconnect'),
    };
  };
}

function entry(isIntersecting: boolean): IntersectionObserverEntry {
  return { isIntersecting } as IntersectionObserverEntry;
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
