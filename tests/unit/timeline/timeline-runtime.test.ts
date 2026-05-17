import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { TimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';

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

  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('timeline runtime', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('subscribes, stores received events, and closes on cleanup', async () => {
    const states: string[][] = [];
    const runtime = new TimelineRuntime({
      relays: ['relay.example'],
      subId: 'timeline-test',
      pool: new RelayPool(),
    });
    runtime.subscribe((state) =>
      states.push(state.items.map((item) => item.event.content)),
    );

    await runtime.start();
    sockets[0]?.open();
    expect(sockets[0]?.sent[0]).toBe(
      '["REQ","timeline-test",{"kinds":[1],"limit":50}]',
    );

    const event = finalizeEvent(
      { created_at: 100, kind: 1, tags: [], content: 'synthetic note' },
      generateSecretKey(),
    );
    sockets[0]?.receive(JSON.stringify(['EVENT', 'timeline-test', event]));
    await vi.waitFor(() => expect(states.at(-1)).toEqual(['synthetic note']));

    runtime.close();
    expect(sockets[0]?.sent.at(-1)).toBe('["CLOSE","timeline-test"]');
  });
});
