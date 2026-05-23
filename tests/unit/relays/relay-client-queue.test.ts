import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayClient } from '../../../src/lib/relays/relay-client';

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
}

describe('relay client send queue', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('records a diagnostic when pending sends overflow', () => {
    const client = new RelayClient('wss://relay.example/');

    for (let index = 0; index < 65; index++)
      client.subscribe(`sub-${index}`, [{ kinds: [1] }]);

    expect(client.snapshot().diagnostics.at(-1)).toMatchObject({
      kind: 'send-queue-full',
      message: 'send queue full',
    });
  });
});
