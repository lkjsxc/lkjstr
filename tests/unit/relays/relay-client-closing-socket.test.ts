import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayClient } from '../../../src/lib/relays/relay-client';

const sockets: ClosingSocket[] = [];

class ClosingSocket {
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState = 0;
  closeCount = 0;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send(data: string): void {
    if (this.readyState !== ClosingSocket.OPEN)
      throw new Error('already in CLOSING or CLOSED state');
    this.sent.push(data);
  }

  close(): void {
    this.closeCount += 1;
    this.readyState = ClosingSocket.CLOSING;
    this.onclose?.({} as CloseEvent);
  }

  open(): void {
    this.readyState = ClosingSocket.OPEN;
    this.onopen?.({} as Event);
  }
}

describe('relay client closing socket sends', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', ClosingSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('does not send CLOSE after a socket starts closing', () => {
    const client = createRelayClient('wss://relay.example/');
    client.subscribe('sub', [{ kinds: [1] }]);
    sockets[0]?.open();
    sockets[0]!.readyState = ClosingSocket.CLOSING;

    expect(() => client.closeSubscription('sub')).not.toThrow();
    expect(sockets[0]?.sent).toEqual(['["REQ","sub",{"kinds":[1]}]']);
  });

  it('detaches a connecting socket without app-close on client close', () => {
    const client = createRelayClient('wss://relay.example/');
    client.subscribe('sub', [{ kinds: [1] }]);

    client.close();

    expect(sockets[0]?.readyState).toBe(0);
    expect(sockets[0]?.closeCount).toBe(0);
    expect(sockets[0]?.onopen).toBeNull();
    expect(sockets[0]?.onclose).toBeNull();
  });
});
