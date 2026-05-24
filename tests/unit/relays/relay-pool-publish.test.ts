import { finalizeEvent, generateSecretKey } from '../../../src/lib/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';

const event = finalizeEvent(
  { created_at: 100, kind: 1, tags: [], content: 'relay test' },
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

  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('relay pool publish', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dedupes normalized relay targets for publish', async () => {
    const pool = createRelayPool();
    const published = pool.publish(
      ['relay.example', 'wss://relay.example/'],
      event,
    );

    sockets[0]?.onopen?.({} as Event);
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent).toHaveLength(1);

    sockets[0]?.receive(JSON.stringify(['OK', event.id, true, 'saved']));
    await expect(published).resolves.toEqual([
      { relay: 'wss://relay.example/', accepted: true, message: 'saved' },
    ]);
  });

  it('ignores late publish timeouts after OK resolution', async () => {
    const pool = createRelayPool();
    const published = pool.publish(['relay.example'], event, 25);

    sockets[0]?.onopen?.({} as Event);
    sockets[0]?.receive(JSON.stringify(['OK', event.id, true, 'saved']));
    await vi.advanceTimersByTimeAsync(25);

    await expect(published).resolves.toEqual([
      { relay: 'wss://relay.example/', accepted: true, message: 'saved' },
    ]);
  });

  it('shares duplicate in-flight publishes for the same event and relay', async () => {
    const pool = createRelayPool();
    const first = pool.publish(['relay.example'], event, 5000);
    const second = pool.publish(['wss://relay.example/'], event, 5000);

    sockets[0]?.onopen?.({} as Event);
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent).toHaveLength(1);

    sockets[0]?.receive(JSON.stringify(['OK', event.id, true, 'saved']));
    await expect(Promise.all([first, second])).resolves.toEqual([
      [{ relay: 'wss://relay.example/', accepted: true, message: 'saved' }],
      [{ relay: 'wss://relay.example/', accepted: true, message: 'saved' }],
    ]);
  });

  it('resolves pending publishes as closed when the pool closes', async () => {
    const pool = createRelayPool();
    const published = pool.publish(['relay.example'], event, 5000);

    expect(pool.__debugClientCount()).toBe(1);
    pool.close();

    await expect(published).resolves.toEqual([
      { relay: 'wss://relay.example/', accepted: false, message: 'closed' },
    ]);
    expect(pool.__debugClientCount()).toBe(0);
  });
});
