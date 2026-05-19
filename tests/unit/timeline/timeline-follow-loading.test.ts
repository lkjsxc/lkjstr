import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { TimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';

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

describe('timeline follow loading', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests the latest follow list without a since bound', async () => {
    const active = pubkey();
    const runtime = runtimeFor({ activeAccountPubkey: active });
    await runtime.start();
    sockets[0]?.open();
    expect(JSON.parse(sockets[0]?.sent[0] ?? '[]')).toEqual([
      'REQ',
      'timeline-test:follows',
      { kinds: [3], authors: [active], limit: 1 },
    ]);
  });

  it('waits for every relay before falling back from missing follows', async () => {
    const active = pubkey();
    const states: string[] = [];
    const runtime = runtimeFor({
      activeAccountPubkey: active,
      relays: ['relay-one.example', 'relay-two.example'],
    });
    runtime.subscribe((state) => states.push(state.status));
    await runtime.start();
    sockets.forEach((socket) => socket.open());
    sockets[0]?.receive(JSON.stringify(['EOSE', 'timeline-test:follows']));
    expect(states).not.toContain('no-follow-list');
    sockets[1]?.receive(JSON.stringify(['EOSE', 'timeline-test:follows']));
    await vi.waitFor(() => expect(states).toContain('no-follow-list'));
  });
});

function runtimeFor(options: {
  activeAccountPubkey: string;
  relays?: readonly string[];
}): TimelineRuntime {
  return new TimelineRuntime({
    relays: options.relays ?? ['relay.example'],
    subId: 'timeline-test',
    activeAccountPubkey: options.activeAccountPubkey,
    pool: new RelayPool(),
  });
}

function pubkey(): string {
  return getPublicKey(generateSecretKey());
}
