import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { flattenRelayDiagnostics } from '../../../src/lib/relays/session-snapshots';
import type { RelaySnapshot } from '../../../src/lib/relays/types';

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.({} as CloseEvent);
  }

  open(): void {
    this.onopen?.({} as Event);
  }

  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('relay pool session snapshots', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05Z'));
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps relay snapshots for the current session after close', () => {
    const pool = createRelayPool();

    pool.subscribe(['relay.example'], 'sub', [{ limit: 2 }]);
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['CLOSED', 'sub', 'blocked']));
    pool.close();

    expect(pool.snapshots()).toEqual([
      expect.objectContaining({
        url: 'wss://relay.example/',
        state: 'closed',
        diagnostics: [
          expect.objectContaining({ kind: 'closed', message: 'blocked' }),
        ],
      }),
    ]);
  });

  it('evicts idle relay clients after subscriptions close', () => {
    const pool = createRelayPool(5000, 50);
    const stop = pool.subscribe(['relay.example'], 'sub', [{ limit: 2 }]);
    expect(pool.__debugClientCount()).toBe(1);

    sockets[0]?.open();
    stop();
    vi.advanceTimersByTime(49);
    expect(pool.__debugClientCount()).toBe(1);

    vi.advanceTimersByTime(1);
    expect(pool.__debugClientCount()).toBe(0);
    expect(pool.snapshots()).toEqual([
      expect.objectContaining({
        url: 'wss://relay.example/',
        state: 'closed',
      }),
    ]);
  });

  it('bounds relay snapshot history', () => {
    const pool = createRelayPool();
    for (let index = 0; index < 105; index += 1) {
      pool.subscribe([`relay-${index}.example`], `sub-${index}`, [
        { limit: 1 },
      ]);
    }

    pool.close();
    const snapshots = pool.snapshots();
    expect(snapshots).toHaveLength(100);
    expect(snapshots[0]?.url).toBe('wss://relay-5.example/');
  });

  it('flattens relay diagnostics chronologically with metadata', () => {
    const diagnostics = flattenRelayDiagnostics([
      snapshot('wss://b.example/', 20, 'b', 'sub-b'),
      snapshot('wss://a.example/', 10, 'a'),
    ]);
    expect(diagnostics).toEqual([
      expect.objectContaining({ relay: 'wss://a.example/', message: 'a' }),
      expect.objectContaining({
        relay: 'wss://b.example/',
        message: 'b',
        subId: 'sub-b',
      }),
    ]);
  });
});

function snapshot(
  relay: string,
  timestamp: number,
  message: string,
  subId?: string,
): RelaySnapshot {
  return {
    url: relay,
    state: 'open',
    validation: {
      validEventCount: 0,
      invalidEventCount: 0,
      invalidSubscriptionCount: 0,
    },
    eoseBySub: {},
    closedBySub: {},
    diagnostics: [{ relay, timestamp, message, subId, kind: 'notice' }],
  };
}
