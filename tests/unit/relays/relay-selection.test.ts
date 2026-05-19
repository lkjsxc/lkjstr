import { describe, expect, it, vi } from 'vitest';
import { defaultRelaySet } from '../../../src/lib/relays/default-relays';
import {
  selectedDefaultRelaySet,
  setDefaultRelaySetId,
} from '../../../src/lib/relays/relay-store';
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
    const subId = createTimelineSubId(crypto.randomUUID());
    expect(subId.length).toBeLessThanOrEqual(64);
    expect(`${subId}:follows`.length).toBeLessThanOrEqual(64);
    expect(`${subId}:notes`.length).toBeLessThanOrEqual(64);
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
