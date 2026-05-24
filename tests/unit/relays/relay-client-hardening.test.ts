import { finalizeEvent, generateSecretKey } from '../../../src/lib/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayClient } from '../../../src/lib/relays/relay-client';
import { fetchRelayInformation } from '../../../src/lib/relays/relay-info';

const event = finalizeEvent(
  { created_at: 100, kind: 1, tags: [], content: 'relay test' },
  generateSecretKey(),
);
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

describe('relay client hardening', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('rejects unknown subscription ids and filter mismatches', () => {
    const events: unknown[] = [];
    const client = createRelayClient('wss://relay.example/', {
      event: (_relay, _subId, item) => events.push(item),
    });
    client.subscribe('sub', [{ kinds: [0] }]);
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['EVENT', 'missing', event]));
    sockets[0]?.receive(JSON.stringify(['EVENT', 'sub', event]));
    expect(events).toEqual([]);
    expect(client.snapshot().diagnostics.map((item) => item.kind)).toEqual([
      'filter-mismatch',
      'filter-mismatch',
    ]);
  });

  it('delivers events matching any stored filter', () => {
    const events: unknown[] = [];
    const client = createRelayClient('wss://relay.example/', {
      event: (_relay, subId, item) => events.push({ subId, item }),
    });
    client.subscribe('sub', [{ kinds: [0] }, { kinds: [1] }]);
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['EVENT', 'sub', event]));
    expect(events).toEqual([{ subId: 'sub', item: event }]);
  });

  it('ignores late events for locally closed subscriptions', () => {
    const events: unknown[] = [];
    const client = createRelayClient('wss://relay.example/', {
      event: (_relay, subId) => events.push(subId),
    });
    client.subscribe('sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    client.closeSubscription('sub');
    sockets[0]?.receive(JSON.stringify(['EVENT', 'sub', event]));
    expect(events).toEqual([]);
    expect(client.snapshot().diagnostics).toEqual([]);
  });

  it('ignores late events for strict relay wire aliases', async () => {
    await relayInfo('wss://alias-close.example/', { max_subid_length: 8 });
    const events: unknown[] = [];
    const client = createRelayClient('wss://alias-close.example/', {
      event: (_relay, subId) => events.push(subId),
    });
    client.subscribe('logical-sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    const wireId = JSON.parse(sockets[0]?.sent[0] ?? '[]')[1];
    client.closeSubscription('logical-sub');
    sockets[0]?.receive(JSON.stringify(['EVENT', wireId, event]));
    expect(events).toEqual([]);
    expect(client.snapshot().diagnostics).toEqual([]);
  });

  it('diagnoses binary relay frames with measured bytes', () => {
    const client = createRelayClient('wss://relay.example/');
    client.subscribe('sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    sockets[0]?.receive(new Uint8Array([1, 2, 3, 4]));
    expect(client.snapshot()).toMatchObject({
      lastError: 'unsupported non-text relay frame: 4 bytes',
      stats: { receivedBytes: 4, parseErrorCount: 1 },
    });
    expect(client.snapshot().diagnostics.at(-1)).toMatchObject({
      kind: 'parse-error',
      message: 'unsupported non-text relay frame: 4 bytes',
    });
  });

  it('uses short wire aliases for stricter relay subscription id limits', async () => {
    await relayInfo('wss://alias.example/', { max_subid_length: 8 });
    const events: unknown[] = [];
    const client = createRelayClient('wss://alias.example/', {
      event: (_relay, subId) => events.push(subId),
    });
    client.subscribe('logical-sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    const wireId = JSON.parse(sockets[0]?.sent[0] ?? '[]')[1];
    expect(wireId).toHaveLength(8);
    sockets[0]?.receive(JSON.stringify(['EVENT', wireId, event]));
    expect(events).toEqual(['logical-sub']);
  });

  it('closes backward subscriptions once after EOSE', () => {
    const client = createRelayClient('wss://relay.example/');
    client.subscribe('sub', [{ kinds: [1] }], { strategy: 'backward' });
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['EOSE', 'sub']));
    client.closeSubscription('sub');
    expect(sockets[0]?.sent).toEqual([
      '["REQ","sub",{"kinds":[1]}]',
      '["CLOSE","sub"]',
    ]);
  });

  it('reconnects unexpected closes but not explicit closes', async () => {
    const client = createRelayClient('wss://relay.example/');
    client.subscribe('sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    sockets[0]?.close();
    await vi.advanceTimersByTimeAsync(600);
    sockets[1]?.open();
    expect(sockets[1]?.sent).toEqual(['["REQ","sub",{"kinds":[1]}]']);
    client.close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
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
