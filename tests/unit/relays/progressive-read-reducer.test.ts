import { describe, expect, it } from 'vitest';
import {
  initialProgressiveRead,
  progressiveReadSnapshot,
  reduceProgressiveRead,
} from '../../../src/lib/relays/progressive-read-reducer';
import { eventRelays } from '../../../src/lib/relays/progressive-read-provenance';
import type { ReadPageRelayStatus } from '../../../src/lib/relays/read-page-status';
import type { PoolEvent } from '../../../src/lib/relays/relay-pool';

describe('progressive read reducer', () => {
  it('moves from idle through partial to complete', () => {
    let state = initialProgressiveRead({
      readId: 'read-1',
      relays: ['wss://a.example/', 'wss://b.example/'],
      startedAt: 1,
    });
    expect(state.status).toBe('idle');

    state = reduceProgressiveRead(state, {
      type: 'relay-events',
      events: [poolEvent('wss://a.example/', 'b'.repeat(64), 20)],
    });
    expect(state.status).toBe('partial');

    state = reduceProgressiveRead(state, {
      type: 'finalize',
      statuses: [
        status('wss://a.example/', { eose: true, finalCount: 1 }),
        status('wss://b.example/', { eose: true }),
      ],
    });
    const snapshot = progressiveReadSnapshot(state, 'final', 10);
    expect(snapshot.status).toBe('complete');
    expect(snapshot.final).toBe(true);
  });

  it('merges duplicate event provenance with deterministic ordering', () => {
    let state = initialProgressiveRead({
      readId: 'read-2',
      relays: ['wss://a.example/', 'wss://b.example/'],
    });
    const id = 'c'.repeat(64);
    state = reduceProgressiveRead(state, {
      type: 'relay-events',
      events: [
        poolEvent('wss://a.example/', id, 10),
        poolEvent('wss://b.example/', id, 10),
        poolEvent('wss://b.example/', 'a'.repeat(64), 11),
      ],
    });
    expect(state.events.map((item) => item.event.id)).toEqual([
      'a'.repeat(64),
      id,
    ]);
    expect(eventRelays(state.events, id)).toEqual([
      'wss://a.example/',
      'wss://b.example/',
    ]);
  });

  it('marks timeout incomplete and ignores post-cancel evidence', () => {
    let state = initialProgressiveRead({
      readId: 'read-3',
      relays: ['wss://a.example/'],
    });
    state = reduceProgressiveRead(state, {
      type: 'relay-events',
      events: [poolEvent('wss://a.example/', 'd'.repeat(64), 1)],
    });
    state = reduceProgressiveRead(state, {
      type: 'finalize',
      statuses: [status('wss://a.example/', { timeout: true, finalCount: 1 })],
    });
    expect(state.status).toBe('incomplete');

    const cancelled = reduceProgressiveRead(state, { type: 'cancel' });
    const after = reduceProgressiveRead(cancelled, {
      type: 'relay-events',
      events: [poolEvent('wss://a.example/', 'e'.repeat(64), 2)],
    });
    expect(after.status).toBe('cancelled');
    expect(after.events).toHaveLength(1);
  });
});

function poolEvent(relay: string, id: string, created_at: number): PoolEvent {
  return {
    relay,
    subId: 'sub',
    event: {
      id,
      pubkey: 'f'.repeat(64),
      created_at,
      kind: 1,
      tags: [],
      content: id,
      sig: '0'.repeat(128),
    },
  };
}

function status(
  relay: string,
  patch: Partial<ReadPageRelayStatus>,
): ReadPageRelayStatus {
  return {
    relay,
    eose: false,
    timeout: false,
    closed: false,
    auth: false,
    socketClosed: false,
    socketError: false,
    durationMs: 1,
    candidateCount: patch.finalCount ?? 0,
    finalCount: 0,
    ...patch,
  };
}
