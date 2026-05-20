import { describe, expect, it, vi } from 'vitest';
import { defaultRelaySet } from '../../../src/lib/relays/default-relays';
import {
  selectedDefaultRelaySet,
  setDefaultRelaySetId,
} from '../../../src/lib/relays/relay-store';
import {
  initialRelaySubscriptionId,
  maxRelaySubscriptionIdLength,
  olderRelaySubscriptionId,
} from '../../../src/lib/relays/subscription-id';
import {
  createTimelineSubId,
  timelineRelays,
} from '../../../src/lib/timeline/timeline-subscription';

describe('relay selection', () => {
  it('uses only enabled read relays from the selected default set', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    const custom = {
      ...defaultRelaySet,
      id: 'custom',
      relays: [
        { ...defaultRelaySet.relays[0]!, enabled: false },
        { ...defaultRelaySet.relays[1]!, read: false },
        { ...defaultRelaySet.relays[2]!, url: 'wss://read.example' },
      ],
    };
    setDefaultRelaySetId('custom');
    expect(selectedDefaultRelaySet([defaultRelaySet, custom])?.id).toBe(
      'custom',
    );
    expect(timelineRelays([defaultRelaySet, custom])).toEqual([
      'wss://read.example',
    ]);
    vi.unstubAllGlobals();
  });

  it('keeps generated subscription ids under relay limits', () => {
    const home = createTimelineSubId(crypto.randomUUID(), 'tl');
    const global = createTimelineSubId(crypto.randomUUID(), 'global');
    const profile = createTimelineSubId(crypto.randomUUID(), 'profile');
    const thread = createTimelineSubId(crypto.randomUUID(), 'thread');
    const notif = createTimelineSubId(crypto.randomUUID(), 'notif');
    const ids = [
      `${home}:follows`,
      `${home}:notes`,
      `${global}:notes`,
      profile,
      thread,
      notif,
      initialRelaySubscriptionId(
        `${home}:notes`,
        Array.from({ length: 500 }, (_, index) => `${index}`.repeat(64)),
      ),
      olderRelaySubscriptionId(`${global}:notes`, {
        createdAt: 1,
        id: 'a'.repeat(64),
      }),
      olderRelaySubscriptionId(profile, { createdAt: 2, id: 'b'.repeat(64) }),
      olderRelaySubscriptionId(thread, { createdAt: 3, id: 'c'.repeat(64) }),
      olderRelaySubscriptionId(notif, 4),
    ];
    for (const id of ids)
      expect(id.length).toBeLessThanOrEqual(maxRelaySubscriptionIdLength);
  });

  it('keeps relay selection in memory when localStorage is denied', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage',
    );
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied');
      },
    });
    try {
      setDefaultRelaySetId('custom');
      expect(
        selectedDefaultRelaySet([
          defaultRelaySet,
          { ...defaultRelaySet, id: 'custom' },
        ])?.id,
      ).toBe('custom');
    } finally {
      if (descriptor)
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});
