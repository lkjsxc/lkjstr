import {
  encodeClientMessage,
  parseRelayMessage,
  verifyEvent,
  type ClientMessage,
  type NostrEvent,
  type NostrFilter,
} from '../protocol';
import type {
  RelayClientEvents,
  RelayConnectionState,
  RelaySnapshot,
} from './types';

export class RelayClient {
  #socket?: WebSocket;
  #state: RelayConnectionState = 'idle';
  #lastMessageAt?: number;
  #lastError?: string;
  #eoseBySub: Record<string, boolean> = {};
  #queue: string[] = [];

  constructor(
    readonly url: string,
    readonly events: Partial<RelayClientEvents> = {},
  ) {}

  snapshot(): RelaySnapshot {
    return {
      url: this.url,
      state: this.#state,
      lastMessageAt: this.#lastMessageAt,
      lastError: this.#lastError,
      eoseBySub: { ...this.#eoseBySub },
    };
  }

  connect(): void {
    if (this.#socket && this.#state !== 'closed') return;
    this.#setState('connecting');
    this.#socket = new WebSocket(this.url);
    this.#socket.onopen = () => {
      this.#setState('open');
      this.#flush();
    };
    this.#socket.onclose = () => this.#setState('closed');
    this.#socket.onerror = () => {
      this.#lastError = 'websocket error';
      this.#setState('error');
    };
    this.#socket.onmessage = (message) => this.#receive(message.data);
  }

  subscribe(id: string, filters: readonly NostrFilter[]): void {
    this.send(['REQ', id, ...filters]);
  }

  closeSubscription(id: string): void {
    this.send(['CLOSE', id]);
  }

  publish(event: NostrEvent): void {
    this.send(['EVENT', event]);
  }

  send(message: ClientMessage): void {
    this.connect();
    const encoded = encodeClientMessage(message);
    if (this.#state === 'open') this.#socket?.send(encoded);
    else this.#queue.push(encoded);
  }

  close(): void {
    this.#socket?.close();
    this.#socket = undefined;
    this.#setState('closed');
  }

  #receive(data: unknown): void {
    if (typeof data !== 'string') return;
    const parsed = parseRelayMessage(data);
    if (!parsed.ok) {
      this.#lastError = parsed.message;
      this.#emitState();
      return;
    }
    this.#lastMessageAt = Date.now();
    this.events.message?.(this.url, parsed.message);
    if (parsed.message[0] === 'EVENT' && verifyEvent(parsed.message[2]).ok) {
      this.events.event?.(this.url, parsed.message[1], parsed.message[2]);
    }
    if (parsed.message[0] === 'EOSE') this.#eoseBySub[parsed.message[1]] = true;
    this.#emitState();
  }

  #setState(state: RelayConnectionState): void {
    this.#state = state;
    this.#emitState();
  }

  #emitState(): void {
    this.events.state?.(this.snapshot());
  }

  #flush(): void {
    const queued = this.#queue.splice(0);
    queued.forEach((message) => this.#socket?.send(message));
  }
}
