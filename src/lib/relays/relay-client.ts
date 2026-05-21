import {
  encodeClientMessage,
  verifyEvent,
  type ClientMessage,
  type NostrEvent,
  type NostrFilter,
  type RelayMessage,
} from '../protocol';
import { logRelayDiagnostic } from './relay-diagnostic-log';
import { parseRelayMessageData } from './relay-message-data';
import type {
  RelayClientEvents,
  RelayConnectionState,
  RelayDiagnostic,
  RelayDiagnosticKind,
  RelaySnapshot,
} from './types';
import {
  maxRelaySubscriptionIdLength,
  relaySubscriptionIdValid,
} from './subscription-id';
import { RelaySessionStatsCounter } from './relay-session-stats';

export class RelayClient {
  #socket?: WebSocket;
  #state: RelayConnectionState = 'idle';
  #lastMessageAt?: number;
  #lastError?: string;
  #diagnostics: RelayDiagnostic[] = [];
  #eoseBySub: Record<string, boolean> = {};
  #closedBySub: Record<string, string> = {};
  #stats = new RelaySessionStatsCounter();
  #queue: string[] = [];
  #connectTimer?: ReturnType<typeof setTimeout>;
  #intentionalClose = false;

  constructor(
    readonly url: string,
    readonly events: Partial<RelayClientEvents> = {},
    readonly connectTimeoutMs = 5000,
  ) {}
  snapshot(): RelaySnapshot {
    return {
      url: this.url,
      state: this.#state,
      lastMessageAt: this.#lastMessageAt,
      lastError: this.#lastError,
      stats: this.#stats.snapshot(),
      diagnostics: [...this.#diagnostics],
      eoseBySub: { ...this.#eoseBySub },
      closedBySub: { ...this.#closedBySub },
    };
  }
  connect(): void {
    if (this.#socket && this.#state !== 'closed') return;
    this.#intentionalClose = false;
    this.#setState('connecting');
    this.#socket = new WebSocket(this.url);
    this.#connectTimer = setTimeout(
      () => this.#timeoutConnect(),
      this.connectTimeoutMs,
    );
    this.#socket.onopen = () => {
      this.#clearConnectTimer();
      this.#setState('open');
      this.#flush();
    };
    this.#socket.onclose = () => {
      this.#clearConnectTimer();
      if (!this.#intentionalClose && this.#state !== 'error') {
        this.#lastError = 'websocket closed';
        this.#addDiagnostic('closed', 'websocket closed');
      }
      this.#setState('closed');
    };
    this.#socket.onerror = () => {
      this.#clearConnectTimer();
      this.#lastError = 'websocket error';
      this.#setState('error');
    };
    this.#socket.onmessage = (message) => this.#receive(message.data);
  }
  subscribe(id: string, filters: readonly NostrFilter[]): void {
    if (!this.#validSubscriptionId(id, 'REQ')) return;
    this.#eoseBySub[id] = false;
    this.#stats.activeSubscriptionIds.add(id);
    delete this.#closedBySub[id];
    this.send(['REQ', id, ...filters]);
  }
  closeSubscription(id: string): void {
    if (!this.#validSubscriptionId(id, 'CLOSE')) return;
    delete this.#eoseBySub[id];
    this.#stats.activeSubscriptionIds.delete(id);
    if (this.#closedBySub[id]) return;
    this.sendIfConnected(['CLOSE', id]);
  }
  publish(event: NostrEvent): void {
    this.send(['EVENT', event]);
  }
  send(message: ClientMessage): void {
    this.connect();
    const encoded = encodeClientMessage(message);
    this.#stats.sentBytes += encoded.length;
    if (this.#state === 'open') this.#socket?.send(encoded);
    else this.#queue.push(encoded);
  }
  sendIfConnected(message: ClientMessage): void {
    if (!this.#socket || this.#state === 'closed' || this.#state === 'idle')
      return;
    const encoded = encodeClientMessage(message);
    this.#stats.sentBytes += encoded.length;
    if (this.#state === 'open') this.#socket.send(encoded);
    else this.#queue.push(encoded);
  }
  // prettier-ignore
  close(): void { this.#intentionalClose = true; this.#clearConnectTimer(); this.#socket?.close(); this.#socket = undefined; this.#setState('closed'); }
  #receive(data: unknown): void {
    this.#stats.receivedBytes += typeof data === 'string' ? data.length : 0;
    const parsed = parseRelayMessageData(data);
    if (!parsed) return;
    if (parsed.ok) {
      this.#lastMessageAt = Date.now();
      this.events.message?.(this.url, parsed.message);
      this.#handleRelayMessage(parsed.message);
    } else {
      this.#lastError = parsed.message;
      this.#stats.parseErrorCount++;
      this.#addDiagnostic('parse-error', parsed.message);
    }
    this.#emitState();
  }
  #handleRelayMessage(message: RelayMessage) {
    this.#stats.receive(message);
    if (message[0] === 'EVENT') {
      const verified = verifyEvent(message[2]);
      if (verified.ok) this.events.event?.(this.url, message[1], message[2]);
      else this.#addDiagnostic('invalid-event', verified.message, message[1]);
    }
    if (message[0] === 'CLOSED') {
      this.#closedBySub[message[1]] = message[2];
      this.#stats.activeSubscriptionIds.delete(message[1]);
      this.#addDiagnostic('closed', message[2], message[1]);
    }
    if (message[0] === 'NOTICE') {
      this.#addDiagnostic('notice', message[1]);
    }
    if (message[0] === 'AUTH') {
      this.#addDiagnostic('auth', message[1]);
    }
    if (message[0] === 'EOSE') {
      this.#eoseBySub[message[1]] = true;
    }
  }
  #addDiagnostic(
    kind: RelayDiagnosticKind,
    message: string,
    subId?: string,
  ): void {
    this.#diagnostics = [
      ...this.#diagnostics.slice(-19),
      {
        relay: this.url,
        subId,
        kind,
        message,
        timestamp: Date.now(),
      },
    ];
    if (kind === 'parse-error' || kind === 'invalid-event')
      this.#lastError = message;
    logRelayDiagnostic(kind, message, this.url, subId);
  }

  #validSubscriptionId(id: string, action: string): boolean {
    if (relaySubscriptionIdValid(id)) return true;
    const message = `${action} subscription id is longer than ${maxRelaySubscriptionIdLength} characters`;
    this.#lastError = message;
    this.#addDiagnostic('invalid-subscription', message, id.slice(0, 64));
    this.#setState('error');
    return false;
  }

  // prettier-ignore
  #timeoutConnect(): void { if (this.#state !== 'connecting') return; this.#lastError = 'connect timeout'; this.#addDiagnostic('timeout', 'connect timeout'); this.#setState('error'); this.#socket?.close(); }

  // prettier-ignore
  #clearConnectTimer(): void { if (!this.#connectTimer) return; clearTimeout(this.#connectTimer); this.#connectTimer = undefined; }

  // prettier-ignore
  #setState(state: RelayConnectionState): void { this.#state = state; this.#emitState(); }

  #emitState(): void {
    this.events.state?.(this.snapshot());
  }

  #flush(): void {
    this.#queue.splice(0).forEach((message) => this.#socket?.send(message));
  }
}
