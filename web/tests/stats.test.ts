import { describe, expect, it } from 'vitest';
import type { EngineStats } from '../src/engine/protocol.ts';
import { bytesText, relayMark, sortRelays } from '../src/views/stats.ts';

type Relay = EngineStats['relays'][number];
const relay = (url: string, over: Partial<Relay> = {}): Relay => ({
  url,
  state: 'connected',
  connectedSince: 1,
  eventsReceived: 10,
  duplicatesDropped: 0,
  openSubscriptions: 1,
  bytesIn: 0,
  bytesOut: 0,
  lastError: null,
  latencyMs: 50,
  ...over,
});

describe('stats', () => {
  it('marks a relay that fails, sends nothing, or answers slowly', () => {
    expect(relayMark(relay('a'))).toBeUndefined();
    expect(relayMark(relay('a', { state: 'waiting', lastError: 'refused' }))).toBe('failing');
    expect(relayMark(relay('a', { state: 'failed' }))).toBe('failing');
    expect(relayMark(relay('a', { eventsReceived: 0 }))).toBe('silent');
    expect(relayMark(relay('a', { eventsReceived: 0, openSubscriptions: 0 }))).toBeUndefined();
    expect(relayMark(relay('a', { latencyMs: 2400 }))).toBe('slow');
    expect(relayMark(relay('a', { latencyMs: null }))).toBeUndefined();
    expect(relayMark(relay('a', { state: 'connecting', eventsReceived: 0 }))).toBeUndefined();
  });

  it('sorts trouble first, then by what was received; a missing figure is last either way', () => {
    const all = [
      relay('wss://fine', { eventsReceived: 5 }),
      relay('wss://busy', { eventsReceived: 900 }),
      relay('wss://slow', { latencyMs: 3000 }),
      relay('wss://down', { state: 'waiting', latencyMs: null, eventsReceived: 0 }),
      relay('wss://mute', { eventsReceived: 0, latencyMs: 20 }),
    ];
    const order = (by: Parameters<typeof sortRelays>[1]['by'], up = false): string[] =>
      sortRelays(all, { by, up }).map((r) => r.url.slice(6));
    expect(order('health')).toEqual(['down', 'mute', 'slow', 'busy', 'fine']);
    expect(order('events')).toEqual(['busy', 'slow', 'fine', 'down', 'mute']);
    expect(order('latency')).toEqual(['slow', 'busy', 'fine', 'mute', 'down']);
    expect(order('latency', true)).toEqual(['mute', 'busy', 'fine', 'slow', 'down']);
  });

  it('writes sizes in decimal units', () => {
    expect(bytesText(0)).toBe('0 B');
    expect(bytesText(999)).toBe('999 B');
    expect(bytesText(1234)).toBe('1.2 kB');
    expect(bytesText(308_000)).toBe('308 kB');
    expect(bytesText(8_420_000)).toBe('8.4 MB');
  });
});
