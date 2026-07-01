import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayClient } from '../../../src/lib/relays/relay-client';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import type { RelaySnapshot } from '../../../src/lib/relays/types';

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState = 0;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send(data: string): void {
    if (this.readyState !== FakeWebSocket.OPEN)
      throw new Error('socket not open');
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
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
    const client = createRelayClient('wss://relay.example/', {
      state: (snapshot) => states.push(snapshot),
    });

    client.subscribe('x'.repeat(65), [{ kinds: [1] }]);

    expect(sockets).toHaveLength(0);
    expect(states.at(-1)).toMatchObject({
      state: 'error',
      lastError: expect.stringContaining('48 characters'),
    });
    expect(states.at(-1)?.diagnostics.at(-1)).toMatchObject({
      kind: 'invalid-subscription',
    });
  });

  it('does not send CLOSE after the relay has closed the subscription', () => {
    const pool = createRelayPool();
    const unsubscribe = pool.subscribe(['relay.example'], 'sub', [
      { limit: 2 },
    ]);

    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['CLOSED', 'sub', 'blocked']));
    unsubscribe();

    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"limit":2}]']);
  });
});
