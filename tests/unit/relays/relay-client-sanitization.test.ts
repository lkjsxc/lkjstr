import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrFilter } from '../../../src/lib/protocol';
import { createRelayClient } from '../../../src/lib/relays/relay-client';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
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
}

describe('relay client sanitization', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sanitizes relay pool subscriptions before encoding REQ messages', () => {
    const pool = createRelayPool();

    pool.subscribe(['relay.example'], 'sub', [
      { kinds: [1], depth: 1, span: 10, '#e': ['a'] } as unknown as NostrFilter,
    ]);

    sockets[0]?.open();
    expect(JSON.parse(sockets[0]?.sent[0] ?? '[]')).toEqual([
      'REQ',
      'sub',
      { kinds: [1], '#e': ['a'] },
    ]);
  });

  it('sanitizes direct relay client subscriptions before encoding REQ messages', () => {
    const client = createRelayClient('wss://relay.example/');

    client.subscribe('sub', [
      { kinds: [1], reason: 'dense', attempt: 4 } as unknown as NostrFilter,
    ]);

    sockets[0]?.open();
    expect(JSON.parse(sockets[0]?.sent[0] ?? '[]')).toEqual([
      'REQ',
      'sub',
      { kinds: [1] },
    ]);
  });
});
