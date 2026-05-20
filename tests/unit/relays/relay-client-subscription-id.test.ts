import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayClient } from '../../../src/lib/relays/relay-client';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import type { RelaySnapshot } from '../../../src/lib/relays/types';

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.onopen?.({} as Event);
  }

  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('relay subscription id guards', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('rejects overlong subscription ids without sending to the relay', () => {
    const states: RelaySnapshot[] = [];
    const client = new RelayClient('wss://relay.example/', {
      state: (snapshot) => states.push(snapshot),
    });

    client.subscribe('x'.repeat(65), [{ kinds: [1] }]);

    expect(sockets).toHaveLength(0);
    expect(states.at(-1)).toMatchObject({
      state: 'error',
      lastError: expect.stringContaining('64 characters'),
    });
    expect(states.at(-1)?.diagnostics.at(-1)).toMatchObject({
      kind: 'invalid-subscription',
    });
  });

  it('does not send CLOSE after the relay has closed the subscription', () => {
    const pool = new RelayPool();
    const unsubscribe = pool.subscribe(['relay.example'], 'sub', [
      { limit: 2 },
    ]);

    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['CLOSED', 'sub', 'blocked']));
    unsubscribe();

    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"limit":2}]']);
  });
});
