import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayClient } from '../../../src/lib/relays/relay-client';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import type { RelaySnapshot } from '../../../src/lib/relays/types';

const event = finalizeEvent(
  {
    created_at: 100,
    kind: 1,
    tags: [],
    content: 'relay test',
  },
  generateSecretKey(),
);

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

  error(): void {
    this.onerror?.({} as Event);
  }

  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('relay helpers', () => {
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

  it('sends client messages and tracks relay state', () => {
    const states: RelaySnapshot[] = [];
    const messages: unknown[] = [];
    const client = createRelayClient('wss://relay.example/', {
      message: (_relay, message) => messages.push(message),
      state: (snapshot) => states.push(snapshot),
    });

    expect(client.snapshot()).toMatchObject({ state: 'idle', eoseBySub: {} });

    client.subscribe('sub', [{ kinds: [1], limit: 5 }]);
    expect(sockets).toHaveLength(1);
    expect(states.at(-1)).toMatchObject({ state: 'connecting' });

    sockets[0]?.open();
    expect(states.at(-1)).toMatchObject({ state: 'open' });
    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"kinds":[1],"limit":5}]']);

    sockets[0]?.receive(JSON.stringify(['EOSE', 'sub']));
    expect(messages).toEqual([['EOSE', 'sub']]);
    expect(states.at(-1)).toMatchObject({
      lastMessageAt: Date.now(),
      eoseBySub: { sub: true },
    });

    sockets[0]?.receive('not json');
    expect(states.at(-1)?.lastError).toBe('relay message is not valid JSON');
    expect(states.at(-1)?.diagnostics.at(-1)).toMatchObject({
      kind: 'parse-error',
    });
  });

  it('records relay diagnostics for closed, notice, auth, and bad events', () => {
    const events: unknown[] = [];
    const states: RelaySnapshot[] = [];
    const client = createRelayClient('wss://relay.example/', {
      event: (_relay, _subId, event) => events.push(event),
      state: (snapshot) => states.push(snapshot),
    });
    client.subscribe('sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['CLOSED', 'sub', 'limit: slow']));
    sockets[0]?.receive(JSON.stringify(['NOTICE', 'maintenance']));
    sockets[0]?.receive(JSON.stringify(['AUTH', 'challenge']));
    sockets[0]?.receive(
      JSON.stringify(['EVENT', 'sub', { ...event, sig: '0'.repeat(128) }]),
    );

    expect(events).toEqual([]);
    expect(states.at(-1)?.diagnostics.map((item) => item.kind)).toEqual([
      'closed',
      'notice',
      'auth',
      'invalid-event',
    ]);
  });

  it('marks connecting relays failed when connect times out', async () => {
    const states: RelaySnapshot[] = [];
    const client = createRelayClient(
      'wss://relay.example/',
      { state: (snapshot) => states.push(snapshot) },
      25,
    );

    client.subscribe('sub', [{ kinds: [1] }]);
    await vi.advanceTimersByTimeAsync(25);

    expect(states.at(-1)).toMatchObject({
      state: 'closed',
      lastError: 'connect timeout',
    });
    expect(states.at(-1)?.diagnostics.at(-1)).toMatchObject({
      kind: 'timeout',
    });
  });

  it('normalizes relay pool subscriptions and closes them', () => {
    const pool = createRelayPool();

    const unsubscribe = pool.subscribe(
      ['relay.example', 'ftp://bad.example'],
      'sub',
      [{ limit: 2 }],
    );

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.url).toBe('wss://relay.example/');
    sockets[0]?.open();
    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"limit":2}]']);

    unsubscribe();
    expect(sockets[0]?.sent.at(-1)).toBe('["CLOSE","sub"]');
  });

  it('does not reconnect closed sockets to close subscriptions', () => {
    const pool = createRelayPool();
    const unsubscribe = pool.subscribe(['relay.example'], 'sub', [
      { limit: 2 },
    ]);

    sockets[0]?.open();
    sockets[0]?.close();
    unsubscribe();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"limit":2}]']);
  });

  it('resolves relay pool publish acknowledgements', async () => {
    const pool = createRelayPool();
    const published = pool.publish(['relay.example'], event, 5000);

    sockets[0]?.open();
    expect(JSON.parse(sockets[0]?.sent[0] ?? '[]')[0]).toBe('EVENT');

    sockets[0]?.receive(JSON.stringify(['OK', event.id, true, 'saved']));

    await expect(published).resolves.toEqual([
      { relay: 'wss://relay.example/', accepted: true, message: 'saved' },
    ]);
  });

  it('times out relay pool publishes without acknowledgements', async () => {
    const pool = createRelayPool();
    const published = pool.publish(['relay.example'], event, 25);

    await vi.advanceTimersByTimeAsync(25);

    await expect(published).resolves.toEqual([
      { relay: 'wss://relay.example/', accepted: false, message: 'timeout' },
    ]);
  });
});
