import {
  encodeClientMessage,
  verifyEvent,
  type ClientMessage,
  type NostrEvent,
  type NostrFilter,
  type RelayMessage,
} from '../protocol';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import { logRelayDiagnostic } from './relay-diagnostic-log';
import { createRelayClientMetrics } from './relay-client-metrics';
import { parseRelayMessageData } from './relay-message-data';
import { utf8ByteLengthWithin } from './relay-message-size';
import { createRelaySendQueue } from './relay-send-queue';
import { recordRelayClosedPolicy } from './relay-request-compat';
import type {
  RelayClientEvents,
  RelayConnectionState,
  RelayDiagnostic,
  RelayDiagnosticKind,
  RelaySnapshot,
} from './types';
// prettier-ignore
import { maxRelaySubscriptionIdLength, relaySubscriptionIdValid } from './subscription-id';
import { createRelaySessionStatsCounter } from './relay-session-stats';

export type RelayClient = ReturnType<typeof createRelayClient>;

export function createRelayClient(
  url: string,
  events: Partial<RelayClientEvents> = {},
  connectTimeoutMs = 5000,
) {
  let socket: WebSocket | undefined;
  let state: RelayConnectionState = 'idle';
  let lastError: string | undefined;
  const metrics = createRelayClientMetrics();
  let diagnostics: RelayDiagnostic[] = [];
  const eoseBySub: Record<string, boolean> = {};
  const closedBySub: Record<string, string> = {};
  const filtersBySub = new Map<string, readonly NostrFilter[]>();
  const stats = createRelaySessionStatsCounter();
  const queue = createRelaySendQueue();
  let connectTimer: ReturnType<typeof setTimeout> | undefined;
  let intentionalClose = false;

  // prettier-ignore
  const snapshot = (): RelaySnapshot => ({ url, state, lastError, ...metrics.snapshotFields(), stats: stats.snapshot(), diagnostics: [...diagnostics], eoseBySub: { ...eoseBySub }, closedBySub: { ...closedBySub } });
  const emitState = () => events.state?.(snapshot());
  // prettier-ignore
  const setState = (next: RelayConnectionState) => { state = next; emitState(); };
  // prettier-ignore
  const clearConnectTimer = () => { if (!connectTimer) return; clearTimeout(connectTimer); connectTimer = undefined; };
  const addDiagnostic = (
    kind: RelayDiagnosticKind,
    message: string,
    subId?: string,
    filters: readonly NostrFilter[] = [],
  ) => {
    diagnostics = [
      ...diagnostics.slice(-19),
      { relay: url, subId, kind, message, timestamp: Date.now() },
    ];
    if (kind === 'parse-error' || kind === 'invalid-event') lastError = message;
    logRelayDiagnostic(kind, message, url, subId, filters);
  };
  const validSubscriptionId = (id: string, action: string): boolean => {
    if (relaySubscriptionIdValid(id)) return true;
    const message = `${action} subscription id is longer than ${maxRelaySubscriptionIdLength} characters`;
    lastError = message;
    metrics.rejectSubscription();
    addDiagnostic('invalid-subscription', message, id.slice(0, 48));
    setState('error');
    return false;
  };
  const sendEncoded = (encoded: string) => {
    const bytes = utf8ByteLengthWithin(encoded, Number.MAX_SAFE_INTEGER).bytes;
    if (state === 'open') {
      stats.addSentBytes(bytes);
      socket?.send(encoded);
    } else if (queue.enqueue(encoded)) {
      stats.addSentBytes(bytes);
    } else {
      addDiagnostic('send-queue-full', 'send queue full');
    }
  };
  // prettier-ignore
  const send = (message: ClientMessage) => { handle.connect(); sendEncoded(encodeClientMessage(message)); };
  // prettier-ignore
  const sendIfConnected = (message: ClientMessage) => { if (!socket || state === 'closed' || state === 'idle') return; sendEncoded(encodeClientMessage(message)); };
  const handleRelayMessage = (message: RelayMessage) => {
    stats.receive(message);
    if (message[0] === 'EVENT') {
      const verified = verifyEvent(message[2]);
      if (verified.ok) {
        metrics.acceptEvent(message[2].id);
        events.event?.(url, message[1], message[2]);
      } else {
        metrics.rejectEvent();
        addDiagnostic('invalid-event', verified.message, message[1]);
      }
    }
    if (message[0] === 'CLOSED') {
      closedBySub[message[1]] = message[2];
      recordRelayClosedPolicy(
        url,
        message[2],
        filtersBySub.get(message[1]) ?? [],
      );
      stats.activeSubscriptionIds.delete(message[1]);
      addDiagnostic(
        'closed',
        message[2],
        message[1],
        filtersBySub.get(message[1]) ?? [],
      );
    }
    if (message[0] === 'NOTICE')
      addDiagnostic(
        'notice',
        message[1],
        undefined,
        [...filtersBySub.values()].flat(),
      );
    if (message[0] === 'AUTH') addDiagnostic('auth', message[1]);
    if (message[0] === 'EOSE') {
      eoseBySub[message[1]] = true;
      metrics.eose();
    }
  };
  const receive = (data: unknown) => {
    stats.addReceivedBytes(
      typeof data === 'string'
        ? utf8ByteLengthWithin(data, Number.MAX_SAFE_INTEGER).bytes
        : 0,
    );
    const parsed = parseRelayMessageData(data);
    if (!parsed) return;
    if (parsed.ok) {
      metrics.receiveMessage();
      events.message?.(url, parsed.message);
      handleRelayMessage(parsed.message);
    } else {
      lastError = parsed.message;
      stats.addParseError();
      addDiagnostic('parse-error', parsed.message);
    }
    emitState();
  };
  // prettier-ignore
  const timeoutConnect = () => { if (state !== 'connecting') return; lastError = 'connect timeout'; addDiagnostic('timeout', 'connect timeout'); setState('error'); socket?.close(); };
  // prettier-ignore
  const forgetSubscription = (id: string) => { delete eoseBySub[id]; delete closedBySub[id]; filtersBySub.delete(id); stats.activeSubscriptionIds.delete(id); };
  const handle = {
    url,
    snapshot,
    connect: () => {
      if (socket && state !== 'closed') return;
      intentionalClose = false;
      metrics.startConnect();
      setState('connecting');
      socket = new WebSocket(url);
      connectTimer = setTimeout(timeoutConnect, connectTimeoutMs);
      // prettier-ignore
      socket.onopen = () => { clearConnectTimer(); metrics.open(); setState('open'); queue.drain().forEach((message) => socket?.send(message)); };
      socket.onclose = () => {
        clearConnectTimer();
        if (!intentionalClose && state !== 'error') {
          lastError = 'websocket closed';
          addDiagnostic('closed', 'websocket closed');
        }
        setState('closed');
      };
      // prettier-ignore
      socket.onerror = () => { clearConnectTimer(); lastError = 'websocket error'; setState('error'); };
      socket.onmessage = (message) => receive(message.data);
    },
    subscribe: (id: string, filters: readonly NostrFilter[]) => {
      if (!validSubscriptionId(id, 'REQ')) return;
      const safeFilters = relaySafeFilters(filters);
      eoseBySub[id] = false;
      filtersBySub.set(id, safeFilters);
      stats.activeSubscriptionIds.add(id);
      delete closedBySub[id];
      send(['REQ', id, ...safeFilters]);
    },
    // prettier-ignore
    closeSubscription: (id: string) => { if (!validSubscriptionId(id, 'CLOSE')) return; const wasClosed = Boolean(closedBySub[id]); forgetSubscription(id); if (!wasClosed) sendIfConnected(['CLOSE', id]); emitState(); },
    publish: (event: NostrEvent) => send(['EVENT', event]),
    send,
    sendIfConnected,
    // prettier-ignore
    close: () => { intentionalClose = true; clearConnectTimer(); socket?.close(); socket = undefined; setState('closed'); },
  };
  return handle;
}
