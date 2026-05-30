import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayClient } from '../../../src/lib/relays/relay-client';
import { fetchRelayInformation } from '../../../src/lib/relays/relay-info';

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
    const client = createRelayClient('wss://relay.example/');

    for (let index = 0; index < 65; index++)
      client.subscribe(`sub-${index}`, [{ kinds: [1] }]);

    expect(client.snapshot().diagnostics.at(-1)).toMatchObject({
      kind: 'send-queue-full',
      message: 'send queue full',
    });
  });

  it('queues subscriptions above the relay max_subscriptions limit', async () => {
    await relayInfo('wss://limited.example/', { max_subscriptions: 1 });
    const client = createRelayClient('wss://limited.example/');

    client.subscribe('first', [{ kinds: [1] }], { strategy: 'backward' });
    client.subscribe('second', [{ kinds: [1] }]);
    sockets[0]?.open();

    expect(sockets[0]?.sent).toEqual(['["REQ","first",{"kinds":[1]}]']);
    client.closeSubscription('first');
    expect(sockets[0]?.sent).toContain('["REQ","second",{"kinds":[1]}]');
  });

  it('clamps filter limits from NIP-11 max_limit', async () => {
    await relayInfo('wss://limit.example/', { max_limit: 3 });
    const client = createRelayClient('wss://limit.example/');

    client.subscribe('sub', [{ kinds: [1], limit: 20 }]);
    sockets[0]?.open();

    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"kinds":[1],"limit":3}]']);
  });

  it('rejects oversized REQ messages without splitting', async () => {
    await relayInfo('wss://small.example/', { max_message_length: 10 });
    const client = createRelayClient('wss://small.example/');

    client.subscribe('sub', [{ kinds: [1] }]);

    expect(sockets).toHaveLength(0);
    expect(client.snapshot().diagnostics.at(-1)).toMatchObject({
      kind: 'request-too-large',
    });
  });

  it('rejects oversized REQ messages with the app cap when metadata is missing', () => {
    const client = createRelayClient('wss://large.example/');

    client.subscribe('sub', [{ search: 'x'.repeat(70_000) }]);

    expect(sockets).toHaveLength(0);
    expect(client.snapshot().diagnostics.at(-1)).toMatchObject({
      kind: 'request-too-large',
    });
  });
});

async function relayInfo(url: string, limitation: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ limitation }),
      }),
    ),
  );
  await fetchRelayInformation(url);
}
