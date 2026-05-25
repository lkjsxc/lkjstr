// prettier-ignore
import { encodeClientMessage, matchesAnyFilter, verifyEvent, type ClientMessage, type NostrEvent, type NostrFilter, type RelayMessage } from '../protocol';
import { relaySafeFilters } from '../events/nostr-filter-sanitize';
import { logRelayDiagnostic } from './relay-diagnostic-log';
import { createRelayClientMetrics } from './relay-client-metrics';
import { parseRelayMessageData, relayFrameBytes } from './relay-message-data';
import { utf8ByteLengthWithin } from './relay-message-size';
import { createRelaySendQueue } from './relay-send-queue';
import { recordRelayClosedPolicy } from './relay-request-compat';
import { relayLimits } from './relay-limits';
import { createRelayReqScheduler } from './relay-req-scheduler';
import { createRelaySubscriptionAliases } from './relay-subscription-alias';
import { createRelayCloseTombstones } from './relay-close-tombstones';
import { incMemoryCounter, decMemoryCounter } from '../app/memory-counters';
import type { RelaySubscribeOptions } from './relay-subscription-strategy';
// prettier-ignore
import type { RelayClientEvents, RelayConnectionState, RelayDiagnostic, RelayDiagnosticKind, RelaySnapshot } from './types';
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
  const filtersBySub = new Map<string, readonly NostrFilter[]>(),
    optionsBySub = new Map<string, RelaySubscribeOptions>(),
    deadlineBySub = new Map<string, number>(),
    closeSentBySub = new Set<string>();
  const stats = createRelaySessionStatsCounter();
  const queue = createRelaySendQueue(),
    reqs = createRelayReqScheduler(),
    aliases = createRelaySubscriptionAliases(),
    closeTombstones = createRelayCloseTombstones();
  let connectTimer: ReturnType<typeof setTimeout> | undefined,
    reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectDelayMs = 500;
  let openCount = 0;
  let intentionalClose = false;
  let finallyClosed = false;

  // prettier-ignore
  const snapshot = (): RelaySnapshot => ({ url, state, lastError, ...metrics.snapshotFields(), stats: stats.snapshot(), diagnostics: [...diagnostics], eoseBySub: { ...eoseBySub }, closedBySub: { ...closedBySub } });
  const emitState = () => events.state?.(snapshot());
  // prettier-ignore
  const setState = (next: RelayConnectionState) => { state = next; emitState(); };
  // prettier-ignore
  const clearConnectTimer = () => { if (!connectTimer) return; clearTimeout(connectTimer); connectTimer = undefined; decMemoryCounter('active-timers'); };
  // prettier-ignore
  const clearReconnectTimer = () => { if (!reconnectTimer) return; clearTimeout(reconnectTimer); reconnectTimer = undefined; decMemoryCounter('active-timers'); };
  // prettier-ignore
  const addDiagnostic = (kind: RelayDiagnosticKind, message: string, subId?: string, filters: readonly NostrFilter[] = []) => { diagnostics = [...diagnostics.slice(-19), { relay: url, subId, kind, message, timestamp: Date.now() }]; if (kind === 'parse-error' || kind === 'invalid-event') lastError = message; logRelayDiagnostic(kind, message, url, subId, filters); };
  // prettier-ignore
  const validSubscriptionId = (id: string, action: string): boolean => { if (relaySubscriptionIdValid(id)) return true; const message = `${action} subscription id is longer than ${maxRelaySubscriptionIdLength} characters`; lastError = message; metrics.rejectSubscription(); addDiagnostic('invalid-subscription', message, id.slice(0, 48)); setState('error'); return false; };
  const activeLimit = () => relayLimits(url).maxSubscriptions;
  const releaseReq = (id: string) => reqs.release(id, activeLimit());
  // prettier-ignore
  const shouldReconnect = () => !intentionalClose && (queue.hasPending() || reqs.hasPending() || [...reqs.activeIds].some(restorableSubscription));
  // prettier-ignore
  const restorableSubscription = (id: string): boolean => { const strategy = optionsBySub.get(id)?.strategy ?? 'forward'; if (strategy === 'forward') return true; const deadline = deadlineBySub.get(id); return deadline === undefined || Date.now() < deadline; };
  // prettier-ignore
  const scheduleReconnect = () => { if (!shouldReconnect() || reconnectTimer) return; const delay = reconnectDelayMs + Math.floor(Math.random() * 100); reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15_000); reconnectTimer = setTimeout(() => { reconnectTimer = undefined; socket = undefined; handle.connect(); }, delay); incMemoryCounter('active-timers'); };
  // prettier-ignore
  const clampFilters = (filters: readonly NostrFilter[]): NostrFilter[] => { const maxLimit = relayLimits(url).maxLimit; return filters.map((filter) => maxLimit && filter.limit && filter.limit > maxLimit ? { ...filter, limit: maxLimit } : filter); };
  const sendEncoded = (encoded: string) => {
    if (finallyClosed) return;
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
  const send = (message: ClientMessage) => { if (finallyClosed) return; handle.connect(); sendEncoded(encodeClientMessage(message)); };
  // prettier-ignore
  const sendIfConnected = (message: ClientMessage) => { if (finallyClosed || !socket || state === 'closed' || state === 'idle') return; sendEncoded(encodeClientMessage(message)); };
  // prettier-ignore
  const startSubscription = (id: string, filters: readonly NostrFilter[], options: RelaySubscribeOptions, restore = false) => { if (finallyClosed) return; const limits = relayLimits(url); const wireId = aliases.wireId(id, limits.maxSubscriptionIdLength); const message: ClientMessage = ['REQ', wireId, ...filters]; const encoded = encodeClientMessage(message); if (limits.maxMessageLength && !utf8ByteLengthWithin(encoded, limits.maxMessageLength).within) { addDiagnostic('request-too-large', 'REQ exceeds relay message limit', id); releaseReq(id); return; } if (!restore) { eoseBySub[id] = false; filtersBySub.set(id, filters); optionsBySub.set(id, options); if (options.idleCloseMs) deadlineBySub.set(id, Date.now() + options.idleCloseMs); delete closedBySub[id]; } stats.activeSubscriptionIds.add(id); incMemoryCounter('active-relay-subscriptions'); handle.connect(); sendEncoded(encoded); };
  // prettier-ignore
  const restoreSubscriptions = () => { for (const id of reqs.activeIds) { if (restorableSubscription(id)) startSubscription(id, filtersBySub.get(id) ?? [], optionsBySub.get(id) ?? {}, true); else releaseReq(id); } };
  const handleEventMessage = (wireId: string, event: NostrEvent) => {
    const subId = aliases.logicalId(wireId),
      verified = verifyEvent(event),
      filters = filtersBySub.get(subId);
    if (verified.ok && filters && matchesAnyFilter(event, filters)) {
      metrics.acceptEvent(event.id);
      events.event?.(url, subId, event);
      return;
    }
    if (verified.ok && !filters && closeTombstones.hasAny([wireId, subId]))
      return;
    metrics.rejectEvent();
    if (verified.ok)
      addDiagnostic(
        'filter-mismatch',
        filters
          ? 'event does not match subscription filters'
          : 'unknown subscription id',
        subId,
        filters ?? [],
      );
    else addDiagnostic('invalid-event', verified.message, subId);
  };
  const handleClosedMessage = (wireId: string, reason: string) => {
    const subId = aliases.logicalId(wireId),
      filters = filtersBySub.get(subId) ?? [];
    closedBySub[subId] = reason;
    recordRelayClosedPolicy(url, reason, filters);
    stats.activeSubscriptionIds.delete(subId);
    decMemoryCounter('active-relay-subscriptions');
    addDiagnostic('closed', reason, subId, filters);
    releaseReq(subId);
  };
  const handleEoseMessage = (wireId: string) => {
    const subId = aliases.logicalId(wireId);
    eoseBySub[subId] = true;
    metrics.eose();
    if ((optionsBySub.get(subId)?.strategy ?? 'forward') === 'forward') return;
    closeSentBySub.add(subId);
    sendIfConnected(['CLOSE', wireId]);
    stats.activeSubscriptionIds.delete(subId);
    decMemoryCounter('active-relay-subscriptions');
    releaseReq(subId);
  };
  const handleRelayMessage = (message: RelayMessage) => {
    stats.receive(message);
    if (message[0] === 'EVENT') handleEventMessage(message[1], message[2]);
    if (message[0] === 'CLOSED') handleClosedMessage(message[1], message[2]);
    if (message[0] === 'NOTICE')
      addDiagnostic(
        'notice',
        message[1],
        undefined,
        [...filtersBySub.values()].flat(),
      );
    if (message[0] === 'AUTH') addDiagnostic('auth', message[1]);
    if (message[0] === 'EOSE') handleEoseMessage(message[1]);
  };
  // prettier-ignore
  const receive = (data: unknown) => { stats.addReceivedBytes(relayFrameBytes(data) ?? 0); const parsed = parseRelayMessageData(data); if (!parsed) return; if (parsed.ok) { metrics.receiveMessage(); events.message?.(url, parsed.message); handleRelayMessage(parsed.message); } else { lastError = parsed.message; stats.addParseError(); addDiagnostic('parse-error', parsed.message); } emitState(); };
  // prettier-ignore
  const timeoutConnect = () => { if (state !== 'connecting') return; lastError = 'connect timeout'; addDiagnostic('timeout', 'connect timeout'); setState('error'); socket?.close(); };
  // prettier-ignore
  const forgetSubscription = (id: string) => { delete eoseBySub[id]; delete closedBySub[id]; filtersBySub.delete(id); optionsBySub.delete(id); deadlineBySub.delete(id); closeSentBySub.delete(id); aliases.forget(id); reqs.remove(id); stats.activeSubscriptionIds.delete(id); decMemoryCounter('active-relay-subscriptions'); };
  // prettier-ignore
  const clearObject = (record: Record<string, unknown>): void => { for (const key of Object.keys(record)) delete record[key]; };
  // prettier-ignore
  const detachSocket = (): void => { if (!socket) return; socket.onopen = null; socket.onclose = null; socket.onerror = null; socket.onmessage = null; decMemoryCounter('active-dom-listeners', 4); };
  // prettier-ignore
  const clearRuntimeState = (): void => { clearObject(eoseBySub); clearObject(closedBySub); filtersBySub.clear(); optionsBySub.clear(); deadlineBySub.clear(); closeSentBySub.clear(); aliases.clear(); closeTombstones.clear(); queue.clear(); reqs.clear(); decMemoryCounter('active-relay-subscriptions', stats.activeSubscriptionIds.size); stats.clear(); };
  const handle = {
    url,
    snapshot,
    connect: () => {
      if (finallyClosed) return;
      if (socket && state !== 'closed') return;
      intentionalClose = false;
      clearReconnectTimer();
      metrics.startConnect();
      setState('connecting');
      socket = new WebSocket(url);
      connectTimer = setTimeout(timeoutConnect, connectTimeoutMs);
      incMemoryCounter('active-timers');
      incMemoryCounter('active-dom-listeners', 4);
      // prettier-ignore
      socket.onopen = () => { const reconnect = openCount > 0; openCount += 1; reconnectDelayMs = 500; clearConnectTimer(); metrics.open(); setState('open'); if (reconnect) restoreSubscriptions(); queue.drain().forEach((message) => socket?.send(message)); };
      // prettier-ignore
      socket.onclose = () => { clearConnectTimer(); socket = undefined; if (!intentionalClose && state !== 'error') { lastError = 'websocket closed'; addDiagnostic('closed', 'websocket closed'); } setState('closed'); scheduleReconnect(); };
      // prettier-ignore
      socket.onerror = () => { clearConnectTimer(); lastError = 'websocket error'; setState('error'); socket = undefined; scheduleReconnect(); };
      socket.onmessage = (message) => receive(message.data);
    },
    // prettier-ignore
    subscribe: (id: string, filters: readonly NostrFilter[], options: RelaySubscribeOptions = {}) => { if (finallyClosed || !validSubscriptionId(id, 'REQ')) return; const safeFilters = clampFilters(relaySafeFilters(filters)), strategy = options.strategy ?? 'forward'; reqs.schedule({ id, critical: strategy === 'forward', start: () => startSubscription(id, safeFilters, { ...options, strategy }), drop: () => addDiagnostic('request-queue-drop', 'pending REQ dropped', id) }, activeLimit()); },
    // prettier-ignore
    closeSubscription: (id: string) => { if (finallyClosed || !validSubscriptionId(id, 'CLOSE')) return; const wasClosed = Boolean(closedBySub[id]) || closeSentBySub.has(id); const wireId = aliases.wireId(id, relayLimits(url).maxSubscriptionIdLength); closeTombstones.record([id, wireId]); forgetSubscription(id); releaseReq(id); if (!wasClosed) sendIfConnected(['CLOSE', wireId]); emitState(); },
    publish: (event: NostrEvent) => send(['EVENT', event]),
    send,
    sendIfConnected,
    // prettier-ignore
    close: () => { if (finallyClosed && state === 'closed') return; finallyClosed = true; intentionalClose = true; clearConnectTimer(); clearReconnectTimer(); detachSocket(); socket?.close(); socket = undefined; clearRuntimeState(); setState('closed'); },
  };
  return handle;
}
