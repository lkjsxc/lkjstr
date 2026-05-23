import {
  encodeClientMessage,
  verifyEvent,
  type ClientMessage,
  type NostrEvent,
  type NostrFilter,
  type RelayMessage,
} from '../protocol';
import { logRelayDiagnostic } from './relay-diagnostic-log';
import { RelayClientMetrics } from './relay-client-metrics';
import { parseRelayMessageData } from './relay-message-data';
import { utf8ByteLengthWithin } from './relay-message-size';
import { RelaySendQueue } from './relay-send-queue';
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
  #lastError?: string;
  #metrics = new RelayClientMetrics();
  #diagnostics: RelayDiagnostic[] = [];
  #eoseBySub: Record<string, boolean> = {};
  #closedBySub: Record<string, string> = {};
  #stats = new RelaySessionStatsCounter();
  #queue = new RelaySendQueue();
  #connectTimer?: ReturnType<typeof setTimeout>;
  #intentionalClose = false;

  constructor(
    readonly url: string,
    readonly events: Partial<RelayClientEvents> = {},
    readonly connectTimeoutMs = 5000,
  ) {}
  // prettier-ignore
  snapshot(): RelaySnapshot { return { url: this.url, state: this.#state, lastError: this.#lastError, ...this.#metrics.snapshotFields(), stats: this.#stats.snapshot(), diagnostics: [...this.#diagnostics], eoseBySub: { ...this.#eoseBySub }, closedBySub: { ...this.#closedBySub } }; }
  connect(): void {
    if (this.#socket && this.#state !== 'closed') return;
    this.#intentionalClose = false;
    this.#metrics.startConnect();
    this.#setState('connecting');
    this.#socket = new WebSocket(this.url);
    this.#connectTimer = setTimeout(
      () => this.#timeoutConnect(),
      this.connectTimeoutMs,
    );
    this.#socket.onopen = () => {
      this.#clearConnectTimer();
      this.#metrics.open();
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
  // prettier-ignore
  publish(event: NostrEvent): void { this.send(['EVENT', event]); }
  // prettier-ignore
  send(message: ClientMessage): void { this.connect(); this.#sendEncoded(encodeClientMessage(message)); }
  // prettier-ignore
  sendIfConnected(message: ClientMessage): void {
    if (!this.#socket || this.#state === 'closed' || this.#state === 'idle') return; this.#sendEncoded(encodeClientMessage(message));
  }
  // prettier-ignore
  close(): void { this.#intentionalClose = true; this.#clearConnectTimer(); this.#socket?.close(); this.#socket = undefined; this.#setState('closed'); }
  #receive(data: unknown): void {
    // prettier-ignore
    this.#stats.receivedBytes += typeof data === 'string' ? utf8ByteLengthWithin(data, Number.MAX_SAFE_INTEGER).bytes : 0;
    const parsed = parseRelayMessageData(data);
    if (!parsed) return;
    if (parsed.ok) {
      this.#metrics.receiveMessage();
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
      if (verified.ok) {
        this.#metrics.acceptEvent(message[2].id);
        this.events.event?.(this.url, message[1], message[2]);
      } else {
        this.#metrics.rejectEvent();
        this.#addDiagnostic('invalid-event', verified.message, message[1]);
      }
    }
    if (message[0] === 'CLOSED') {
      this.#closedBySub[message[1]] = message[2];
      this.#stats.activeSubscriptionIds.delete(message[1]);
      this.#addDiagnostic('closed', message[2], message[1]);
    }
    if (message[0] === 'NOTICE') this.#addDiagnostic('notice', message[1]);
    if (message[0] === 'AUTH') this.#addDiagnostic('auth', message[1]);
    if (message[0] === 'EOSE') {
      this.#eoseBySub[message[1]] = true;
      this.#metrics.eose();
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
    this.#metrics.rejectSubscription();
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

  // prettier-ignore
  #emitState(): void { this.events.state?.(this.snapshot()); }

  #sendEncoded(encoded: string): void {
    const bytes = utf8ByteLengthWithin(encoded, Number.MAX_SAFE_INTEGER).bytes;
    if (this.#state === 'open') {
      this.#stats.sentBytes += bytes;
      this.#socket?.send(encoded);
    } else if (this.#queue.enqueue(encoded)) {
      this.#stats.sentBytes += bytes;
    } else {
      this.#addDiagnostic('send-queue-full', 'send queue full');
    }
  }

  // prettier-ignore
  #flush(): void { this.#queue.drain().forEach((message) => this.#socket?.send(message)); }
}
